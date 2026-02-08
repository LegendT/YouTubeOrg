'use client';

import { useState, useTransition } from 'react';
import {
  createManualBackup,
  listBackups,
  restoreBackup,
  deleteBackup,
} from '@/app/actions/backup';
import type { BackupSnapshotMeta } from '@/types/backup';
import { ConfirmDialog } from './confirm-dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import {
  DownloadSimple,
  ArrowCounterClockwise,
  Trash,
  Plus,
  CheckCircle,
  WarningCircle,
  ShieldCheck,
} from '@phosphor-icons/react';

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
  manual: 'bg-info/10 text-info',
  pre_delete: 'bg-destructive/10 text-destructive',
  pre_merge: 'bg-warning/10 text-warning',
  pre_sync: 'bg-primary/10 text-primary',
  pre_restore: 'bg-info/10 text-info',
};

function TriggerBadge({ trigger }: { trigger: string }) {
  const style = triggerBadgeStyles[trigger] ?? 'bg-muted text-muted-foreground';
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
  const [confirmAction, setConfirmAction] = useState<{ type: 'restore' | 'delete'; snapshot: BackupSnapshotMeta } | null>(null);

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
    setConfirmAction({ type: 'restore', snapshot });
  }

  function handleDelete(snapshot: BackupSnapshotMeta) {
    setConfirmAction({ type: 'delete', snapshot });
  }

  async function handleConfirmAction() {
    if (!confirmAction) return;

    const { type, snapshot } = confirmAction;

    if (type === 'restore') {
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
        setConfirmAction(null);
        clearMessage();
      });
    } else {
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
        setConfirmAction(null);
        clearMessage();
      });
    }
  }

  return (
    <div className="space-y-4">
      {/* Header with Create button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {backups.length} backup{backups.length === 1 ? '' : 's'} available
        </p>
        <Button
          onClick={handleCreateBackup}
          disabled={isPending && activeAction === 'create'}
          size="sm"
        >
          {isPending && activeAction === 'create' ? (
            <Spinner size={16} />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Create Backup
        </Button>
      </div>

      {/* Status message */}
      {message && (
        <div
          className={`flex items-center gap-2 rounded-md px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'bg-success/10 text-success border border-success/20'
              : 'bg-destructive/10 text-destructive border border-destructive/20'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="h-4 w-4 flex-shrink-0" />
          ) : (
            <WarningCircle className="h-4 w-4 flex-shrink-0" />
          )}
          {message.text}
        </div>
      )}

      {/* Backup list */}
      {backups.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No backups yet"
          description="Backups are created automatically before destructive operations, or you can create one manually."
          action={{ label: 'Create Backup', onClick: handleCreateBackup }}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Trigger
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Created
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Size
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Entities
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {backups.map((backup) => (
                <tr key={backup.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <TriggerBadge trigger={backup.trigger} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-foreground">
                    <span title={new Date(backup.createdAt).toLocaleString('en-GB')}>
                      {formatRelativeTime(backup.createdAt)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-foreground">
                    {formatFileSize(backup.fileSizeBytes)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-foreground">
                    {backup.entityCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-1">
                      <a
                        href={`/api/backup/${backup.id}`}
                        download
                        className="inline-flex items-center rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        title="Download backup"
                      >
                        <DownloadSimple className="h-4 w-4" />
                      </a>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRestore(backup)}
                        disabled={isPending}
                        className="h-7 w-7 text-muted-foreground hover:bg-info/10 hover:text-info"
                        title="Restore from backup"
                        aria-label={`Restore backup from ${formatRelativeTime(backup.createdAt)}`}
                      >
                        {isPending && activeAction === `restore-${backup.id}` ? (
                          <Spinner size={16} />
                        ) : (
                          <ArrowCounterClockwise className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(backup)}
                        disabled={isPending}
                        className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Delete backup"
                        aria-label={`Delete backup from ${formatRelativeTime(backup.createdAt)}`}
                      >
                        {isPending && activeAction === `delete-${backup.id}` ? (
                          <Spinner size={16} />
                        ) : (
                          <Trash className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* Confirmation dialog for restore/delete */}
      <ConfirmDialog
        open={confirmAction !== null}
        onOpenChange={(open) => { if (!open) setConfirmAction(null) }}
        title={confirmAction?.type === 'restore' ? 'Restore Backup' : 'Delete Backup'}
        description={
          confirmAction?.type === 'restore'
            ? `Restore from backup '${confirmAction.snapshot.filename}'?`
            : `Delete backup '${confirmAction?.snapshot.filename}'? This cannot be undone.`
        }
        warning={
          confirmAction?.type === 'restore'
            ? 'This will replace all current categories and video assignments. A safety backup will be created automatically.'
            : undefined
        }
        confirmLabel={confirmAction?.type === 'restore' ? 'Restore' : 'Delete'}
        variant={confirmAction?.type === 'delete' ? 'destructive' : 'default'}
        onConfirm={handleConfirmAction}
        isPending={isPending && confirmAction !== null}
      />
    </div>
  );
}
