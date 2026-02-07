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
import { createSnapshot } from '@/lib/backup/snapshot';
import { logOperation } from '@/app/actions/operation-log';

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

    // Create pre-operation backup (SAFE-02: automatic archive before delete)
    let backup: { snapshotId: number } | null = null;
    try {
      backup = await createSnapshot('pre_delete', `category:${category.name}`);
    } catch (backupError) {
      console.warn('Pre-delete backup failed (proceeding with delete):', backupError);
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
    revalidatePath('/safety');

    // Log to immutable operation log (SAFE-05)
    try {
      await logOperation({
        action: 'delete_category',
        entityType: 'category',
        entityIds: [categoryId],
        metadata: {
          categoryName: category.name,
          videoCount: Number(category.videoCount),
          orphanedCount: result.orphanedCount,
        },
        ...(backup ? { backupSnapshotId: backup.snapshotId } : {}),
      });
    } catch (logError) {
      console.warn('Operation log entry failed (delete completed):', logError);
    }

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

// ============================================================================
// Merge, Undo Merge, Video Search, Video Assignment, Category Detail
// ============================================================================

/**
 * Merge 2+ categories into a single new category.
 *
 * Collects all videos from source categories, deduplicates, deletes sources,
 * creates merged category. Returns undo data with original category snapshots.
 * Protected categories cannot be merged.
 */
export async function mergeCategories(
  sourceCategoryIds: number[],
  targetName: string
): Promise<MergeCategoriesResult> {
  try {
    if (sourceCategoryIds.length < 2) {
      return { success: false, error: 'At least 2 categories are required for merge' };
    }

    const trimmed = targetName.trim();
    if (!trimmed) {
      return { success: false, error: 'Target category name cannot be empty' };
    }

    // Check none are protected
    const sourceCategories = await db
      .select()
      .from(categories)
      .where(inArray(categories.id, sourceCategoryIds));

    const protectedCat = sourceCategories.find((c) => c.isProtected);
    if (protectedCat) {
      return {
        success: false,
        error: `Cannot merge protected category "${protectedCat.name}"`,
      };
    }

    if (sourceCategories.length !== sourceCategoryIds.length) {
      return { success: false, error: 'One or more source categories not found' };
    }

    // Create pre-operation backup (SAFE-02: automatic archive before merge)
    let backup: { snapshotId: number } | null = null;
    try {
      const categoryNames = sourceCategories.map(c => c.name).join(', ');
      backup = await createSnapshot('pre_merge', `merge:${categoryNames}`);
    } catch (backupError) {
      console.warn('Pre-merge backup failed (proceeding with merge):', backupError);
    }

    const result = await db.transaction(async (tx) => {
      // a. Collect all videoIds from source categories
      const allCategoryVideoRows = await tx
        .select({
          categoryId: categoryVideos.categoryId,
          videoId: categoryVideos.videoId,
        })
        .from(categoryVideos)
        .where(inArray(categoryVideos.categoryId, sourceCategoryIds));

      // b. Deduplicate video IDs
      const uniqueVideoIds = [...new Set(allCategoryVideoRows.map((r) => r.videoId))];

      // c. Snapshot each source category for undo data
      const originalCategories = sourceCategories.map((cat) => ({
        name: cat.name,
        videoIds: allCategoryVideoRows
          .filter((r) => r.categoryId === cat.id)
          .map((r) => r.videoId),
      }));

      // d. Delete all source categories (cascade deletes their categoryVideos)
      await tx.delete(categories).where(inArray(categories.id, sourceCategoryIds));

      // e. Create new merged category
      const [merged] = await tx
        .insert(categories)
        .values({
          name: trimmed,
          videoCount: uniqueVideoIds.length,
          isProtected: false,
        })
        .returning({ id: categories.id });

      // f. Batch insert deduplicated videoIds
      for (const videoId of uniqueVideoIds) {
        await tx.insert(categoryVideos).values({
          categoryId: merged.id,
          videoId,
          source: 'merge',
        });
      }

      return {
        mergedCategoryId: merged.id,
        totalVideos: uniqueVideoIds.length,
        originalCategories,
      };
    });

    revalidatePath('/analysis');
    revalidatePath('/safety');

    // Log to immutable operation log (SAFE-05)
    try {
      await logOperation({
        action: 'merge_categories',
        entityType: 'category',
        entityIds: sourceCategoryIds,
        metadata: {
          sourceCategoryNames: sourceCategories.map(c => c.name),
          targetName: trimmed,
          totalVideos: result.totalVideos,
        },
        ...(backup ? { backupSnapshotId: backup.snapshotId } : {}),
      });
    } catch (logError) {
      console.warn('Operation log entry failed (merge completed):', logError);
    }

    return {
      success: true,
      mergedCategoryId: result.mergedCategoryId,
      totalVideos: result.totalVideos,
      undoData: {
        type: 'merge' as const,
        mergedCategoryId: result.mergedCategoryId,
        originalCategories: result.originalCategories,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to merge categories: ${message}` };
  }
}

/**
 * Undo a category merge.
 *
 * Deletes the merged category and re-creates each original category
 * with its original video assignments.
 */
export async function undoMerge(undoData: MergeUndoData): Promise<CategoryActionResult> {
  try {
    await db.transaction(async (tx) => {
      // a. Delete the merged category (cascade deletes its categoryVideos)
      await tx.delete(categories).where(eq(categories.id, undoData.mergedCategoryId));

      // b. Re-create each original category with its video assignments
      for (const original of undoData.originalCategories) {
        const [restored] = await tx
          .insert(categories)
          .values({
            name: original.name,
            videoCount: original.videoIds.length,
            isProtected: false,
          })
          .returning({ id: categories.id });

        for (const videoId of original.videoIds) {
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
    return { success: false, error: `Failed to undo merge: ${message}` };
  }
}

/**
 * Search videos for the assignment dialog.
 *
 * Filters by title or channel name using ILIKE. Optionally scopes to a
 * specific source category. Returns video details with their category names.
 */
export async function searchVideosForAssignment(
  query: string,
  sourceCategoryId?: number,
  limit: number = 50,
  offset: number = 0
): Promise<{ videos: VideoSearchResult[]; total: number }> {
  try {
    const trimmedQuery = query.trim();

    // Build the base query conditions
    const conditions: ReturnType<typeof eq>[] = [];

    if (trimmedQuery) {
      conditions.push(
        sql`(${videos.title} ILIKE ${`%${trimmedQuery}%`} OR ${videos.channelTitle} ILIKE ${`%${trimmedQuery}%`})`
      );
    }

    if (sourceCategoryId !== undefined) {
      // Scope to videos in the specified category
      const categoryVideoIds = await db
        .select({ videoId: categoryVideos.videoId })
        .from(categoryVideos)
        .where(eq(categoryVideos.categoryId, sourceCategoryId));

      const videoIds = categoryVideoIds.map((cv) => cv.videoId);

      if (videoIds.length === 0) {
        return { videos: [], total: 0 };
      }

      conditions.push(inArray(videos.id, videoIds));
    }

    // Count total matching videos
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRow] = await db
      .select({ cnt: count() })
      .from(videos)
      .where(whereClause);

    const total = Number(totalRow.cnt);

    // Fetch paginated results
    const videoRows = await db
      .select({
        id: videos.id,
        youtubeId: videos.youtubeId,
        title: videos.title,
        thumbnailUrl: videos.thumbnailUrl,
        channelTitle: videos.channelTitle,
        duration: videos.duration,
      })
      .from(videos)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(asc(videos.title));

    // Enrich each video with its category names
    const enriched: VideoSearchResult[] = await Promise.all(
      videoRows.map(async (video) => {
        const catRows = await db
          .select({ name: categories.name })
          .from(categoryVideos)
          .innerJoin(categories, eq(categoryVideos.categoryId, categories.id))
          .where(eq(categoryVideos.videoId, video.id));

        return {
          id: video.id,
          youtubeId: video.youtubeId,
          title: video.title,
          thumbnailUrl: video.thumbnailUrl,
          channelTitle: video.channelTitle,
          duration: video.duration,
          categoryNames: catRows.map((r) => r.name),
        };
      })
    );

    return { videos: enriched, total };
  } catch (error) {
    console.error('Failed to search videos:', error);
    return { videos: [], total: 0 };
  }
}

/**
 * Assign videos to a target category (copy or move).
 *
 * Enforces YouTube's 5,000 video limit per playlist. In 'move' mode with
 * a sourceCategoryId, removes videos from the source category.
 * Deduplicates: skips videos already in the target category.
 */
export async function assignVideosToCategory(
  categoryId: number,
  videoIds: number[],
  mode: 'move' | 'copy',
  sourceCategoryId?: number
): Promise<CategoryActionResult> {
  try {
    if (videoIds.length === 0) {
      return { success: false, error: 'No videos to assign' };
    }

    // Check target category exists
    const [targetCategory] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);

    if (!targetCategory) {
      return { success: false, error: 'Target category not found' };
    }

    // Check YouTube 5,000 limit
    const currentCount = Number(targetCategory.videoCount);

    // Filter out videos already in the target category
    const existingInTarget = await db
      .select({ videoId: categoryVideos.videoId })
      .from(categoryVideos)
      .where(
        and(
          eq(categoryVideos.categoryId, categoryId),
          inArray(categoryVideos.videoId, videoIds)
        )
      );

    const existingIds = new Set(existingInTarget.map((r) => r.videoId));
    const newVideoIds = videoIds.filter((id) => !existingIds.has(id));

    if (newVideoIds.length === 0) {
      return { success: true }; // All videos already in target
    }

    const projectedCount = currentCount + newVideoIds.length;

    if (projectedCount > 5000) {
      return {
        success: false,
        error: `Cannot assign ${newVideoIds.length} videos: would exceed 5,000 video limit (current: ${currentCount})`,
      };
    }

    await db.transaction(async (tx) => {
      // a. Insert new categoryVideos rows
      for (const videoId of newVideoIds) {
        await tx.insert(categoryVideos).values({
          categoryId,
          videoId,
          source: 'manual',
        });
      }

      // b. Update target video count
      await tx
        .update(categories)
        .set({
          videoCount: projectedCount,
          updatedAt: new Date(),
        })
        .where(eq(categories.id, categoryId));

      // c. If move mode and source provided, remove from source
      if (mode === 'move' && sourceCategoryId !== undefined) {
        await tx
          .delete(categoryVideos)
          .where(
            and(
              eq(categoryVideos.categoryId, sourceCategoryId),
              inArray(categoryVideos.videoId, videoIds)
            )
          );

        // Recalculate source video count
        const [sourceCount] = await tx
          .select({ cnt: count() })
          .from(categoryVideos)
          .where(eq(categoryVideos.categoryId, sourceCategoryId));

        await tx
          .update(categories)
          .set({
            videoCount: Number(sourceCount.cnt),
            updatedAt: new Date(),
          })
          .where(eq(categories.id, sourceCategoryId));
      }
    });

    // Warn at 4500 threshold (non-blocking)
    if (projectedCount >= 4500) {
      revalidatePath('/analysis');
      revalidatePath('/videos');
      return {
        success: true,
        error: `Warning: Category now has ${projectedCount} videos (approaching 5,000 limit)`,
      };
    }

    revalidatePath('/analysis');
    revalidatePath('/videos');
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to assign videos: ${message}` };
  }
}

/**
 * Get full category detail for the management view.
 *
 * Returns category info with all its videos enriched with category names.
 * Used by the category detail panel in the management UI.
 */
export async function getCategoryDetailManagement(
  categoryId: number
): Promise<{ category: { id: number; name: string; videoCount: number; isProtected: boolean; createdAt: Date; updatedAt: Date }; videos: VideoSearchResult[]; total: number } | null> {
  try {
    // Get category info
    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);

    if (!category) return null;

    // Get videos via categoryVideos joined to videos
    const videoRows = await db
      .select({
        id: videos.id,
        youtubeId: videos.youtubeId,
        title: videos.title,
        thumbnailUrl: videos.thumbnailUrl,
        channelTitle: videos.channelTitle,
        duration: videos.duration,
      })
      .from(categoryVideos)
      .innerJoin(videos, eq(categoryVideos.videoId, videos.id))
      .where(eq(categoryVideos.categoryId, categoryId))
      .orderBy(asc(videos.title));

    // Enrich each video with its category names
    const enrichedVideos: VideoSearchResult[] = await Promise.all(
      videoRows.map(async (video) => {
        const catRows = await db
          .select({ name: categories.name })
          .from(categoryVideos)
          .innerJoin(categories, eq(categoryVideos.categoryId, categories.id))
          .where(eq(categoryVideos.videoId, video.id));

        return {
          id: video.id,
          youtubeId: video.youtubeId,
          title: video.title,
          thumbnailUrl: video.thumbnailUrl,
          channelTitle: video.channelTitle,
          duration: video.duration,
          categoryNames: catRows.map((r) => r.name),
        };
      })
    );

    return {
      category: {
        id: category.id,
        name: category.name,
        videoCount: Number(category.videoCount),
        isProtected: category.isProtected,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      },
      videos: enrichedVideos,
      total: enrichedVideos.length,
    };
  } catch (error) {
    console.error('Failed to get category detail:', error);
    return null;
  }
}
