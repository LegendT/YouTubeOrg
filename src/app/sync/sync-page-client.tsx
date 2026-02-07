'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { SyncPreview as SyncPreviewComponent } from '@/components/sync/sync-preview';
import { startSync } from '@/app/actions/sync';
import { STAGE_LABELS } from '@/types/sync';
import type { SyncPreview, SyncJobRecord } from '@/types/sync';

interface SyncPageClientProps {
  initialPreview: SyncPreview | null;
  initialJob: SyncJobRecord | null;
  previewError?: string;
}

/**
 * Client wrapper for the sync page.
 *
 * Manages local state transitions:
 * - Preview view: shows SyncPreview component with "Start Sync" button
 * - Progress view: placeholder for active sync (built in 08-04)
 * - Error view: when preview data cannot be loaded
 */
export function SyncPageClient({
  initialPreview,
  initialJob,
  previewError,
}: SyncPageClientProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleStartSync() {
    startTransition(async () => {
      const result = await startSync();
      if (result.success) {
        // Refresh the page to transition to the progress view
        router.refresh();
      } else {
        // Show error -- for now alert, will be refined in 08-04
        alert(result.error ?? 'Failed to start sync');
      }
    });
  }

  // Error state: preview could not be loaded
  if (previewError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <h2 className="text-lg font-medium text-red-800">Unable to Load Preview</h2>
        <p className="text-sm text-red-700 mt-1">{previewError}</p>
        <button
          onClick={() => router.refresh()}
          className="mt-3 text-sm text-red-600 hover:text-red-800 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  // Active job: show progress placeholder (full progress UI in 08-04)
  if (initialJob) {
    const stageLabel = STAGE_LABELS[initialJob.stage] ?? initialJob.stage;
    const isPaused = initialJob.stage === 'paused';
    const pauseLabel = initialJob.pauseReason === 'quota_exhausted'
      ? 'Quota exhausted -- resume when daily quota resets'
      : initialJob.pauseReason === 'user_paused'
        ? 'Paused by you'
        : initialJob.pauseReason === 'errors_collected'
          ? 'Paused -- errors collected for review'
          : '';

    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-medium text-gray-900">Sync In Progress</h2>
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${
              isPaused ? 'bg-amber-400' : 'bg-green-400 animate-pulse'
            }`} />
            <span className="text-sm font-medium text-gray-700">{stageLabel}</span>
          </div>

          {initialJob.currentStageTotal > 0 && (
            <div>
              <div className="flex justify-between text-sm text-gray-500 mb-1">
                <span>Progress</span>
                <span>
                  {initialJob.currentStageProgress} / {initialJob.currentStageTotal}
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{
                    width: `${Math.round(
                      (initialJob.currentStageProgress / initialJob.currentStageTotal) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}

          {isPaused && pauseLabel && (
            <p className="text-sm text-amber-700">{pauseLabel}</p>
          )}

          <p className="text-xs text-gray-400">
            Quota used this sync: {initialJob.quotaUsedThisSync.toLocaleString()} units
          </p>
        </div>
        <p className="mt-4 text-sm text-gray-500">
          Full progress controls will be available in the next update.
        </p>
      </div>
    );
  }

  // No active job, no preview: empty state
  if (!initialPreview) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm text-center">
        <h2 className="text-lg font-medium text-gray-900">No Preview Available</h2>
        <p className="text-sm text-gray-500 mt-1">
          There are no category assignments to synchronise. Assign videos to categories
          first, then return here to sync.
        </p>
      </div>
    );
  }

  // Default: show preview
  return (
    <SyncPreviewComponent
      preview={initialPreview}
      onStartSync={handleStartSync}
      isStarting={isPending}
    />
  );
}
