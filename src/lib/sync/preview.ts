import { db } from '@/lib/db';
import { categories, categoryVideos, playlists } from '@/lib/db/schema';
import { eq, isNull, sql, and } from 'drizzle-orm';
import { QUOTA_COSTS } from '@/lib/youtube/quota';
import type { SyncPreview } from '@/types/sync';

/**
 * Compute a full sync preview from current database state.
 *
 * Queries categories, categoryVideos, and playlists to determine:
 * - How many playlists need creating (non-protected categories without a YouTube playlist)
 * - How many video assignments need adding (per category)
 * - How many old playlists need deleting (not yet deleted from YouTube)
 *
 * Returns accurate quota cost estimates and estimated days to complete.
 */
export async function computeSyncPreview(): Promise<SyncPreview> {
  // 1. Count playlists to create: non-protected categories without a youtubePlaylistId
  const categoriesToCreate = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(
      and(
        eq(categories.isProtected, false),
        isNull(categories.youtubePlaylistId)
      )
    );

  const createItems = categoriesToCreate.map((c) => ({
    categoryName: c.name,
    categoryId: c.id,
  }));
  const createCost = createItems.length * QUOTA_COSTS['playlists.insert'];

  // 2. Count video assignments: all categoryVideos for non-protected categories, grouped by category
  const videoAssignments = await db
    .select({
      categoryId: categoryVideos.categoryId,
      categoryName: categories.name,
      videoCount: sql<string>`COUNT(${categoryVideos.id})`,
    })
    .from(categoryVideos)
    .innerJoin(categories, eq(categoryVideos.categoryId, categories.id))
    .where(eq(categories.isProtected, false))
    .groupBy(categoryVideos.categoryId, categories.name);

  const byCategory = videoAssignments.map((row) => ({
    categoryName: row.categoryName,
    categoryId: row.categoryId,
    videoCount: Number(row.videoCount),
  }));

  const totalVideos = byCategory.reduce((sum, row) => sum + row.videoCount, 0);
  const addCost = totalVideos * QUOTA_COSTS['playlistItems.insert'];

  // 3. Count playlists to delete: old playlists not yet deleted from YouTube
  const playlistsToDelete = await db
    .select({
      id: playlists.id,
      title: playlists.title,
      youtubeId: playlists.youtubeId,
    })
    .from(playlists)
    .where(isNull(playlists.deletedFromYoutubeAt));

  const deleteItems = playlistsToDelete.map((p) => ({
    playlistName: p.title,
    playlistId: p.id,
    youtubeId: p.youtubeId,
  }));
  const deleteCost = deleteItems.length * QUOTA_COSTS['playlists.delete'];

  // 4. Calculate totals
  const totalQuotaCost = createCost + addCost + deleteCost;
  const dailyQuotaLimit = 10000;
  const estimatedDays = Math.ceil(totalQuotaCost / dailyQuotaLimit);

  return {
    stages: {
      createPlaylists: {
        count: createItems.length,
        quotaCost: createCost,
        items: createItems,
      },
      addVideos: {
        count: totalVideos,
        quotaCost: addCost,
        byCategory,
      },
      deletePlaylists: {
        count: deleteItems.length,
        quotaCost: deleteCost,
        items: deleteItems,
      },
    },
    totalQuotaCost,
    estimatedDays,
    dailyQuotaLimit,
  };
}
