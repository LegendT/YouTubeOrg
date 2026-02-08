'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle,
  Warning,
  ArrowsClockwise,
  Shield,
  Info,
  CaretDown,
  CaretUp,
} from '@phosphor-icons/react';
import type { SyncJobRecord, SyncError } from '@/types/sync';

interface SyncReportProps {
  job: SyncJobRecord;
  onStartNewSync: () => void;
}

/**
 * Stage display labels for report cards.
 */
const REPORT_STAGE_LABELS: Record<string, string> = {
  create_playlists: 'Create Playlists',
  add_videos: 'Add Videos',
  delete_playlists: 'Delete Playlists',
};

/**
 * Format a number with locale separators.
 */
function formatNumber(n: number): string {
  return n.toLocaleString();
}

/**
 * Format a Date into a readable string (e.g., "7 Feb 2026, 10:35 PM").
 */
function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Calculate human-readable duration between two dates.
 */
function formatDuration(start: Date | string, end: Date | string): string {
  const startMs = typeof start === 'string' ? new Date(start).getTime() : start.getTime();
  const endMs = typeof end === 'string' ? new Date(end).getTime() : end.getTime();
  const diffMs = endMs - startMs;

  if (diffMs < 0) return '0 seconds';

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    return remainingHours > 0
      ? `${days} day${days !== 1 ? 's' : ''}, ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`
      : `${days} day${days !== 1 ? 's' : ''}`;
  }
  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0
      ? `${hours} hour${hours !== 1 ? 's' : ''}, ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`
      : `${hours} hour${hours !== 1 ? 's' : ''}`;
  }
  if (minutes > 0) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  return `${seconds} second${seconds !== 1 ? 's' : ''}`;
}

/**
 * Expandable error table.
 */
function ErrorTable({ errors }: { errors: SyncError[] }) {
  const [expanded, setExpanded] = useState(false);
  const VISIBLE_COUNT = 10;

  if (errors.length === 0) return null;

  const visibleErrors = expanded ? errors : errors.slice(0, VISIBLE_COUNT);
  const hiddenCount = errors.length - VISIBLE_COUNT;

  return (
    <div className="rounded-lg border border-destructive/20 bg-card shadow-sm overflow-hidden">
      <div className="px-6 py-4 bg-destructive/10 border-b border-destructive/20">
        <h3 className="text-sm font-medium text-destructive flex items-center gap-2">
          <Warning className="h-4 w-4" />
          {errors.length} Error{errors.length !== 1 ? 's' : ''} Encountered
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Stage
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Type
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Entity ID
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Error Message
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Time
              </th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {visibleErrors.map((err, i) => (
              <tr key={i} className="hover:bg-muted/50">
                <td className="px-4 py-2 text-sm text-foreground">
                  {REPORT_STAGE_LABELS[err.stage] ?? err.stage}
                </td>
                <td className="px-4 py-2 text-sm text-muted-foreground capitalize">
                  {err.entityType}
                </td>
                <td className="px-4 py-2 text-sm text-muted-foreground font-mono text-xs">
                  {err.entityId}
                </td>
                <td className="px-4 py-2 text-sm text-destructive max-w-xs truncate">
                  {err.message}
                </td>
                <td className="px-4 py-2 text-sm text-muted-foreground/60 whitespace-nowrap">
                  {formatDate(err.timestamp)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hiddenCount > 0 && (
        <div className="px-6 py-3 bg-muted border-t border-border">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
          >
            {expanded ? (
              <>
                <CaretUp className="h-3.5 w-3.5" />
                Show fewer errors
              </>
            ) : (
              <>
                <CaretDown className="h-3.5 w-3.5" />
                Show all {errors.length} errors
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * SyncReport displays a detailed completion summary after a sync job
 * finishes. Shows per-stage success/failure/skipped counts, total
 * quota used, duration, and any errors that occurred.
 */
export function SyncReport({ job, onStartNewSync }: SyncReportProps) {
  const hasErrors = job.errors.length > 0;

  // Calculate totals from stageResults
  const stages = ['create_playlists', 'add_videos', 'delete_playlists'] as const;
  let totalSucceeded = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const stage of stages) {
    const result = job.stageResults[stage];
    if (result) {
      totalSucceeded += result.succeeded;
      totalFailed += result.failed;
      totalSkipped += result.skipped;
    }
  }

  const totalOperations = totalSucceeded + totalFailed + totalSkipped;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          {hasErrors ? (
            <Warning className="h-7 w-7 text-warning" />
          ) : (
            <CheckCircle className="h-7 w-7 text-success" />
          )}
          <h2 className="text-xl font-semibold text-foreground">
            {hasErrors ? 'Sync Finished with Errors' : 'Sync Complete'}
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
          <div>
            <span className="text-muted-foreground/60">Started:</span>{' '}
            {formatDate(job.startedAt)}
          </div>
          {job.completedAt && (
            <div>
              <span className="text-muted-foreground/60">Completed:</span>{' '}
              {formatDate(job.completedAt)}
            </div>
          )}
          {job.completedAt && (
            <div>
              <span className="text-muted-foreground/60">Duration:</span>{' '}
              {formatDuration(job.startedAt, job.completedAt)}
            </div>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm text-centre">
          <p className="text-2xl font-bold text-foreground">
            {formatNumber(job.quotaUsedThisSync)}
          </p>
          <p className="text-sm text-muted-foreground">Total quota used</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm text-centre">
          <p className="text-2xl font-bold text-foreground">
            {formatNumber(totalOperations)}
          </p>
          <p className="text-sm text-muted-foreground">Total operations</p>
        </div>
      </div>

      {/* Per-Stage Results Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stages.map((stage) => {
          const result = job.stageResults[stage];
          const succeeded = result?.succeeded ?? 0;
          const failed = result?.failed ?? 0;
          const skipped = result?.skipped ?? 0;

          return (
            <div
              key={stage}
              className="rounded-lg border border-border bg-card p-5 shadow-sm"
            >
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                {REPORT_STAGE_LABELS[stage]}
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-success">Succeeded</span>
                  <span className="font-medium text-success">{formatNumber(succeeded)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-destructive">Failed</span>
                  <span className="font-medium text-destructive">{formatNumber(failed)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground/60">Skipped</span>
                  <span className="font-medium text-muted-foreground/60">{formatNumber(skipped)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Errors Section */}
      {hasErrors && <ErrorTable errors={job.errors} />}

      {/* Watch Later Notice */}
      <div className="rounded-lg border border-warning/20 bg-warning/10 p-4">
        <div className="flex gap-3">
          <Info className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-warning">Watch Later</h4>
            <p className="text-sm text-warning/80 mt-0.5">
              Watch Later videos cannot be removed via the YouTube API (deprecated since 2020).
              After sync completes, you can manually remove categorised videos from Watch Later
              through the YouTube interface.
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 border-t border-border pt-6">
        <button
          onClick={onStartNewSync}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
        >
          <ArrowsClockwise className="h-4 w-4" />
          Start New Sync
        </button>
        <Link
          href="/safety"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground shadow-sm hover:bg-muted transition-colors"
        >
          <Shield className="h-4 w-4" />
          Review Backups
        </Link>
      </div>
    </div>
  );
}
