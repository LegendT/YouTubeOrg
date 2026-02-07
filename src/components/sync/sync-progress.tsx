'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  CheckCircle2,
  Circle,
  Loader2,
  Pause,
  Play,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  XCircle,
} from 'lucide-react';
import { runSyncBatch, getSyncProgress } from '@/app/actions/sync';
import { STAGE_LABELS } from '@/types/sync';
import type { SyncJobRecord, SyncStage, SyncError } from '@/types/sync';

interface SyncProgressProps {
  job: SyncJobRecord;
  onPause: () => void;
  onResume: () => void;
  onJobUpdate: (job: SyncJobRecord) => void;
}

/**
 * The four processing stages in pipeline order.
 */
const PIPELINE_STAGES: SyncStage[] = [
  'backup',
  'create_playlists',
  'add_videos',
  'delete_playlists',
];

/**
 * Pipeline stage display labels (shorter than STAGE_LABELS for the pipeline).
 */
const PIPELINE_LABELS: Record<string, string> = {
  backup: 'Backup',
  create_playlists: 'Create Playlists',
  add_videos: 'Add Videos',
  delete_playlists: 'Delete Playlists',
};

/**
 * Determine which stages are completed, current, and future
 * based on the current job stage.
 */
function getStageStatus(
  jobStage: SyncStage,
  pipelineStage: SyncStage
): 'completed' | 'current' | 'future' {
  const currentIdx = PIPELINE_STAGES.indexOf(jobStage);
  const stageIdx = PIPELINE_STAGES.indexOf(pipelineStage);

  // If the job is in a terminal state (completed, failed) or paused,
  // we need to check stageResults to determine what's completed.
  // For active stages, use index comparison.
  if (currentIdx === -1) {
    // Terminal or paused -- handled by parent
    return 'future';
  }
  if (stageIdx < currentIdx) return 'completed';
  if (stageIdx === currentIdx) return 'current';
  return 'future';
}

/**
 * Active processing stages (can run batches).
 */
const ACTIVE_STAGES: SyncStage[] = [
  'pending',
  'backup',
  'create_playlists',
  'add_videos',
  'delete_playlists',
];

/**
 * Format a count for display (e.g., 1234 -> "1,234").
 */
function formatNumber(n: number): string {
  return n.toLocaleString();
}

/**
 * Summarise stage results for the pipeline display.
 */
function stageResultSummary(
  stage: string,
  stageResults: SyncJobRecord['stageResults']
): string | null {
  const result = stageResults[stage];
  if (!result) return null;

  const total = result.succeeded + result.failed + result.skipped;
  if (result.failed > 0) {
    return `${result.succeeded}/${total} (${result.failed} failed)`;
  }
  return `${result.succeeded}/${total}`;
}

/**
 * Expandable error list grouped by stage.
 */
function ErrorSummary({ errors }: { errors: SyncError[] }) {
  const [expanded, setExpanded] = useState(false);

  if (errors.length === 0) return null;

  // Group by stage
  const byStage = errors.reduce<Record<string, SyncError[]>>((acc, err) => {
    const key = err.stage;
    if (!acc[key]) acc[key] = [];
    acc[key].push(err);
    return acc;
  }, {});

  return (
    <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm font-medium text-red-800 w-full"
      >
        <AlertTriangle className="h-4 w-4" />
        <span>{errors.length} error{errors.length !== 1 ? 's' : ''} collected</span>
        <span className="ml-auto">
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </span>
      </button>
      {expanded && (
        <div className="mt-3 space-y-3">
          {Object.entries(byStage).map(([stage, stageErrors]) => (
            <div key={stage}>
              <h4 className="text-xs font-medium text-red-700 uppercase tracking-wider mb-1">
                {PIPELINE_LABELS[stage] ?? stage} ({stageErrors.length})
              </h4>
              <ul className="space-y-1">
                {stageErrors.map((err, i) => (
                  <li key={i} className="text-sm text-red-700 pl-3 border-l-2 border-red-200">
                    <span className="font-medium">{err.entityType}</span>{' '}
                    <span className="text-red-500">{err.entityId}</span>:{' '}
                    {err.message}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * SyncProgress displays real-time sync progress with a polling loop
 * that processes batches and updates the UI every 3 seconds.
 *
 * Handles active, paused, and failed states with appropriate UI
 * and controls (pause/resume buttons).
 */
export function SyncProgress({ job, onPause, onResume, onJobUpdate }: SyncProgressProps) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isPausing, setIsPausing] = useState(false);
  const [isResuming, setIsResuming] = useState(false);

  // Track the latest job in a ref so the interval callback always has current data
  const jobRef = useRef(job);
  jobRef.current = job;

  const isActive = ACTIVE_STAGES.includes(job.stage);
  const isPaused = job.stage === 'paused';
  const isFailed = job.stage === 'failed';

  /**
   * Polling callback: process a batch, then fetch updated state.
   */
  const pollAndProcess = useCallback(async () => {
    const currentJob = jobRef.current;

    // Don't process if job is no longer active
    if (!ACTIVE_STAGES.includes(currentJob.stage)) return;

    try {
      // Process a batch of up to 10 operations
      await runSyncBatch();

      // Fetch the updated job state
      const result = await getSyncProgress();
      if (result.success && result.job) {
        onJobUpdate(result.job);
      }
    } catch {
      // Network errors etc. -- just skip this tick, retry next interval
    }
  }, [onJobUpdate]);

  /**
   * Set up polling interval when the job is in an active stage.
   */
  useEffect(() => {
    if (isActive) {
      // Run immediately on mount/transition to active
      pollAndProcess();

      intervalRef.current = setInterval(pollAndProcess, 3000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, pollAndProcess]);

  /**
   * Handle pause button click.
   */
  async function handlePause() {
    setIsPausing(true);
    try {
      onPause();
    } finally {
      setIsPausing(false);
    }
  }

  /**
   * Handle resume button click.
   */
  async function handleResume() {
    setIsResuming(true);
    try {
      onResume();
    } finally {
      setIsResuming(false);
    }
  }

  // Calculate progress percentage
  const progressPercent =
    job.currentStageTotal > 0
      ? Math.round((job.currentStageProgress / job.currentStageTotal) * 100)
      : 0;

  // Determine what stage the job was in before pausing
  // (for showing pipeline state when paused)
  const effectiveStage: SyncStage = isPaused || isFailed
    ? (() => {
        // Find the last completed stage from stageResults,
        // the next one is where we paused
        for (let i = PIPELINE_STAGES.length - 1; i >= 0; i--) {
          const stage = PIPELINE_STAGES[i];
          const result = job.stageResults[stage];
          if (result && (result.succeeded + result.failed + result.skipped) > 0) {
            // If this stage has results, it was at least started
            // Check if it's complete (all items processed)
            if (i < PIPELINE_STAGES.length - 1) {
              // If a later stage has no results, we paused at this stage or the next
              const nextStage = PIPELINE_STAGES[i + 1];
              const nextResult = job.stageResults[nextStage];
              if (!nextResult) return stage;
            }
            return stage;
          }
        }
        return PIPELINE_STAGES[0]; // Default to backup
      })()
    : job.stage;

  return (
    <div className="space-y-6">
      {/* Current Stage Card */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        {/* Active state header */}
        {isActive && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-400 animate-pulse" />
              <h2 className="text-lg font-medium text-gray-900">
                {STAGE_LABELS[job.stage]}
              </h2>
            </div>

            {/* Backup stage: spinner only, no count */}
            {job.stage === 'backup' ? (
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <span>Creating pre-sync backup...</span>
              </div>
            ) : (
              /* Other stages: progress bar with count */
              <div>
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>
                    {STAGE_LABELS[job.stage]}:{' '}
                    {formatNumber(job.currentStageProgress)} / {formatNumber(job.currentStageTotal)}
                  </span>
                  <span className="font-medium">{progressPercent}%</span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {/* Paused state */}
        {isPaused && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <Pause className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-medium text-gray-900">Sync Paused</h2>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
              {job.pauseReason === 'quota_exhausted' && (
                <p>
                  Sync paused — daily quota exhausted. The quota resets at midnight
                  Pacific Time. Come back tomorrow to resume.
                </p>
              )}
              {job.pauseReason === 'user_paused' && (
                <p>Sync paused by you.</p>
              )}
              {job.pauseReason === 'errors_collected' && (
                <p>Sync paused — errors encountered. Review errors below.</p>
              )}
              {!job.pauseReason && (
                <p>Sync is paused.</p>
              )}
            </div>
          </>
        )}

        {/* Failed state */}
        {isFailed && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <XCircle className="h-5 w-5 text-red-500" />
              <h2 className="text-lg font-medium text-red-900">Sync Failed</h2>
            </div>
            <p className="text-sm text-red-700">
              The sync operation encountered a fatal error and could not continue.
            </p>
          </>
        )}
      </div>

      {/* Stage Pipeline */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">
          Pipeline Stages
        </h3>
        <div className="space-y-3">
          {PIPELINE_STAGES.map((stage) => {
            const status = isPaused || isFailed
              ? (() => {
                  const effIdx = PIPELINE_STAGES.indexOf(effectiveStage);
                  const stageIdx = PIPELINE_STAGES.indexOf(stage);
                  if (stageIdx < effIdx) return 'completed' as const;
                  if (stageIdx === effIdx) return 'current' as const;
                  return 'future' as const;
                })()
              : getStageStatus(job.stage, stage);

            const resultSummary = stageResultSummary(stage, job.stageResults);

            return (
              <div
                key={stage}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 ${
                  status === 'current'
                    ? 'bg-blue-50 border border-blue-200'
                    : status === 'completed'
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-gray-50 border border-gray-100'
                }`}
              >
                {/* Stage icon */}
                {status === 'completed' && (
                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                )}
                {status === 'current' && (
                  isActive ? (
                    <Loader2 className="h-5 w-5 text-blue-600 animate-spin flex-shrink-0" />
                  ) : isPaused ? (
                    <Pause className="h-5 w-5 text-amber-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                  )
                )}
                {status === 'future' && (
                  <Circle className="h-5 w-5 text-gray-300 flex-shrink-0" />
                )}

                {/* Stage label */}
                <span
                  className={`text-sm font-medium flex-1 ${
                    status === 'current'
                      ? 'text-blue-800'
                      : status === 'completed'
                        ? 'text-green-800'
                        : 'text-gray-400'
                  }`}
                >
                  {PIPELINE_LABELS[stage]}
                </span>

                {/* Stage result summary */}
                {resultSummary && (
                  <span
                    className={`text-sm ${
                      status === 'completed' ? 'text-green-600' : 'text-gray-500'
                    }`}
                  >
                    {resultSummary}
                  </span>
                )}

                {/* Current stage progress */}
                {status === 'current' && isActive && job.currentStageTotal > 0 && stage !== 'backup' && (
                  <span className="text-sm text-blue-600">
                    {formatNumber(job.currentStageProgress)}/{formatNumber(job.currentStageTotal)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats Row */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Quota used this sync</span>
          <span className="font-medium text-gray-900">
            {formatNumber(job.quotaUsedThisSync)} units
          </span>
        </div>
      </div>

      {/* Error Summary (for paused with errors or failed) */}
      {(isPaused || isFailed) && job.errors.length > 0 && (
        <ErrorSummary errors={job.errors} />
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        {isActive && (
          <button
            onClick={handlePause}
            disabled={isPausing}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-amber-600 transition-colors disabled:opacity-50"
          >
            {isPausing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Pause className="h-4 w-4" />
            )}
            Pause Sync
          </button>
        )}

        {isPaused && (
          <button
            onClick={handleResume}
            disabled={isResuming}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isResuming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Resume Sync
          </button>
        )}
      </div>
    </div>
  );
}
