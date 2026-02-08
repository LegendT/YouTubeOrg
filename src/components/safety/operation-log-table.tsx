'use client';

import { useState, useTransition } from 'react';
import { getOperationLog } from '@/app/actions/operation-log';
import type { OperationLogEntry } from '@/types/backup';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

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
  delete_category: 'bg-destructive/10 text-destructive',
  delete_backup: 'bg-destructive/10 text-destructive',
  merge_categories: 'bg-warning/10 text-warning',
  move_videos: 'bg-warning/10 text-warning',
  restore_backup: 'bg-info/10 text-info',
  create_backup: 'bg-success/10 text-success',
};

function ActionBadge({ action }: { action: string }) {
  const style = actionBadgeStyles[action] ?? 'bg-muted text-muted-foreground';
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
      <p className="text-sm text-muted-foreground">
        {total} operation{total === 1 ? '' : 's'} recorded
      </p>

      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-muted-foreground">No operations recorded yet. Actions like creating backups, restoring, and merging categories will appear here.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Timestamp
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Action
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Entity Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Details
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Linked Backup
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {entries.map((entry, i) => (
                <tr key={entry.id} className={i % 2 === 1 ? 'bg-muted/30' : 'hover:bg-muted/50'}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-foreground">
                    <span title={new Date(entry.createdAt).toLocaleString('en-GB')}>
                      {formatRelativeTime(entry.createdAt)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <ActionBadge action={entry.action} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-foreground">
                    {entry.entityType}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground max-w-xs truncate">
                    <span title={formatMetadata(entry.metadata)}>
                      {formatMetadata(entry.metadata) || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                    {entry.backupSnapshotId ? (
                      <span className="text-info">#{entry.backupSnapshotId}</span>
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
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={isPending}
          >
            {isPending ? (
              <Spinner size={16} />
            ) : null}
            Load More ({total - offset} remaining)
          </Button>
        </div>
      )}
    </div>
  );
}
