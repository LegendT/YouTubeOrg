'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import {
  categories,
  categoryVideos,
  consolidationProposals,
  playlists,
  videos,
} from '@/lib/db/schema';
import { eq, and, inArray, sql, ne, count, asc } from 'drizzle-orm';
import type {
  CategoryListItem,
  CategoryActionResult,
  DeleteCategoryResult,
  DeleteUndoData,
  MergeCategoriesResult,
  MergeUndoData,
  VideoSearchResult,
} from '@/types/categories';

// ============================================================================
// Core CRUD: List, Create, Rename, Delete, Undo Delete
// ============================================================================

/**
 * Get all categories sorted by name, with Uncategorized at the bottom.
 *
 * Enriches each category with source playlist names derived from the
 * linked consolidation proposal. Returns CategoryListItem[] for the
 * category list sidebar.
 */
export async function getCategories(): Promise<CategoryListItem[]> {
  try {
    const allCategories = await db
      .select()
      .from(categories)
      .orderBy(asc(categories.isProtected), asc(categories.name));

    // Enrich with source playlist names via sourceProposalId
    const enriched: CategoryListItem[] = await Promise.all(
      allCategories.map(async (cat) => {
        let sourcePlaylistNames: string[] = [];

        if (cat.sourceProposalId) {
          // Get the proposal to find source playlist IDs
          const [proposal] = await db
            .select({ sourcePlaylistIds: consolidationProposals.sourcePlaylistIds })
            .from(consolidationProposals)
            .where(eq(consolidationProposals.id, cat.sourceProposalId))
            .limit(1);

          if (proposal) {
            const playlistIds = proposal.sourcePlaylistIds as number[];
            if (playlistIds.length > 0) {
              const playlistRows = await db
                .select({ title: playlists.title })
                .from(playlists)
                .where(inArray(playlists.id, playlistIds));
              sourcePlaylistNames = playlistRows.map((p) => p.title);
            }
          }
        }

        return {
          id: cat.id,
          name: cat.name,
          videoCount: Number(cat.videoCount),
          isProtected: cat.isProtected,
          sourcePlaylistNames,
          updatedAt: cat.updatedAt,
        };
      })
    );

    return enriched;
  } catch (error) {
    console.error('Failed to get categories:', error);
    return [];
  }
}

/**
 * Create a new empty category.
 *
 * Validates name constraints (non-empty, max 150 chars, unique case-insensitive).
 * Creates with videoCount: 0 and isProtected: false.
 */
export async function createCategory(name: string): Promise<CategoryActionResult> {
  try {
    const trimmed = name.trim();

    if (!trimmed) {
      return { success: false, error: 'Category name cannot be empty' };
    }

    if (trimmed.length > 150) {
      return { success: false, error: 'Category name must be 150 characters or less' };
    }

    // Check for case-insensitive duplicate
    const [existing] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(sql`lower(${categories.name}) = lower(${trimmed})`)
      .limit(1);

    if (existing) {
      return { success: false, error: `A category named "${trimmed}" already exists` };
    }

    await db.insert(categories).values({
      name: trimmed,
      videoCount: 0,
      isProtected: false,
    });

    revalidatePath('/analysis');
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to create category: ${message}` };
  }
}

/**
 * Rename a category.
 *
 * Protected categories (Uncategorized) cannot be renamed.
 * Validates name constraints and case-insensitive uniqueness (excluding self).
 */
export async function renameCategory(
  categoryId: number,
  newName: string
): Promise<CategoryActionResult> {
  try {
    const trimmed = newName.trim();

    if (!trimmed) {
      return { success: false, error: 'Category name cannot be empty' };
    }

    if (trimmed.length > 150) {
      return { success: false, error: 'Category name must be 150 characters or less' };
    }

    // Check category exists
    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);

    if (!category) {
      return { success: false, error: 'Category not found' };
    }

    if (category.isProtected) {
      return { success: false, error: 'Protected categories cannot be renamed' };
    }

    // Check for case-insensitive duplicate (excluding self)
    const [existing] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          sql`lower(${categories.name}) = lower(${trimmed})`,
          ne(categories.id, categoryId)
        )
      )
      .limit(1);

    if (existing) {
      return { success: false, error: `A category named "${trimmed}" already exists` };
    }

    await db
      .update(categories)
      .set({ name: trimmed, updatedAt: new Date() })
      .where(eq(categories.id, categoryId));

    revalidatePath('/analysis');
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to rename category: ${message}` };
  }
}

/**
 * Delete a category with orphan handling and undo data.
 *
 * Protected categories cannot be deleted. Videos that become orphaned
 * (not in any other category) are moved to the Uncategorized category.
 * Returns undo data to allow reversal.
 */
export async function deleteCategory(categoryId: number): Promise<DeleteCategoryResult> {
  try {
    // Check category exists
    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);

    if (!category) {
      return { success: false, error: 'Category not found' };
    }

    if (category.isProtected) {
      return { success: false, error: 'Protected categories cannot be deleted' };
    }

    const result = await db.transaction(async (tx) => {
      // a. Get all videoIds in this category
      const categoryVideoRows = await tx
        .select({ videoId: categoryVideos.videoId })
        .from(categoryVideos)
        .where(eq(categoryVideos.categoryId, categoryId));

      const videoIds = categoryVideoRows.map((cv) => cv.videoId);

      // b. Delete the category (cascade deletes its categoryVideos rows)
      await tx.delete(categories).where(eq(categories.id, categoryId));

      // c. Find orphaned videos (no longer in ANY category)
      let orphanedCount = 0;

      if (videoIds.length > 0) {
        // After cascade delete, find which videoIds have NO remaining categoryVideos entries
        const stillAssigned = await tx
          .select({ videoId: categoryVideos.videoId })
          .from(categoryVideos)
          .where(inArray(categoryVideos.videoId, videoIds));

        const stillAssignedIds = new Set(stillAssigned.map((r) => r.videoId));
        const orphanedVideoIds = videoIds.filter((id) => !stillAssignedIds.has(id));

        // d. Move orphans to Uncategorized
        if (orphanedVideoIds.length > 0) {
          const [uncategorized] = await tx
            .select({ id: categories.id, videoCount: categories.videoCount })
            .from(categories)
            .where(eq(categories.isProtected, true))
            .limit(1);

          if (uncategorized) {
            for (const videoId of orphanedVideoIds) {
              await tx.insert(categoryVideos).values({
                categoryId: uncategorized.id,
                videoId,
                source: 'orphan',
              });
            }

            // Update Uncategorized's video count
            await tx
              .update(categories)
              .set({
                videoCount: Number(uncategorized.videoCount) + orphanedVideoIds.length,
                updatedAt: new Date(),
              })
              .where(eq(categories.id, uncategorized.id));
          }

          orphanedCount = orphanedVideoIds.length;
        }
      }

      return {
        videoIds,
        orphanedCount,
      };
    });

    revalidatePath('/analysis');

    return {
      success: true,
      undoData: {
        type: 'delete' as const,
        categoryName: category.name,
        categoryId,
        videoIds: result.videoIds,
        wasProtected: false,
      },
      orphanedCount: result.orphanedCount,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to delete category: ${message}` };
  }
}

/**
 * Undo a category deletion.
 *
 * Re-creates the deleted category, removes orphaned videos from Uncategorized,
 * and re-assigns them to the restored category.
 */
export async function undoDelete(undoData: DeleteUndoData): Promise<CategoryActionResult> {
  try {
    await db.transaction(async (tx) => {
      // a. Re-create the category
      const [restored] = await tx
        .insert(categories)
        .values({
          name: undoData.categoryName,
          videoCount: undoData.videoIds.length,
          isProtected: false,
        })
        .returning({ id: categories.id });

      // b. Remove orphaned videoIds from Uncategorized
      if (undoData.videoIds.length > 0) {
        const [uncategorized] = await tx
          .select({ id: categories.id, videoCount: categories.videoCount })
          .from(categories)
          .where(eq(categories.isProtected, true))
          .limit(1);

        if (uncategorized) {
          // Delete only orphan-sourced entries for these video IDs from Uncategorized
          await tx
            .delete(categoryVideos)
            .where(
              and(
                eq(categoryVideos.categoryId, uncategorized.id),
                eq(categoryVideos.source, 'orphan'),
                inArray(categoryVideos.videoId, undoData.videoIds)
              )
            );

          // Recalculate Uncategorized video count
          const [uncatCount] = await tx
            .select({ cnt: count() })
            .from(categoryVideos)
            .where(eq(categoryVideos.categoryId, uncategorized.id));

          await tx
            .update(categories)
            .set({
              videoCount: Number(uncatCount.cnt),
              updatedAt: new Date(),
            })
            .where(eq(categories.id, uncategorized.id));
        }

        // c. Insert videoIds into the restored category
        for (const videoId of undoData.videoIds) {
          await tx.insert(categoryVideos).values({
            categoryId: restored.id,
            videoId,
            source: 'undo',
          });
        }
      }
    });

    revalidatePath('/analysis');
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to undo delete: ${message}` };
  }
}
