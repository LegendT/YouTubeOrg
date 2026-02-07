'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/config';
import { computeSyncPreview } from '@/lib/sync/preview';
import {
  createSyncJob,
  processSyncBatch,
  pauseSyncJob,
  resumeSyncJob,
  getCurrentSyncJob,
} from '@/lib/sync/engine';
import type { SyncPreview, SyncJobRecord } from '@/types/sync';

/**
 * Sync Server Actions
 *
 * Bridge between the sync engine and the UI. All actions check authentication
 * and return structured responses (never throw). State-changing actions
 * revalidate /sync.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAccessToken(): Promise<
  | { success: true; accessToken: string }
  | { success: false; error: string }
> {
  const session = await auth();
  if (!session?.access_token) {
    return { success: false, error: 'Not authenticated' };
  }
  return { success: true, accessToken: session.access_token };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Fetch the sync preview: operation counts, quota costs, estimated days.
 *
 * Used by the /sync page to display what will happen before the user commits.
 */
export async function getSyncPreview(): Promise<{
  success: boolean;
  preview?: SyncPreview;
  error?: string;
}> {
  const authResult = await getAccessToken();
  if (!authResult.success) return authResult;

  try {
    const preview = await computeSyncPreview();
    return { success: true, preview };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to compute sync preview: ${message}` };
  }
}

/**
 * Start a new sync operation.
 *
 * Computes a fresh preview, creates a sync job in pending state, and returns it.
 * Fails if an active sync job already exists.
 */
export async function startSync(): Promise<{
  success: boolean;
  job?: SyncJobRecord;
  error?: string;
}> {
  const authResult = await getAccessToken();
  if (!authResult.success) return authResult;

  try {
    // Check no active sync job exists
    const existing = await getCurrentSyncJob();
    if (existing) {
      return { success: false, error: 'A sync operation is already in progress' };
    }

    // Compute fresh preview and create job
    const preview = await computeSyncPreview();
    const job = await createSyncJob(preview);

    revalidatePath('/sync');
    return { success: true, job };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to start sync: ${message}` };
  }
}

/**
 * Resume a paused sync job.
 *
 * Restores the job to its pre-pause stage and clears the pause reason.
 */
export async function resumeSync(): Promise<{
  success: boolean;
  job?: SyncJobRecord;
  error?: string;
}> {
  const authResult = await getAccessToken();
  if (!authResult.success) return authResult;

  try {
    const current = await getCurrentSyncJob();
    if (!current || current.stage !== 'paused') {
      return { success: false, error: 'No paused sync job to resume' };
    }

    const job = await resumeSyncJob(current.id);

    revalidatePath('/sync');
    return { success: true, job };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to resume sync: ${message}` };
  }
}

/**
 * Pause the current sync job.
 *
 * Only works if the job is in an active processing stage
 * (backup, create_playlists, add_videos, delete_playlists).
 */
export async function pauseSync(): Promise<{
  success: boolean;
  job?: SyncJobRecord;
  error?: string;
}> {
  const authResult = await getAccessToken();
  if (!authResult.success) return authResult;

  try {
    const current = await getCurrentSyncJob();
    const activeStages = ['pending', 'backup', 'create_playlists', 'add_videos', 'delete_playlists'];

    if (!current || !activeStages.includes(current.stage)) {
      return { success: false, error: 'No active sync job to pause' };
    }

    const job = await pauseSyncJob(current.id, 'user_paused');

    revalidatePath('/sync');
    return { success: true, job };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to pause sync: ${message}` };
  }
}

/**
 * Get the current sync job progress.
 *
 * Returns the most recent non-terminal sync job, or null if no active job.
 * The client uses this for polling progress updates.
 */
export async function getSyncProgress(): Promise<{
  success: boolean;
  job?: SyncJobRecord | null;
  error?: string;
}> {
  const authResult = await getAccessToken();
  if (!authResult.success) return authResult;

  try {
    const job = await getCurrentSyncJob();
    return { success: true, job: job ?? null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to get sync progress: ${message}` };
  }
}

/**
 * Process a single batch of sync operations.
 *
 * This is the "fire-and-process" action called repeatedly by the client.
 * Each call processes up to 10 API operations (500 quota units max) and
 * returns the updated job. The client then calls getSyncProgress() to
 * display the state and calls runSyncBatch() again if the job is still active.
 */
export async function runSyncBatch(): Promise<{
  success: boolean;
  job?: SyncJobRecord | null;
  error?: string;
}> {
  const authResult = await getAccessToken();
  if (!authResult.success) return authResult;

  try {
    // Check there is an active job to process
    const current = await getCurrentSyncJob();
    if (!current) {
      return { success: false, error: 'No active sync job' };
    }

    // Paused, completed, and failed jobs cannot be processed
    if (current.stage === 'paused' || current.stage === 'completed' || current.stage === 'failed') {
      return { success: false, error: 'No active sync job' };
    }

    const job = await processSyncBatch(authResult.accessToken, 10);

    revalidatePath('/sync');
    return { success: true, job };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to process sync batch: ${message}` };
  }
}
