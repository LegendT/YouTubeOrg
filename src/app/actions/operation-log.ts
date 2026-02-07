'use server';

import { db } from '@/lib/db';
import {
  operationLog,
  mlCategorizations,
  categoryVideos,
} from '@/lib/db/schema';
import { desc, isNotNull, count } from 'drizzle-orm';
import type { OperationLogEntry, PendingChangeSummary } from '@/types/backup';

/**
 * Log an operation to the immutable operation log.
 *
 * This is the ONLY write function for the operation log — append-only.
 * No update or delete functions are exposed (immutability guarantee).
 *
 * @returns The created log entry with id and createdAt
 */
export async function logOperation(entry: {
  action: string;
  entityType: string;
  entityIds: number[];
  metadata?: Record<string, unknown>;
  backupSnapshotId?: number;
}): Promise<OperationLogEntry> {
  const [created] = await db
    .insert(operationLog)
    .values({
      action: entry.action,
      entityType: entry.entityType,
      entityIds: entry.entityIds,
      metadata: entry.metadata ?? null,
      backupSnapshotId: entry.backupSnapshotId ?? null,
    })
    .returning();

  return {
    id: created.id,
    action: created.action,
    entityType: created.entityType,
    entityIds: created.entityIds as number[],
    metadata: created.metadata as Record<string, unknown> | null,
    backupSnapshotId: created.backupSnapshotId,
    createdAt: created.createdAt,
  };
}

/**
 * Retrieve paginated operation log entries, most recent first.
 *
 * Wraps count() with Number() for PostgreSQL bigint safety.
 *
 * @param limit - Maximum entries to return (default 50)
 * @param offset - Number of entries to skip (default 0)
 * @returns Paginated entries and total count
 */
export async function getOperationLog(
  limit: number = 50,
  offset: number = 0
): Promise<{ entries: OperationLogEntry[]; total: number }> {
  try {
    // Count total entries
    const [totalRow] = await db
      .select({ cnt: count() })
      .from(operationLog);

    const total = Number(totalRow.cnt);

    // Fetch paginated entries
    const rows = await db
      .select()
      .from(operationLog)
      .orderBy(desc(operationLog.createdAt))
      .limit(limit)
      .offset(offset);

    const entries: OperationLogEntry[] = rows.map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entityType,
      entityIds: row.entityIds as number[],
      metadata: row.metadata as Record<string, unknown> | null,
      backupSnapshotId: row.backupSnapshotId,
      createdAt: row.createdAt,
    }));

    return { entries, total };
  } catch (error) {
    console.error('Failed to get operation log:', error);
    return { entries: [], total: 0 };
  }
}

/**
 * Compute pending changes since last sync.
 *
 * Since Phase 8 (Batch Sync Operations) has not been built yet,
 * treats ALL current state as pending — everything is a change
 * relative to the original YouTube state. Phase 8 will refine this.
 *
 * @returns Summary of grouped changes with counts
 */
export async function getPendingChanges(): Promise<PendingChangeSummary> {
  try {
    const now = new Date();

    // Count accepted ML categorisations
    const [acceptedRow] = await db
      .select({ cnt: count() })
      .from(mlCategorizations)
      .where(isNotNull(mlCategorizations.acceptedAt));
    const acceptedCount = Number(acceptedRow.cnt);

    // Count rejected ML categorisations
    const [rejectedRow] = await db
      .select({ cnt: count() })
      .from(mlCategorizations)
      .where(isNotNull(mlCategorizations.rejectedAt));
    const rejectedCount = Number(rejectedRow.cnt);

    // Count manually recategorised videos
    const [manualRow] = await db
      .select({ cnt: count() })
      .from(mlCategorizations)
      .where(isNotNull(mlCategorizations.manualCategoryId));
    const manualCount = Number(manualRow.cnt);

    // Count categoryVideos entries by source type
    const sourceCountRows = await db
      .select({
        source: categoryVideos.source,
        cnt: count(),
      })
      .from(categoryVideos)
      .groupBy(categoryVideos.source);

    const sourceCounts = new Map(
      sourceCountRows.map((r) => [r.source, Number(r.cnt)])
    );

    // Build the changes list
    const changes: PendingChangeSummary['changes'] = [];

    if (acceptedCount > 0) {
      changes.push({
        type: 'ml_accepted',
        description: `${acceptedCount} ML categorisation${acceptedCount === 1 ? '' : 's'} accepted`,
        entityType: 'ml_categorization',
        count: acceptedCount,
        timestamp: now,
      });
    }

    if (rejectedCount > 0) {
      changes.push({
        type: 'ml_rejected',
        description: `${rejectedCount} ML categorisation${rejectedCount === 1 ? '' : 's'} rejected`,
        entityType: 'ml_categorization',
        count: rejectedCount,
        timestamp: now,
      });
    }

    if (manualCount > 0) {
      changes.push({
        type: 'ml_recategorised',
        description: `${manualCount} video${manualCount === 1 ? '' : 's'} manually recategorised`,
        entityType: 'ml_categorization',
        count: manualCount,
        timestamp: now,
      });
    }

    // Add category-video source breakdown
    const manualAssignments = sourceCounts.get('manual') ?? 0;
    if (manualAssignments > 0) {
      changes.push({
        type: 'videos_moved',
        description: `${manualAssignments} manual video assignment${manualAssignments === 1 ? '' : 's'}`,
        entityType: 'category_video',
        count: manualAssignments,
        timestamp: now,
      });
    }

    const mergeAssignments = sourceCounts.get('merge') ?? 0;
    if (mergeAssignments > 0) {
      changes.push({
        type: 'videos_added',
        description: `${mergeAssignments} video${mergeAssignments === 1 ? '' : 's'} from category merges`,
        entityType: 'category_video',
        count: mergeAssignments,
        timestamp: now,
      });
    }

    const totalChanges = changes.reduce((sum, c) => sum + c.count, 0);

    return {
      changes,
      totalChanges,
      lastSyncTimestamp: null, // Phase 8 will track last sync time
    };
  } catch (error) {
    console.error('Failed to get pending changes:', error);
    return { changes: [], totalChanges: 0, lastSyncTimestamp: null };
  }
}
