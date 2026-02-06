'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { videos, categoryVideos, categories } from '@/lib/db/schema';
import { eq, inArray, desc, asc, and, count } from 'drizzle-orm';
import type { VideoCardData } from '@/types/videos';
import { getThumbnailUrl } from '@/lib/videos/thumbnail-url';

/**
 * Get videos for a specific category or all videos across all categories.
 *
 * When categoryId is a number: fetch videos in that specific category.
 * When categoryId is null: fetch ALL videos across all categories ("All Videos" view).
 *
 * Uses optimised batch query pattern:
 * 1. Single join query to get primary video data
 * 2. Single batch query to enrich with ALL category names per video
 *
 * @param categoryId - Category ID to filter by, or null for all videos
 * @returns Array of VideoCardData with complete category information
 */
export async function getVideosForCategory(
  categoryId: number | null
): Promise<VideoCardData[]> {
  try {
    let videoRows: Array<{
      id: number;
      youtubeId: string;
      title: string;
      thumbnailUrl: string | null;
      channelTitle: string | null;
      duration: string | null;
      publishedAt: Date | null;
      categoryId: number;
      categoryName: string;
      addedAt: Date;
    }>;

    if (categoryId !== null) {
      // Specific category: join videos + categoryVideos + categories
      videoRows = await db
        .select({
          id: videos.id,
          youtubeId: videos.youtubeId,
          title: videos.title,
          thumbnailUrl: videos.thumbnailUrl,
          channelTitle: videos.channelTitle,
          duration: videos.duration,
          publishedAt: videos.publishedAt,
          categoryId: categoryVideos.categoryId,
          categoryName: categories.name,
          addedAt: categoryVideos.addedAt,
        })
        .from(categoryVideos)
        .innerJoin(videos, eq(categoryVideos.videoId, videos.id))
        .innerJoin(categories, eq(categoryVideos.categoryId, categories.id))
        .where(eq(categoryVideos.categoryId, categoryId))
        .orderBy(desc(categoryVideos.addedAt));
    } else {
      // All videos: get all videos that have at least one category assignment
      // Use the first category assignment for primary categoryId/categoryName
      videoRows = await db
        .select({
          id: videos.id,
          youtubeId: videos.youtubeId,
          title: videos.title,
          thumbnailUrl: videos.thumbnailUrl,
          channelTitle: videos.channelTitle,
          duration: videos.duration,
          publishedAt: videos.publishedAt,
          categoryId: categoryVideos.categoryId,
          categoryName: categories.name,
          addedAt: categoryVideos.addedAt,
        })
        .from(videos)
        .innerJoin(categoryVideos, eq(videos.id, categoryVideos.videoId))
        .innerJoin(categories, eq(categoryVideos.categoryId, categories.id))
        .orderBy(asc(videos.title));
    }

    if (videoRows.length === 0) {
      return [];
    }

    // Collect unique video IDs for batch enrichment
    const videoIds = [...new Set(videoRows.map((row) => row.id))];

    // Batch query: get ALL category names for each video in a single query
    const categoryNameRows = await db
      .select({
        videoId: categoryVideos.videoId,
        categoryName: categories.name,
      })
      .from(categoryVideos)
      .innerJoin(categories, eq(categoryVideos.categoryId, categories.id))
      .where(inArray(categoryVideos.videoId, videoIds));

    // Group category names by video ID
    const categoryNamesByVideoId = new Map<number, string[]>();
    for (const row of categoryNameRows) {
      const existing = categoryNamesByVideoId.get(row.videoId) || [];
      existing.push(row.categoryName);
      categoryNamesByVideoId.set(row.videoId, existing);
    }

    // For "All Videos" view, deduplicate videos (a video may appear multiple times if in multiple categories)
    // Keep the first occurrence based on the sort order
    const seenVideoIds = new Set<number>();
    const uniqueVideoRows = videoRows.filter((row) => {
      if (categoryId === null) {
        if (seenVideoIds.has(row.id)) {
          return false;
        }
        seenVideoIds.add(row.id);
      }
      return true;
    });

    // Map to VideoCardData with enriched category names
    const result: VideoCardData[] = uniqueVideoRows.map((row) => ({
      id: row.id,
      youtubeId: row.youtubeId,
      title: row.title,
      thumbnailUrl: getThumbnailUrl(row.youtubeId),
      duration: row.duration,
      channelTitle: row.channelTitle,
      publishedAt: row.publishedAt,
      categoryNames: categoryNamesByVideoId.get(row.id) || [],
    }));

    return result;
  } catch (error) {
    console.error('Failed to get videos for category:', error);
    return [];
  }
}

/**
 * Remove videos from a category.
 *
 * Used for copy undo: deletes categoryVideos entries for the specified videos
 * in the target category, then recalculates the category's videoCount.
 *
 * @param categoryId - Category to remove videos from
 * @param videoIds - Video IDs to remove
 * @returns Success result
 */
export async function removeVideosFromCategory(
  categoryId: number,
  videoIds: number[]
): Promise<{ success: boolean; error?: string }> {
  try {
    if (videoIds.length === 0) {
      return { success: true };
    }

    await db.transaction(async (tx) => {
      // Delete categoryVideos rows
      await tx
        .delete(categoryVideos)
        .where(
          and(
            eq(categoryVideos.categoryId, categoryId),
            inArray(categoryVideos.videoId, videoIds)
          )
        );

      // Recalculate videoCount
      const [result] = await tx
        .select({ cnt: count() })
        .from(categoryVideos)
        .where(eq(categoryVideos.categoryId, categoryId));

      await tx
        .update(categories)
        .set({
          videoCount: Number(result.cnt),
          updatedAt: new Date(),
        })
        .where(eq(categories.id, categoryId));
    });

    revalidatePath('/videos');
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to remove videos: ${message}` };
  }
}
