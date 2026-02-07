'use client';

import { useState, useTransition } from 'react';
import { getOperationLog } from '@/app/actions/operation-log';
import type { OperationLogEntry } from '@/types/backup';
import { Loader2 } from 'lucide-react';

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  return new Date(date).toLocaleDateString('en-GB');
}

const actionBadgeStyles: Record<string, string> = {
  delete_category: 'bg-red-100 text-red-800',
  delete_backup: 'bg-red-100 text-red-800',
  merge_categories: 'bg-amber-100 text-amber-800',
  move_videos: 'bg-amber-100 text-amber-800',
  restore_backup: 'bg-blue-100 text-blue-800',
  create_backup: 'bg-green-100 text-green-800',
};

function ActionBadge({ action }: { action: string }) {
  const style = actionBadgeStyles[action] ?? 'bg-gray-100 text-gray-800';
  const label = action.replace(/_/g, ' ');
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}

function formatMetadata(metadata: Record<string, unknown> | null): string {
  if (!metadata) return '';
  const entries = Object.entries(metadata)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}: ${value.length} items`;
      }
      return `${key}: ${String(value)}`;
    });
  return entries.join(', ');
}

const PAGE_SIZE = 20;

interface OperationLogTableProps {
  initialEntries: OperationLogEntry[];
  initialTotal: number;
}

export function OperationLogTable({ initialEntries, initialTotal }: OperationLogTableProps) {
  const [entries, setEntries] = useState<OperationLogEntry[]>(initialEntries);
  const [total, setTotal] = useState(initialTotal);
  const [offset, setOffset] = useState(initialEntries.length);
  const [isPending, startTransition] = useTransition();

  const hasMore = offset < total;

  function handleLoadMore() {
    startTransition(async () => {
      const result = await getOperationLog(PAGE_SIZE, offset);
      setEntries((prev) => [...prev, ...result.entries]);
      setTotal(result.total);
      setOffset((prev) => prev + result.entries.length);
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        {total} operation{total === 1 ? '' : 's'} recorded
      </p>

      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
          <p className="text-gray-500">No operations recorded yet. Actions like creating backups, restoring, and merging categories will appear here.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Timestamp
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Action
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Entity Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Details
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Linked Backup
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                    <span title={new Date(entry.createdAt).toLocaleString('en-GB')}>
                      {formatRelativeTime(entry.createdAt)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <ActionBadge action={entry.action} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                    {entry.entityType}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                    <span title={formatMetadata(entry.metadata)}>
                      {formatMetadata(entry.metadata) || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {entry.backupSnapshotId ? (
                      <span className="text-blue-600">#{entry.backupSnapshotId}</span>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center">
          <button
            onClick={handleLoadMore}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Load More ({total - offset} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
