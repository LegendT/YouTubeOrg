'use client';

import type { PendingChangeSummary } from '@/types/backup';
import { AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';

const changeTypeIcons: Record<string, string> = {
  ml_accepted: 'text-green-600',
  ml_rejected: 'text-red-600',
  ml_recategorised: 'text-blue-600',
  videos_moved: 'text-amber-600',
  videos_added: 'text-purple-600',
  category_created: 'text-green-600',
  category_deleted: 'text-red-600',
  category_renamed: 'text-blue-600',
};

interface PendingChangesProps {
  initialSummary: PendingChangeSummary;
}

export function PendingChanges({ initialSummary }: PendingChangesProps) {
  const { changes, totalChanges, lastSyncTimestamp } = initialSummary;

  if (totalChanges === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-green-500 mb-3" />
        <p className="text-gray-700 font-medium">No pending changes</p>
        <p className="text-gray-500 text-sm mt-1">
          Your YouTube playlists are up to date.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-amber-800">
              {totalChanges} pending change{totalChanges === 1 ? '' : 's'}
            </p>
            <p className="text-sm text-amber-700 mt-1">
              These changes will be synced to YouTube when batch sync is available.
            </p>
            {lastSyncTimestamp && (
              <p className="text-xs text-amber-600 mt-1">
                Last synced: {new Date(lastSyncTimestamp).toLocaleString('en-GB')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Changes breakdown */}
      <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-200">
        {changes.map((change, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <ArrowRight className={`h-4 w-4 flex-shrink-0 ${changeTypeIcons[change.type] ?? 'text-gray-400'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-800">{change.description}</p>
            </div>
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
              {change.count}
            </span>
          </div>
        ))}
      </div>

      {/* Future-ready note */}
      <p className="text-xs text-gray-400 text-center">
        Sync operations will be available in a future update.
      </p>
    </div>
  );
}
