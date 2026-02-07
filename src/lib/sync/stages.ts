import { db } from '@/lib/db';
import {
  categories,
  categoryVideos,
  playlists,
  syncVideoOperations,
  videos,
} from '@/lib/db/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { createYouTubePlaylist, addVideoToPlaylist, deleteYouTubePlaylist } from '@/lib/youtube/write-operations';
import {
  advanceStage,
  pauseSyncJob,
  updateJobProgress,
  recordJobError,
  updateStageResults,
} from './engine';
import type { SyncJobRecord, SyncError } from '@/types/sync';

/**
 * Stage Executors for the Sync Engine
 *
 * Each executor processes up to batchSize operations and returns, allowing
 * the engine to check quota and update progress between batches.
 *
 * All three executors:
 * - Skip already-completed items (idempotent resume)
 * - Pause on 403 quotaExceeded
 * - Collect other errors without throwing
 * - Update progress and stageResults after each batch
 */

/**
 * Helper: Extract YouTube API error info from caught errors.
 * The googleapis library wraps errors with response data.
 */
function extractApiError(error: any): { status?: number; reason?: string; message: string } {
  const status = error?.response?.status ?? error?.code;
  const reason = error?.response?.data?.error?.errors?.[0]?.reason;
  const message = error?.message || 'Unknown error';
  return { status, reason, message };
}

// ---------------------------------------------------------------------------
// Stage 1: Create Playlists
// ---------------------------------------------------------------------------

/**
 * Execute the create_playlists stage.
 *
 * Creates YouTube playlists for non-protected categories that don't already
 * have a youtubePlaylistId (idempotent: skips already-created).
 *
 * When all playlists are created, populates syncVideoOperations and advances
 * to add_videos stage.
 */
export async function executeCreatePlaylists(
  job: SyncJobRecord,
  accessToken: string,
  batchSize: number
): Promise<void> {
  // Query categories that still need a YouTube playlist
  const remaining = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(
      and(
        eq(categories.isProtected, false),
        isNull(categories.youtubePlaylistId)
      )
    );

  // If none remain, this stage is complete -- advance to add_videos
  if (remaining.length === 0) {
    // Count results from already-completed categories for stage results
    const allNonProtected = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.isProtected, false));

    await updateStageResults(job.id, 'create_playlists', {
      succeeded: allNonProtected.length,
      failed: 0,
      skipped: 0,
    });

    // Populate syncVideoOperations for the add_videos stage
    await populateSyncVideoOperations(job.id);

    await advanceStage(job.id, 'add_videos');
    return;
  }

  // Count total for progress display
  const allNonProtected = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.isProtected, false));
  const totalCount = allNonProtected.length;
  const completedBefore = totalCount - remaining.length;

  // Process up to batchSize categories
  const batch = remaining.slice(0, batchSize);
  let succeeded = completedBefore;
  let failed = 0;

  for (const category of batch) {
    try {
      const youtubePlaylistId = await createYouTubePlaylist(accessToken, category.name);

      // Store the YouTube playlist ID on the category
      await db
        .update(categories)
        .set({ youtubePlaylistId })
        .where(eq(categories.id, category.id));

      succeeded++;
      await updateJobProgress(job.id, succeeded, totalCount, 50);
    } catch (error: any) {
      const apiError = extractApiError(error);

      if (apiError.status === 403 && apiError.reason === 'quotaExceeded') {
        await pauseSyncJob(job.id, 'quota_exhausted');
        return;
      }

      // Collect error and continue
      failed++;
      await recordJobError(job.id, {
        stage: 'create_playlists',
        entityType: 'playlist',
        entityId: String(category.id),
        message: apiError.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Update stage results with current totals
  await updateStageResults(job.id, 'create_playlists', {
    succeeded,
    failed,
    skipped: 0,
  });
}

/**
 * Populate the syncVideoOperations table with all video assignments
 * that need to be processed in the add_videos stage.
 *
 * Creates one row per (categoryId, videoId) pair for non-protected categories.
 * Includes youtubeVideoId from the videos table for direct API calls.
 */
async function populateSyncVideoOperations(jobId: number): Promise<void> {
  // Get all video assignments for non-protected categories with YouTube video IDs
  const assignments = await db
    .select({
      categoryId: categoryVideos.categoryId,
      videoId: categoryVideos.videoId,
      youtubeVideoId: videos.youtubeId,
    })
    .from(categoryVideos)
    .innerJoin(categories, eq(categoryVideos.categoryId, categories.id))
    .innerJoin(videos, eq(categoryVideos.videoId, videos.id))
    .where(eq(categories.isProtected, false));

  if (assignments.length === 0) return;

  // Batch insert all operations
  const values = assignments.map((a) => ({
    syncJobId: jobId,
    categoryId: a.categoryId,
    videoId: a.videoId,
    youtubeVideoId: a.youtubeVideoId,
    status: 'pending' as const,
  }));

  // Insert in chunks to avoid oversized queries
  const CHUNK_SIZE = 500;
  for (let i = 0; i < values.length; i += CHUNK_SIZE) {
    const chunk = values.slice(i, i + CHUNK_SIZE);
    await db.insert(syncVideoOperations).values(chunk);
  }
}

// ---------------------------------------------------------------------------
// Stage 2: Add Videos
// ---------------------------------------------------------------------------

/**
 * Execute the add_videos stage.
 *
 * Processes pending syncVideoOperations for this job, adding each video
 * to its category's YouTube playlist. Skips already-completed operations
 * (idempotent resume).
 *
 * When all operations are done, advances to delete_playlists stage.
 */
export async function executeAddVideos(
  job: SyncJobRecord,
  accessToken: string,
  batchSize: number
): Promise<void> {
  // Query pending operations for this job
  const pending = await db
    .select()
    .from(syncVideoOperations)
    .where(
      and(
        eq(syncVideoOperations.syncJobId, job.id),
        eq(syncVideoOperations.status, 'pending')
      )
    )
    .limit(batchSize);

  // If none remain, this stage is complete -- advance to delete_playlists
  if (pending.length === 0) {
    // Compute final stage results
    const allOps = await db
      .select({
        status: syncVideoOperations.status,
        cnt: sql<string>`COUNT(*)`,
      })
      .from(syncVideoOperations)
      .where(eq(syncVideoOperations.syncJobId, job.id))
      .groupBy(syncVideoOperations.status);

    const results = { succeeded: 0, failed: 0, skipped: 0 };
    for (const row of allOps) {
      const count = Number(row.cnt);
      if (row.status === 'completed') results.succeeded = count;
      else if (row.status === 'failed') results.failed = count;
      else if (row.status === 'skipped') results.skipped = count;
    }

    await updateStageResults(job.id, 'add_videos', results);
    await advanceStage(job.id, 'delete_playlists');
    return;
  }

  // Get total operation counts for progress tracking
  const totalResult = await db
    .select({ cnt: sql<string>`COUNT(*)` })
    .from(syncVideoOperations)
    .where(eq(syncVideoOperations.syncJobId, job.id));
  const totalOps = Number(totalResult[0]?.cnt ?? 0);

  const completedResult = await db
    .select({ cnt: sql<string>`COUNT(*)` })
    .from(syncVideoOperations)
    .where(
      and(
        eq(syncVideoOperations.syncJobId, job.id),
        sql`${syncVideoOperations.status} != 'pending'`
      )
    );
  let completedCount = Number(completedResult[0]?.cnt ?? 0);

  for (const op of pending) {
    // Look up the category's YouTube playlist ID
    const [cat] = await db
      .select({ youtubePlaylistId: categories.youtubePlaylistId })
      .from(categories)
      .where(eq(categories.id, op.categoryId))
      .limit(1);

    if (!cat?.youtubePlaylistId) {
      // Category playlist was not created -- skip this operation
      await db
        .update(syncVideoOperations)
        .set({
          status: 'skipped',
          errorMessage: 'Category playlist not created',
          completedAt: new Date(),
        })
        .where(eq(syncVideoOperations.id, op.id));

      completedCount++;
      await updateJobProgress(job.id, completedCount, totalOps);
      continue;
    }

    try {
      await addVideoToPlaylist(accessToken, cat.youtubePlaylistId, op.youtubeVideoId);

      // Mark as completed
      await db
        .update(syncVideoOperations)
        .set({
          status: 'completed',
          completedAt: new Date(),
        })
        .where(eq(syncVideoOperations.id, op.id));

      completedCount++;
      await updateJobProgress(job.id, completedCount, totalOps, 50);
    } catch (error: any) {
      const apiError = extractApiError(error);

      if (apiError.status === 403 && apiError.reason === 'quotaExceeded') {
        await pauseSyncJob(job.id, 'quota_exhausted');
        return;
      }

      // 409 conflict / duplicate -- treat as success (video already in playlist)
      if (apiError.status === 409) {
        await db
          .update(syncVideoOperations)
          .set({
            status: 'completed',
            completedAt: new Date(),
          })
          .where(eq(syncVideoOperations.id, op.id));

        completedCount++;
        await updateJobProgress(job.id, completedCount, totalOps, 50);
        continue;
      }

      // Other error -- mark as failed, record error, continue
      await db
        .update(syncVideoOperations)
        .set({
          status: 'failed',
          errorMessage: apiError.message,
        })
        .where(eq(syncVideoOperations.id, op.id));

      completedCount++;
      await recordJobError(job.id, {
        stage: 'add_videos',
        entityType: 'video',
        entityId: op.youtubeVideoId,
        message: apiError.message,
        timestamp: new Date().toISOString(),
      });
      await updateJobProgress(job.id, completedCount, totalOps);
    }
  }

  // Update stage results with current snapshot
  const allOps = await db
    .select({
      status: syncVideoOperations.status,
      cnt: sql<string>`COUNT(*)`,
    })
    .from(syncVideoOperations)
    .where(eq(syncVideoOperations.syncJobId, job.id))
    .groupBy(syncVideoOperations.status);

  const results = { succeeded: 0, failed: 0, skipped: 0 };
  for (const row of allOps) {
    const count = Number(row.cnt);
    if (row.status === 'completed') results.succeeded = count;
    else if (row.status === 'failed') results.failed = count;
    else if (row.status === 'skipped') results.skipped = count;
  }
  await updateStageResults(job.id, 'add_videos', results);
}

// ---------------------------------------------------------------------------
// Stage 3: Delete Playlists
// ---------------------------------------------------------------------------

/**
 * Execute the delete_playlists stage.
 *
 * Deletes old YouTube playlists that haven't been deleted yet.
 * Treats 404 errors as success (playlist already deleted -- idempotent).
 *
 * When all playlists are deleted, advances to completed stage.
 */
export async function executeDeletePlaylists(
  job: SyncJobRecord,
  accessToken: string,
  batchSize: number
): Promise<void> {
  // Query playlists not yet deleted
  const remaining = await db
    .select({
      id: playlists.id,
      youtubeId: playlists.youtubeId,
      title: playlists.title,
    })
    .from(playlists)
    .where(isNull(playlists.deletedFromYoutubeAt))
    .limit(batchSize);

  // If none remain, this stage is complete
  if (remaining.length === 0) {
    // Count total playlists (deleted + already marked)
    const allPlaylists = await db
      .select({ cnt: sql<string>`COUNT(*)` })
      .from(playlists);
    const total = Number(allPlaylists[0]?.cnt ?? 0);

    await updateStageResults(job.id, 'delete_playlists', {
      succeeded: total,
      failed: 0,
      skipped: 0,
    });

    await advanceStage(job.id, 'completed');
    return;
  }

  // Count totals for progress tracking
  const allPlaylistsResult = await db
    .select({ cnt: sql<string>`COUNT(*)` })
    .from(playlists);
  const totalCount = Number(allPlaylistsResult[0]?.cnt ?? 0);

  const deletedResult = await db
    .select({ cnt: sql<string>`COUNT(*)` })
    .from(playlists)
    .where(sql`${playlists.deletedFromYoutubeAt} IS NOT NULL`);
  let deletedCount = Number(deletedResult[0]?.cnt ?? 0);

  let failed = 0;

  for (const playlist of remaining) {
    try {
      await deleteYouTubePlaylist(accessToken, playlist.youtubeId);

      // Mark as deleted
      await db
        .update(playlists)
        .set({ deletedFromYoutubeAt: new Date() })
        .where(eq(playlists.id, playlist.id));

      deletedCount++;
      await updateJobProgress(job.id, deletedCount, totalCount, 50);
    } catch (error: any) {
      const apiError = extractApiError(error);

      if (apiError.status === 403 && apiError.reason === 'quotaExceeded') {
        await pauseSyncJob(job.id, 'quota_exhausted');
        return;
      }

      // 404 Not Found -- treat as success (already deleted, idempotent)
      if (apiError.status === 404) {
        await db
          .update(playlists)
          .set({ deletedFromYoutubeAt: new Date() })
          .where(eq(playlists.id, playlist.id));

        deletedCount++;
        await updateJobProgress(job.id, deletedCount, totalCount);
        continue;
      }

      // Other error -- record and continue
      failed++;
      await recordJobError(job.id, {
        stage: 'delete_playlists',
        entityType: 'playlist',
        entityId: playlist.youtubeId,
        message: apiError.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Update stage results
  await updateStageResults(job.id, 'delete_playlists', {
    succeeded: deletedCount,
    failed,
    skipped: 0,
  });
}
