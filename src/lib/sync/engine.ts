import { db } from '@/lib/db';
import { syncJobs } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { getRemainingQuota } from '@/lib/youtube/quota';
import { createSnapshot } from '@/lib/backup/snapshot';
import type {
  SyncStage,
  PauseReason,
  SyncError,
  StageResults,
  SyncPreview,
  SyncJobRecord,
} from '@/types/sync';
import {
  executeCreatePlaylists,
  executeAddVideos,
  executeDeletePlaylists,
} from './stages';

/**
 * Sync Engine - State machine orchestrator for multi-day YouTube sync operations.
 *
 * The engine manages sync jobs through the stage pipeline:
 * pending -> backup -> create_playlists -> add_videos -> delete_playlists -> completed
 *
 * It can pause (quota_exhausted, user_paused, errors_collected) at any stage boundary
 * and resume from the correct position. Each call to processSyncBatch processes
 * up to batchSize operations and returns -- the client polls and calls again.
 */

// Minimum remaining quota before pausing (leaves room for user browsing)
const QUOTA_PAUSE_THRESHOLD = 1000;

/**
 * Cast a raw syncJobs DB row to a typed SyncJobRecord.
 * JSONB fields need type assertions when reading from PostgreSQL.
 */
function toSyncJobRecord(row: typeof syncJobs.$inferSelect): SyncJobRecord {
  return {
    id: row.id,
    stage: row.stage as SyncStage,
    currentStageProgress: row.currentStageProgress,
    currentStageTotal: row.currentStageTotal,
    stageResults: (row.stageResults ?? {}) as StageResults,
    errors: (row.errors ?? []) as SyncError[],
    quotaUsedThisSync: row.quotaUsedThisSync,
    pauseReason: (row.pauseReason as PauseReason) ?? null,
    previewData: (row.previewData as SyncPreview) ?? null,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    lastResumedAt: row.lastResumedAt,
    backupSnapshotId: row.backupSnapshotId,
  };
}

/**
 * Get the current active sync job (if any).
 *
 * Returns the most recent sync job that is not completed or failed.
 * Returns null if no jobs exist or the latest job is terminal.
 */
export async function getCurrentSyncJob(): Promise<SyncJobRecord | null> {
  const rows = await db
    .select()
    .from(syncJobs)
    .orderBy(desc(syncJobs.startedAt))
    .limit(1);

  if (rows.length === 0) return null;

  const job = toSyncJobRecord(rows[0]);

  // Terminal states -- no active job
  if (job.stage === 'completed' || job.stage === 'failed') {
    return null;
  }

  return job;
}

/**
 * Get a sync job by ID regardless of status.
 * Used internally for resume and updates.
 */
export async function getSyncJobById(jobId: number): Promise<SyncJobRecord | null> {
  const rows = await db
    .select()
    .from(syncJobs)
    .where(eq(syncJobs.id, jobId))
    .limit(1);

  if (rows.length === 0) return null;
  return toSyncJobRecord(rows[0]);
}

/**
 * Create a new sync job in pending state.
 *
 * Validates that no active job exists before creating.
 * Stores the preview data on the job for display during/after sync.
 */
export async function createSyncJob(preview: SyncPreview): Promise<SyncJobRecord> {
  // Check no active job exists
  const existing = await getCurrentSyncJob();
  if (existing) {
    throw new Error(
      `Cannot create sync job: an active job already exists (id=${existing.id}, stage=${existing.stage})`
    );
  }

  const [row] = await db
    .insert(syncJobs)
    .values({
      stage: 'pending',
      previewData: preview as any,
    })
    .returning();

  return toSyncJobRecord(row);
}

/**
 * Process a single batch of sync operations.
 *
 * This is the main entry point called by the client on each poll cycle.
 * It checks quota, routes to the appropriate stage executor, and returns
 * the updated job record. Each call processes up to batchSize operations.
 *
 * @param accessToken - OAuth 2.0 access token with youtube.force-ssl scope
 * @param batchSize - Maximum operations to process in this call (default 10)
 */
export async function processSyncBatch(
  accessToken: string,
  batchSize: number = 10
): Promise<SyncJobRecord | null> {
  const job = await getCurrentSyncJob();
  if (!job) return null;

  // Paused and failed jobs are not processed
  if (job.stage === 'paused' || job.stage === 'failed') {
    return job;
  }

  // Quota check before processing (except for non-API stages)
  if (job.stage !== 'pending' && job.stage !== 'backup') {
    const remaining = await getRemainingQuota();
    if (remaining < QUOTA_PAUSE_THRESHOLD) {
      return await pauseSyncJob(job.id, 'quota_exhausted');
    }
  }

  // Stage routing
  switch (job.stage) {
    case 'pending':
      await advanceStage(job.id, 'backup');
      return await getSyncJobById(job.id);

    case 'backup': {
      const snapshot = await createSnapshot('pre_sync');
      await db
        .update(syncJobs)
        .set({ backupSnapshotId: snapshot.snapshotId })
        .where(eq(syncJobs.id, job.id));
      await advanceStage(job.id, 'create_playlists');
      return await getSyncJobById(job.id);
    }

    case 'create_playlists':
      await executeCreatePlaylists(job, accessToken, batchSize);
      return await getSyncJobById(job.id);

    case 'add_videos':
      await executeAddVideos(job, accessToken, batchSize);
      return await getSyncJobById(job.id);

    case 'delete_playlists':
      await executeDeletePlaylists(job, accessToken, batchSize);
      return await getSyncJobById(job.id);

    default:
      return job;
  }
}

/**
 * Advance a sync job to the next stage.
 *
 * Resets progress counters for the new stage. If advancing to 'completed',
 * also sets the completedAt timestamp.
 */
export async function advanceStage(
  jobId: number,
  nextStage: SyncStage
): Promise<void> {
  const updates: Record<string, any> = {
    stage: nextStage,
    currentStageProgress: 0,
    currentStageTotal: 0,
  };

  if (nextStage === 'completed') {
    updates.completedAt = new Date();
  }

  await db
    .update(syncJobs)
    .set(updates)
    .where(eq(syncJobs.id, jobId));
}

/**
 * Pause a sync job with the given reason.
 *
 * Stores the current real stage in stageResults._pausedAtStage so that
 * resumeSyncJob knows which stage to return to.
 */
export async function pauseSyncJob(
  jobId: number,
  reason: PauseReason
): Promise<SyncJobRecord> {
  // Read current job to get the stage we are pausing from
  const current = await getSyncJobById(jobId);
  if (!current) throw new Error(`Sync job ${jobId} not found`);

  // Store the real stage in stageResults so resume knows where to go back
  const updatedResults = {
    ...current.stageResults,
    _pausedAtStage: current.stage,
  };

  await db
    .update(syncJobs)
    .set({
      stage: 'paused',
      pauseReason: reason,
      stageResults: updatedResults as any,
    })
    .where(eq(syncJobs.id, jobId));

  return (await getSyncJobById(jobId))!;
}

/**
 * Resume a paused sync job.
 *
 * Reads the real stage from stageResults._pausedAtStage and restores it.
 * Clears pauseReason and updates lastResumedAt.
 */
export async function resumeSyncJob(jobId: number): Promise<SyncJobRecord> {
  const job = await getSyncJobById(jobId);
  if (!job) throw new Error(`Sync job ${jobId} not found`);
  if (job.stage !== 'paused') {
    throw new Error(`Cannot resume job ${jobId}: stage is '${job.stage}', not 'paused'`);
  }

  // Read the real stage from stageResults
  const pausedAtStage = (job.stageResults as any)._pausedAtStage as SyncStage | undefined;
  if (!pausedAtStage) {
    throw new Error(`Cannot resume job ${jobId}: _pausedAtStage not found in stageResults`);
  }

  // Remove the _pausedAtStage helper from stageResults
  const cleanedResults = { ...job.stageResults };
  delete (cleanedResults as any)._pausedAtStage;

  await db
    .update(syncJobs)
    .set({
      stage: pausedAtStage,
      pauseReason: null,
      lastResumedAt: new Date(),
      stageResults: cleanedResults as any,
    })
    .where(eq(syncJobs.id, jobId));

  return (await getSyncJobById(jobId))!;
}

/**
 * Update progress counters for the current stage.
 * Optionally increments the total quota used this sync.
 */
export async function updateJobProgress(
  jobId: number,
  progress: number,
  total: number,
  quotaUsed?: number
): Promise<void> {
  if (quotaUsed) {
    await db
      .update(syncJobs)
      .set({
        currentStageProgress: progress,
        currentStageTotal: total,
        quotaUsedThisSync: sql`${syncJobs.quotaUsedThisSync} + ${quotaUsed}`,
      })
      .where(eq(syncJobs.id, jobId));
  } else {
    await db
      .update(syncJobs)
      .set({
        currentStageProgress: progress,
        currentStageTotal: total,
      })
      .where(eq(syncJobs.id, jobId));
  }
}

/**
 * Record an error on a sync job.
 * Appends the error to the existing errors JSONB array.
 */
export async function recordJobError(
  jobId: number,
  error: SyncError
): Promise<void> {
  const job = await getSyncJobById(jobId);
  if (!job) return;

  const updatedErrors = [...job.errors, error];

  await db
    .update(syncJobs)
    .set({ errors: updatedErrors as any })
    .where(eq(syncJobs.id, jobId));
}

/**
 * Update stage results for a specific stage.
 * Merges the new results into the existing stageResults JSONB.
 */
export async function updateStageResults(
  jobId: number,
  stage: string,
  results: { succeeded: number; failed: number; skipped: number }
): Promise<void> {
  const job = await getSyncJobById(jobId);
  if (!job) return;

  const updatedResults = {
    ...job.stageResults,
    [stage]: results,
  };

  await db
    .update(syncJobs)
    .set({ stageResults: updatedResults as any })
    .where(eq(syncJobs.id, jobId));
}
