# Phase 7 Plan 02: Server Actions & API Layer Summary

**One-liner:** Backup CRUD server actions, append-only operation log, pending change computation, and backup file download route handler

## Execution Details

- **Duration:** 3.0 min
- **Completed:** 2026-02-07
- **Tasks:** 2/2

## What Was Built

### src/app/actions/backup.ts (4 server actions)
- **createManualBackup()** — calls createSnapshot('manual'), revalidates /safety, returns snapshotId/filename/timestamp
- **listBackups()** — queries backupSnapshots DESC by createdAt, returns BackupSnapshotMeta[] with Number() wrapping
- **restoreBackup(snapshotId)** — calls restoreFromSnapshot, logs to operation log, revalidates /safety + /videos + /dashboard
- **deleteBackup(snapshotId)** — removes JSON file from disk (fs.unlink) + deletes DB row, does NOT delete operation log entries

### src/app/actions/operation-log.ts (3 server actions, strictly append-only)
- **logOperation(entry)** — inserts into operationLog table, returns created entry with id/createdAt (ONLY write function)
- **getOperationLog(limit, offset)** — paginated query DESC by createdAt, returns entries + total count
- **getPendingChanges()** — computes ML accepted/rejected/recategorised counts + categoryVideos source breakdown; returns PendingChangeSummary (lastSyncTimestamp: null until Phase 8)

### src/app/api/backup/[id]/route.ts (GET route handler)
- Serves backup JSON files as downloadable attachments
- Validates ID (400), checks DB existence (404), checks file on disk (404)
- Content-Disposition: attachment header for browser downloads
- Next.js 15 async params pattern (await params)

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 04af87c | Server actions for backup CRUD and operation logging |
| 2 | 1b32f72 | Backup download route handler |

## Files Created

| File | Lines | Purpose |
|------|-------|---------|
| src/app/actions/backup.ts | 163 | Backup CRUD server actions |
| src/app/actions/operation-log.ts | 168 | Append-only operation log + pending changes |
| src/app/api/backup/[id]/route.ts | 56 | Backup file download route handler |

## Deviations from Plan

None — plan executed exactly as written.

## Key Design Decisions

1. **Operation log immutability:** logOperation is the ONLY write function. No update/delete exported. Entries persist even when their associated backup is deleted.
2. **Pending changes baseline:** Since Phase 8 (sync) does not exist yet, getPendingChanges treats all current state as pending relative to YouTube. lastSyncTimestamp returns null.
3. **Graceful file deletion:** deleteBackup silently continues if the JSON file is already missing from disk (fs.unlink in try/catch), then cleans up the DB row regardless.
4. **Restore audit trail:** restoreBackup logs the operation with pre-restore backup ID, category/video counts, and any warnings as metadata.

## Verification Results

- `npx tsc --noEmit` passes (no new errors)
- 'use server' directive present at top of both action files
- backup.ts exports 4 functions (createManualBackup, listBackups, restoreBackup, deleteBackup)
- operation-log.ts exports 3 functions (logOperation, getOperationLog, getPendingChanges) — NO update/delete
- restoreBackup calls logOperation after successful restore
- Route handler exports only GET, uses Content-Disposition: attachment, awaits params

## Next Phase Readiness

Server-side API layer complete. Ready for:
- **07-03:** Safety dashboard UI consuming these server actions
- **07-04:** Integration hooks calling logOperation on destructive operations
