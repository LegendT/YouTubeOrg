'use client';

import type { PendingChangeSummary } from '@/types/backup';
import { Warning, CheckCircle, ArrowRight } from '@phosphor-icons/react';

const changeTypeStyles: Record<string, string> = {
  ml_accepted: 'text-success',
  ml_rejected: 'text-destructive',
  ml_recategorised: 'text-info',
  videos_moved: 'text-warning',
  videos_added: 'text-primary',
  category_created: 'text-success',
  category_deleted: 'text-destructive',
  category_renamed: 'text-info',
};

interface PendingChangesProps {
  initialSummary: PendingChangeSummary;
}

export function PendingChanges({ initialSummary }: PendingChangesProps) {
  const { changes, totalChanges, lastSyncTimestamp } = initialSummary;

  if (totalChanges === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <CheckCircle className="mx-auto h-10 w-10 text-success mb-3" />
        <p className="text-foreground font-medium">No pending changes</p>
        <p className="text-muted-foreground text-sm mt-1">
          Your YouTube playlists are up to date.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="rounded-lg border border-warning/20 bg-warning/10 p-4">
        <div className="flex items-start gap-3">
          <Warning className="h-5 w-5 text-warning mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-warning">
              {totalChanges} pending change{totalChanges === 1 ? '' : 's'}
            </p>
            <p className="text-sm text-warning/80 mt-1">
              These changes will be synced to YouTube when batch sync is available.
            </p>
            {lastSyncTimestamp && (
              <p className="text-xs text-warning/70 mt-1">
                Last synced: {new Date(lastSyncTimestamp).toLocaleString('en-GB')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Changes breakdown */}
      <div className="rounded-lg border border-border bg-card divide-y divide-border">
        {changes.map((change, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <ArrowRight className={`h-4 w-4 flex-shrink-0 ${changeTypeStyles[change.type] ?? 'text-muted-foreground'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">{change.description}</p>
            </div>
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {change.count}
            </span>
          </div>
        ))}
      </div>

      {/* Future-ready note */}
      <p className="text-xs text-muted-foreground/60 text-center">
        Sync operations will be available in a future update.
      </p>
    </div>
  );
}
