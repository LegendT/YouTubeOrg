'use client';

import { useState, useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { SyncPreview as SyncPreviewComponent } from '@/components/sync/sync-preview';
import { SyncProgress } from '@/components/sync/sync-progress';
import { SyncReport } from '@/components/sync/sync-report';
import {
  startSync,
  pauseSync,
  resumeSync,
  getSyncPreview,
} from '@/app/actions/sync';
import type { SyncPreview, SyncJobRecord } from '@/types/sync';

interface SyncPageClientProps {
  initialPreview: SyncPreview | null;
  initialJob: SyncJobRecord | null;
  previewError?: string;
}

/**
 * Client orchestrator for the /sync page.
 *
 * Manages the full sync lifecycle:
 * - Preview view: shows SyncPreview with "Start Sync" button
 * - Progress view: shows SyncProgress with real-time polling and pause/resume
 * - Report view: shows SyncReport after completion with per-stage results
 * - Error view: when preview data cannot be loaded
 */
export function SyncPageClient({
  initialPreview,
  initialJob,
  previewError,
}: SyncPageClientProps) {
  const [currentJob, setCurrentJob] = useState<SyncJobRecord | null>(initialJob);
  const [preview, setPreview] = useState<SyncPreview | null>(initialPreview);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>(previewError);
  const router = useRouter();

  /**
   * Determine the current view based on job state.
   */
  function getView(): 'preview' | 'progress' | 'report' | 'error' {
    if (error) return 'error';

    if (currentJob) {
      const { stage } = currentJob;

      // Completed or failed with results -> show report
      if (stage === 'completed' || stage === 'failed') {
        return 'report';
      }

      // Active or paused -> show progress
      if (
        stage === 'pending' ||
        stage === 'backup' ||
        stage === 'create_playlists' ||
        stage === 'add_videos' ||
        stage === 'delete_playlists' ||
        stage === 'paused'
      ) {
        return 'progress';
      }
    }

    // No active job -> show preview
    return 'preview';
  }

  /**
   * Start a new sync.
   */
  function handleStartSync() {
    startTransition(async () => {
      setError(undefined);
      const result = await startSync();
      if (result.success && result.job) {
        setCurrentJob(result.job);
      } else {
        setError(result.error ?? 'Failed to start sync');
      }
    });
  }

  /**
   * Pause the running sync.
   */
  function handlePause() {
    startTransition(async () => {
      const result = await pauseSync();
      if (result.success && result.job) {
        setCurrentJob(result.job);
      }
    });
  }

  /**
   * Resume a paused sync.
   */
  function handleResume() {
    startTransition(async () => {
      const result = await resumeSync();
      if (result.success && result.job) {
        setCurrentJob(result.job);
      }
    });
  }

  /**
   * Receive updated job state from SyncProgress polling.
   */
  const handleJobUpdate = useCallback((updatedJob: SyncJobRecord) => {
    setCurrentJob(updatedJob);
  }, []);

  /**
   * Reset to preview state to start a new sync.
   */
  function handleStartNewSync() {
    startTransition(async () => {
      setCurrentJob(null);
      setError(undefined);
      // Re-fetch preview data
      const result = await getSyncPreview();
      if (result.success && result.preview) {
        setPreview(result.preview);
      } else {
        setError(result.error ?? 'Failed to load preview');
      }
    });
  }

  const view = getView();

  // Error state
  if (view === 'error') {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-6">
        <h2 className="text-lg font-medium text-destructive">Unable to Load Preview</h2>
        <p className="text-sm text-destructive/80 mt-1">{error}</p>
        <button
          onClick={() => {
            setError(undefined);
            router.refresh();
          }}
          className="mt-3 text-sm text-destructive hover:text-destructive/80 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  // Report view: completed or failed job
  if (view === 'report' && currentJob) {
    return (
      <SyncReport
        job={currentJob}
        onStartNewSync={handleStartNewSync}
      />
    );
  }

  // Progress view: active or paused job
  if (view === 'progress' && currentJob) {
    return (
      <SyncProgress
        job={currentJob}
        onPause={handlePause}
        onResume={handleResume}
        onJobUpdate={handleJobUpdate}
      />
    );
  }

  // No active job, no preview: empty state
  if (!preview) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm text-center">
        <h2 className="text-lg font-medium text-foreground">No Preview Available</h2>
        <p className="text-sm text-muted-foreground mt-1">
          There are no category assignments to synchronise. Assign videos to categories
          first, then return here to sync.
        </p>
      </div>
    );
  }

  // Default: show preview
  return (
    <SyncPreviewComponent
      preview={preview}
      onStartSync={handleStartSync}
      isStarting={isPending}
    />
  );
}
