'use server';

import { promises as fs } from 'fs';
import path from 'path';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/guard';
import { db } from '@/lib/db';
import { backupSnapshots } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { createSnapshot } from '@/lib/backup/snapshot';
import { restoreFromSnapshot } from '@/lib/backup/restore';
import { logOperation } from './operation-log';
import type { BackupSnapshotMeta } from '@/types/backup';

const BACKUP_DIR = path.join(process.cwd(), 'backups');

/**
 * Create a manual backup snapshot.
 *
 * Calls createSnapshot with 'manual' trigger and full scope.
 * Revalidates the /safety page after creation.
 */
export async function createManualBackup(): Promise<
  | { success: true; snapshotId: number; filename: string; timestamp: Date }
  | { success: false; error: string }
> {
  try {
    const result = await createSnapshot('manual');

    revalidatePath('/safety');
    return {
      success: true,
      snapshotId: result.snapshotId,
      filename: result.filename,
      timestamp: result.createdAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to create backup: ${message}` };
  }
}

/**
 * List all backup snapshots, ordered by most recent first.
 *
 * Returns metadata for each backup including trigger, size, and date.
 * Wraps entityCount with Number() for PostgreSQL bigint safety.
 */
export async function listBackups(): Promise<BackupSnapshotMeta[]> {
  try {
    const rows = await db
      .select()
      .from(backupSnapshots)
      .orderBy(desc(backupSnapshots.createdAt));

    return rows.map((row) => ({
      id: row.id,
      filename: row.filename,
      trigger: row.trigger,
      scope: row.scope,
      entityCount: Number(row.entityCount),
      fileSizeBytes: Number(row.fileSizeBytes),
      checksum: row.checksum,
      createdAt: row.createdAt,
    }));
  } catch (error) {
    console.error('Failed to list backups:', error);
    return [];
  }
}

/**
 * Restore from a specific backup snapshot.
 *
 * Calls restoreFromSnapshot which handles checksum verification,
 * pre-restore safety backup, and transactional restore.
 * Logs the restore operation to the immutable operation log.
 * Revalidates /safety, /videos, and /dashboard after restore.
 */
export async function restoreBackup(
  snapshotId: number
): Promise<
  | {
      success: true;
      preRestoreBackupId: number;
      restoredCategories: number;
      restoredVideos: number;
      warnings?: string[];
    }
  | { success: false; error: string }
> {
  const auth = await requireAuth()
  if (!auth.authenticated) return { success: false, error: auth.error }

  try {
    const result = await restoreFromSnapshot(snapshotId);

    if (!result.success) {
      return { success: false, error: result.error ?? 'Restore failed' };
    }

    // Log the restore operation to the immutable audit trail
    await logOperation({
      action: 'restore_backup',
      entityType: 'backup',
      entityIds: [snapshotId],
      metadata: {
        preRestoreBackupId: result.preRestoreBackupId,
        restoredCategories: result.restoredCategories,
        restoredVideos: result.restoredVideos,
        warnings: result.warnings,
      },
      backupSnapshotId: result.preRestoreBackupId,
    });

    revalidatePath('/safety');
    revalidatePath('/videos');
    revalidatePath('/dashboard');

    return {
      success: true,
      preRestoreBackupId: result.preRestoreBackupId!,
      restoredCategories: result.restoredCategories!,
      restoredVideos: result.restoredVideos!,
      warnings: result.warnings,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to restore backup: ${message}` };
  }
}

/**
 * Delete a backup snapshot.
 *
 * Removes the JSON file from the filesystem and deletes the database row.
 * Does NOT delete associated operation log entries (they are immutable).
 * Revalidates /safety after deletion.
 */
export async function deleteBackup(
  snapshotId: number
): Promise<{ success: true } | { success: false; error: string }> {
  const auth = await requireAuth()
  if (!auth.authenticated) return { success: false, error: auth.error }

  try {
    // Look up snapshot
    const [snapshot] = await db
      .select()
      .from(backupSnapshots)
      .where(eq(backupSnapshots.id, snapshotId));

    if (!snapshot) {
      return { success: false, error: 'Backup not found' };
    }

    // Delete the JSON file from filesystem
    const filePath = path.join(BACKUP_DIR, snapshot.filename);
    try {
      await fs.unlink(filePath);
    } catch {
      // File may already be missing — continue with DB cleanup
    }

    // Delete the database row
    await db
      .delete(backupSnapshots)
      .where(eq(backupSnapshots.id, snapshotId));

    revalidatePath('/safety');
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to delete backup: ${message}` };
  }
}
