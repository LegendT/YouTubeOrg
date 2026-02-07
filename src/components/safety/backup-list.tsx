'use client';

import { useState, useTransition } from 'react';
import {
  createManualBackup,
  listBackups,
  restoreBackup,
  deleteBackup,
} from '@/app/actions/backup';
import type { BackupSnapshotMeta } from '@/types/backup';
import {
  Download,
  RotateCcw,
  Trash2,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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

const triggerBadgeStyles: Record<string, string> = {
  manual: 'bg-blue-100 text-blue-800',
  pre_delete: 'bg-red-100 text-red-800',
  pre_merge: 'bg-amber-100 text-amber-800',
  pre_sync: 'bg-purple-100 text-purple-800',
  pre_restore: 'bg-cyan-100 text-cyan-800',
};

function TriggerBadge({ trigger }: { trigger: string }) {
  const style = triggerBadgeStyles[trigger] ?? 'bg-gray-100 text-gray-800';
  const label = trigger.replace(/_/g, ' ');
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}

interface BackupListProps {
  initialBackups: BackupSnapshotMeta[];
}

export function BackupList({ initialBackups }: BackupListProps) {
  const [backups, setBackups] = useState<BackupSnapshotMeta[]>(initialBackups);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);

  function clearMessage() {
    setTimeout(() => setMessage(null), 5000);
  }

  async function refreshBackups() {
    const updated = await listBackups();
    setBackups(updated);
  }

  function handleCreateBackup() {
    setActiveAction('create');
    startTransition(async () => {
      const result = await createManualBackup();
      if (result.success) {
        setMessage({
          type: 'success',
          text: `Backup created: ${result.filename} at ${new Date(result.timestamp).toLocaleString('en-GB')}`,
        });
        await refreshBackups();
      } else {
        setMessage({ type: 'error', text: result.error });
      }
      setActiveAction(null);
      clearMessage();
    });
  }

  function handleRestore(snapshot: BackupSnapshotMeta) {
    const confirmed = window.confirm(
      `Restore from backup '${snapshot.filename}'?\n\nThis will replace all current categories and video assignments. A safety backup will be created automatically before restoring.`
    );
    if (!confirmed) return;

    setActiveAction(`restore-${snapshot.id}`);
    startTransition(async () => {
      const result = await restoreBackup(snapshot.id);
      if (result.success) {
        setMessage({
          type: 'success',
          text: `Restored ${result.restoredCategories} categories and ${result.restoredVideos} videos. Safety backup created (ID: ${result.preRestoreBackupId}).${
            result.warnings?.length ? ` Warnings: ${result.warnings.join(', ')}` : ''
          }`,
        });
        await refreshBackups();
      } else {
        setMessage({ type: 'error', text: result.error });
      }
      setActiveAction(null);
      clearMessage();
    });
  }

  function handleDelete(snapshot: BackupSnapshotMeta) {
    const confirmed = window.confirm(
      `Delete backup '${snapshot.filename}'?\n\nThis cannot be undone.`
    );
    if (!confirmed) return;

    setActiveAction(`delete-${snapshot.id}`);
    startTransition(async () => {
      const result = await deleteBackup(snapshot.id);
      if (result.success) {
        setMessage({ type: 'success', text: 'Backup deleted.' });
        await refreshBackups();
      } else {
        setMessage({ type: 'error', text: result.error });
      }
      setActiveAction(null);
      clearMessage();
    });
  }

  return (
    <div className="space-y-4">
      {/* Header with Create button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {backups.length} backup{backups.length === 1 ? '' : 's'} available
        </p>
        <button
          onClick={handleCreateBackup}
          disabled={isPending && activeAction === 'create'}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isPending && activeAction === 'create' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Create Backup
        </button>
      </div>

      {/* Status message */}
      {message && (
        <div
          className={`flex items-center gap-2 rounded-md px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
          )}
          {message.text}
        </div>
      )}

      {/* Backup list */}
      {backups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
          <p className="text-gray-500">No backups yet. Create your first backup to get started.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Trigger
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Created
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Size
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Entities
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {backups.map((backup) => (
                <tr key={backup.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <TriggerBadge trigger={backup.trigger} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                    <span title={new Date(backup.createdAt).toLocaleString('en-GB')}>
                      {formatRelativeTime(backup.createdAt)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                    {formatFileSize(backup.fileSizeBytes)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                    {backup.entityCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-1">
                      <a
                        href={`/api/backup/${backup.id}`}
                        download
                        className="inline-flex items-center rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                        title="Download backup"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                      <button
                        onClick={() => handleRestore(backup)}
                        disabled={isPending}
                        className="inline-flex items-center rounded-md p-1.5 text-gray-500 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50 transition-colors"
                        title="Restore from backup"
                      >
                        {isPending && activeAction === `restore-${backup.id}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RotateCcw className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(backup)}
                        disabled={isPending}
                        className="inline-flex items-center rounded-md p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 transition-colors"
                        title="Delete backup"
                      >
                        {isPending && activeAction === `delete-${backup.id}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
