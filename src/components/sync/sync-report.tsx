'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Shield,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
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
    <div className="rounded-lg border border-red-200 bg-white shadow-sm overflow-hidden">
      <div className="px-6 py-4 bg-red-50 border-b border-red-200">
        <h3 className="text-sm font-medium text-red-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          {errors.length} Error{errors.length !== 1 ? 's' : ''} Encountered
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Stage
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Entity ID
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Error Message
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Time
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {visibleErrors.map((err, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-4 py-2 text-sm text-gray-700">
                  {REPORT_STAGE_LABELS[err.stage] ?? err.stage}
                </td>
                <td className="px-4 py-2 text-sm text-gray-600 capitalize">
                  {err.entityType}
                </td>
                <td className="px-4 py-2 text-sm text-gray-500 font-mono text-xs">
                  {err.entityId}
                </td>
                <td className="px-4 py-2 text-sm text-red-700 max-w-xs truncate">
                  {err.message}
                </td>
                <td className="px-4 py-2 text-sm text-gray-400 whitespace-nowrap">
                  {formatDate(err.timestamp)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hiddenCount > 0 && (
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                Show fewer errors
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
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
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          {hasErrors ? (
            <AlertTriangle className="h-7 w-7 text-amber-500" />
          ) : (
            <CheckCircle2 className="h-7 w-7 text-green-600" />
          )}
          <h2 className="text-xl font-semibold text-gray-900">
            {hasErrors ? 'Sync Finished with Errors' : 'Sync Complete'}
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
          <div>
            <span className="text-gray-500">Started:</span>{' '}
            {formatDate(job.startedAt)}
          </div>
          {job.completedAt && (
            <div>
              <span className="text-gray-500">Completed:</span>{' '}
              {formatDate(job.completedAt)}
            </div>
          )}
          {job.completedAt && (
            <div>
              <span className="text-gray-500">Duration:</span>{' '}
              {formatDuration(job.startedAt, job.completedAt)}
            </div>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm text-centre">
          <p className="text-2xl font-bold text-gray-900">
            {formatNumber(job.quotaUsedThisSync)}
          </p>
          <p className="text-sm text-gray-500">Total quota used</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm text-centre">
          <p className="text-2xl font-bold text-gray-900">
            {formatNumber(totalOperations)}
          </p>
          <p className="text-sm text-gray-500">Total operations</p>
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
              className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
            >
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                {REPORT_STAGE_LABELS[stage]}
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-green-700">Succeeded</span>
                  <span className="font-medium text-green-700">{formatNumber(succeeded)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-red-600">Failed</span>
                  <span className="font-medium text-red-600">{formatNumber(failed)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Skipped</span>
                  <span className="font-medium text-gray-400">{formatNumber(skipped)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Errors Section */}
      {hasErrors && <ErrorTable errors={job.errors} />}

      {/* Watch Later Notice */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex gap-3">
          <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-blue-800">Watch Later</h4>
            <p className="text-sm text-blue-700 mt-0.5">
              Watch Later videos cannot be removed via the YouTube API (deprecated since 2020).
              After sync completes, you can manually remove categorised videos from Watch Later
              through the YouTube interface.
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-6">
        <button
          onClick={onStartNewSync}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Start New Sync
        </button>
        <Link
          href="/safety"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <Shield className="h-4 w-4" />
          Review Backups
        </Link>
      </div>
    </div>
  );
}
