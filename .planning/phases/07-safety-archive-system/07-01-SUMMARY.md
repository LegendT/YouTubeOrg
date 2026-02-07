---
phase: "07"
plan: "01"
subsystem: "safety-archive"
tags: ["backup", "restore", "audit-log", "schema", "drizzle", "json-snapshot"]
dependency-graph:
  requires: ["03-01"]
  provides: ["backup-schema", "backup-types", "snapshot-create", "snapshot-restore"]
  affects: ["07-02", "07-03", "07-04"]
tech-stack:
  added: []
  patterns: ["json-file-backup", "sha256-checksum-integrity", "pre-restore-safety-backup", "transactional-restore"]
file-tracking:
  key-files:
    created:
      - "src/types/backup.ts"
      - "src/lib/backup/snapshot.ts"
      - "src/lib/backup/restore.ts"
    modified:
      - "src/lib/db/schema.ts"
      - ".gitignore"
decisions:
  - id: "07-01-stable-ids"
    title: "Stable identifiers in backup JSON"
    choice: "YouTube IDs and category names instead of internal serial IDs"
    reason: "Backups remain valid across database rebuilds; internal IDs may change"
  - id: "07-01-pre-restore-backup"
    title: "Pre-restore safety backup"
    choice: "Auto-create backup before every restore operation"
    reason: "Safety net ensures no data loss even if restore is incorrect"
  - id: "07-01-graceful-missing-videos"
    title: "Graceful handling of missing videos during restore"
    choice: "Skip with warning instead of failing the transaction"
    reason: "Videos may have been deleted from YouTube since backup; partial restore is better than no restore"
metrics:
  duration: "3.5 min"
  completed: "2026-02-07"
---

# Phase 7 Plan 01: Backup Foundation Schema and Core Logic Summary

**One-liner:** Database tables for audit logging and backup metadata, TypeScript types for backup data, and JSON snapshot create/restore functions with SHA-256 integrity verification.

## What Was Built

### Database Schema (src/lib/db/schema.ts)

Two new tables added under Phase 7 section:

- **backupSnapshots** — Stores metadata for each backup file: filename, trigger reason, scope, entity count, file size, SHA-256 checksum, and creation timestamp. Filename has unique constraint.
- **operationLog** — Append-only audit trail: action performed, entity type, entity IDs (JSONB array), optional metadata, optional reference to backup snapshot that preceded the operation.

### TypeScript Types (src/types/backup.ts)

Seven interfaces covering the full type system:

- **BackupData** — Top-level JSON structure with version, trigger, and nested data (categories, ML categorizations, metadata counts)
- **BackupCategory** / **BackupCategoryVideo** — Category with name, isProtected flag, and video assignments using YouTube IDs
- **BackupMLCategorization** — ML suggestion with video YouTube ID, category name, confidence, and acceptance/rejection state
- **OperationLogEntry** / **BackupSnapshotMeta** — Database row types for the two new tables
- **PendingChange** / **PendingChangeSummary** — Types for tracking unsaved changes (used by future plans)

### Snapshot Creation (src/lib/backup/snapshot.ts)

`createSnapshot(trigger, scope)` function:

1. Gathers all categories with video assignments via inner join on categoryVideos + videos
2. Gathers ML categorizations with video YouTube IDs and category names (resolves manualCategoryId to name)
3. Supports full scope or category-specific scope (e.g. `'category:Gaming'`)
4. Writes pretty-printed JSON to `backups/` directory with timestamp-based filename
5. Computes SHA-256 checksum of the JSON content
6. Records metadata row in backupSnapshots table
7. Returns `{ snapshotId, filename, createdAt }`

### Snapshot Restore (src/lib/backup/restore.ts)

`restoreFromSnapshot(snapshotId)` function:

1. Looks up backup metadata and reads JSON file from disk
2. Verifies SHA-256 checksum matches stored value (detects corruption)
3. Creates pre-restore safety backup via `createSnapshot('pre_restore')`
4. Executes full restore in a single Drizzle transaction:
   - Clears all categoryVideos
   - Deletes non-protected categories
   - Preserves protected "Uncategorised" category, restores its video assignments
   - Creates new categories from backup data
   - Resolves videos by YouTube ID (not internal ID)
   - Optionally restores ML categorizations with category name resolution
5. Returns result with pre-restore backup ID, counts, and any warnings for missing videos

## Deviations from Plan

None — plan executed exactly as written.

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Stable identifiers in backup JSON | YouTube IDs + category names | Backups remain valid across database rebuilds |
| Pre-restore safety backup | Auto-create before every restore | Safety net for incorrect restores |
| Missing video handling | Skip with warning, don't fail | Partial restore better than no restore |
| Backup directory | `path.join(process.cwd(), 'backups')` | Consistent with Next.js project root convention |
| Checksum algorithm | SHA-256 | Standard, fast, sufficient for integrity verification |

## Next Phase Readiness

### Ready for 07-02 (Server Actions & API Layer)
- `createSnapshot` and `restoreFromSnapshot` are ready to be wrapped in server actions
- `operationLog` table ready for audit trail insertions from server actions
- Types exported for use in server action return types

### Ready for 07-03 (Pre-Sync Backup Trigger)
- `createSnapshot('pre_sync')` can be called before sync operations
- Backup metadata available for display in UI

### Ready for 07-04 (Backup Management UI)
- `BackupSnapshotMeta` type available for listing backups
- `PendingChange` / `PendingChangeSummary` types ready for change tracking display
