# Phase 7: Safety & Archive System - Research

**Researched:** 2026-02-07
**Domain:** Database backup/restore, immutable operation logging, undo/restore patterns
**Confidence:** HIGH

## Summary

Phase 7 adds safety mechanisms before Phase 8 (Batch Sync to YouTube). The phase has five requirements: JSON backup of playlist metadata (SAFE-01), automatic archiving before destructive operations (SAFE-02), restoration from archives (SAFE-03), immutable operation log (SAFE-05), and undo of pending changes before sync (SAFE-06).

The research finds that **no new libraries are needed**. The existing technology stack (Drizzle ORM, PostgreSQL, Next.js App Router) provides everything required. The core work is: (1) a new `operationLog` database table for immutable append-only audit trail, (2) a `backupSnapshots` table to track backup metadata, (3) server-side JSON serialisation of database state into files in a `backups/` directory, (4) a Route Handler for file downloads, (5) a restore server action, and (6) a "pending changes" review UI that shows what will be synced to YouTube in Phase 8.

**Primary recommendation:** Use database-backed metadata tracking with filesystem JSON snapshots. No external backup libraries. Leverage existing Drizzle ORM patterns from the codebase (transactions, insert-returning, JSONB columns). The existing `useUndoStack` hook covers in-session undo; Phase 7 adds persistent, pre-sync undo via a "pending changes" queue stored in the database.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.1 | Database operations for new tables | Already in project, handles all CRUD |
| pg | 8.18.0 | PostgreSQL connection | Already in project |
| Node.js `fs/promises` | Built-in | Write/read JSON backup files | No dependencies needed, server-side only |
| Node.js `path` | Built-in | Construct backup file paths | No dependencies needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | 4.3.6 | Validate backup JSON on restore | Already in project, ensures backup integrity before restoring |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Filesystem JSON | PostgreSQL JSONB column for backups | Filesystem is better for large backups (4000+ videos could be 2-5MB); DB column adds unnecessary bloat to daily queries |
| Filesystem JSON | pg_dump for full DB backup | Too heavy-handed; we only need category/video structure, not the entire database |
| Custom operation log table | pgAudit extension | pgAudit is for DBA-level compliance auditing; our needs are application-level operation tracking with user-facing display |
| Custom operation log table | Trigger-based audit (PostgreSQL triggers) | Triggers add hidden complexity; explicit application-level logging is simpler and matches existing codebase patterns |

**Installation:**
```bash
# No new packages needed - all tools already available in the project
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── db/
│   │   └── schema.ts              # Add operationLog + backupSnapshots tables
│   └── backup/
│       ├── snapshot.ts             # Create/read JSON snapshots
│       └── restore.ts             # Restore from backup logic
├── app/
│   ├── actions/
│   │   ├── backup.ts              # Server actions: create backup, list backups, restore
│   │   └── operation-log.ts       # Server actions: log operation, get log entries
│   ├── api/
│   │   └── backup/
│   │       └── [id]/
│   │           └── route.ts       # Route Handler: GET to download backup JSON
│   └── safety/
│       └── page.tsx               # Safety dashboard: backups list, operation log, pending changes
└── types/
    └── backup.ts                  # BackupSnapshot, OperationLogEntry, PendingChange types
backups/                           # Backup JSON files (gitignored)
```

### Pattern 1: Append-Only Operation Log
**What:** A database table that only accepts INSERTs, never UPDATEs or DELETEs. Each row records a destructive operation (or intent to perform one) with timestamp, action type, affected entity IDs, and metadata.
**When to use:** Any time a destructive action occurs (delete category, merge categories, move videos, accept/reject ML suggestions in bulk, finalise consolidation).
**Example:**
```typescript
// Schema definition
export const operationLog = pgTable('operation_log', {
  id: serial('id').primaryKey(),
  action: text('action').notNull(),          // 'delete_category', 'merge_categories', 'move_videos', etc.
  entityType: text('entity_type').notNull(), // 'category', 'video', 'playlist'
  entityIds: jsonb('entity_ids').$type<number[]>().notNull(),
  metadata: jsonb('metadata'),               // Action-specific details (e.g. { categoryName, videoCount })
  backupSnapshotId: integer('backup_snapshot_id').references(() => backupSnapshots.id),
  userId: text('user_id'),                   // For future multi-user, nullable for now
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Server action: log an operation (append-only, never update/delete)
export async function logOperation(entry: Omit<OperationLogEntry, 'id' | 'createdAt'>) {
  const [logged] = await db
    .insert(operationLog)
    .values(entry)
    .returning({ id: operationLog.id, createdAt: operationLog.createdAt });
  return logged;
}
```

### Pattern 2: Pre-Operation Snapshot
**What:** Before any destructive operation, capture the current state of affected entities as a JSON file and record metadata in the database.
**When to use:** Before category deletion, merge, bulk video moves, and especially before Phase 8 sync operations.
**Example:**
```typescript
// Backup snapshot metadata table
export const backupSnapshots = pgTable('backup_snapshots', {
  id: serial('id').primaryKey(),
  filename: text('filename').notNull().unique(),
  trigger: text('trigger').notNull(),        // 'manual', 'pre_delete', 'pre_merge', 'pre_sync'
  scope: text('scope').notNull(),            // 'full', 'category:123', 'categories:1,2,3'
  entityCount: integer('entity_count').notNull(),
  fileSizeBytes: integer('file_size_bytes').notNull(),
  checksum: text('checksum').notNull(),      // SHA-256 for integrity verification
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Create a snapshot before a destructive operation
async function createSnapshot(trigger: string, scope: string): Promise<number> {
  const data = await gatherSnapshotData(scope);
  const json = JSON.stringify(data, null, 2);
  const filename = `backup-${trigger}-${Date.now()}.json`;
  const filepath = path.join(process.cwd(), 'backups', filename);

  await fs.mkdir(path.dirname(filepath), { recursive: true });
  await fs.writeFile(filepath, json, 'utf-8');

  const stats = await fs.stat(filepath);
  const checksum = createHash('sha256').update(json).digest('hex');

  const [snapshot] = await db
    .insert(backupSnapshots)
    .values({
      filename,
      trigger,
      scope,
      entityCount: data.categories.length + data.videos.length,
      fileSizeBytes: stats.size,
      checksum,
    })
    .returning({ id: backupSnapshots.id });

  return snapshot.id;
}
```

### Pattern 3: Route Handler for Backup Download
**What:** A Next.js App Router Route Handler that serves backup JSON files as downloadable attachments.
**When to use:** When user wants to download a backup file to their local machine.
**Example:**
```typescript
// src/app/api/backup/[id]/route.ts
import { NextRequest } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // Look up snapshot metadata from DB
  const snapshot = await getSnapshotById(Number(id));
  if (!snapshot) {
    return new Response('Backup not found', { status: 404 });
  }

  const filepath = path.join(process.cwd(), 'backups', snapshot.filename);
  const content = await fs.readFile(filepath, 'utf-8');

  return new Response(content, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${snapshot.filename}"`,
    },
  });
}
```

### Pattern 4: Pending Changes Queue (Phase 8 Preparation)
**What:** A database table or view that aggregates all changes made since the last YouTube sync, showing the user what will happen when they sync. This builds on the existing `categoryVideos.source` provenance tracking and `operationLog` to compute a diff.
**When to use:** Before Phase 8 sync, and for the "undo pending changes" (SAFE-06) requirement.
**Example:**
```typescript
// Pending changes are computed, not stored separately.
// They are derived from:
// 1. categoryVideos entries added since last sync (source != 'consolidation')
// 2. operationLog entries since last sync timestamp
// 3. mlCategorizations with acceptedAt != null (approved suggestions awaiting sync)

export async function getPendingChanges(): Promise<PendingChangeSummary> {
  // Categories to create on YouTube (categories without a youtubePlaylistId)
  // Videos to add to playlists (categoryVideos rows)
  // Categories to delete (from operation log)
  // etc.
}
```

### Anti-Patterns to Avoid
- **Storing backup content in the database:** A full snapshot of 4000+ videos with metadata could be 2-5MB. Storing this in PostgreSQL JSONB columns bloats the database and slows queries. Use filesystem files with DB metadata.
- **Mutable audit log:** Never UPDATE or DELETE rows in the operation log. The entire point is immutability. Enforce this at the application level (no update/delete functions exposed).
- **Synchronous backup during user operations:** Snapshot creation should not block the UI. Use server actions with loading states. For Phase 8's pre-sync backup, it runs before the sync starts (not during).
- **Relying solely on client-side undo stack for safety:** The existing `useUndoStack` hook (30-second TTL, in-memory) is for immediate undo. Phase 7's safety is persistent, surviving page refreshes and browser closures.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File integrity verification | Custom file comparison | Node.js `crypto.createHash('sha256')` | Built-in, fast, standard checksum pattern |
| JSON schema validation on restore | Manual field-by-field checks | Zod schema validation (already in project) | Handles nested objects, provides clear error messages |
| File download from server | Custom streaming logic | Next.js Route Handler with Content-Disposition header | Standard web pattern, handles encoding |
| Date formatting for backup names | Custom date string formatting | `Date.toISOString()` + string replace | ISO format is sortable and unambiguous |

**Key insight:** This phase is primarily about data management patterns (backup, log, restore), not complex algorithms or UI components. The existing stack already provides every tool needed. The complexity is in getting the data flow right (when to snapshot, what to include, how to restore), not in technology selection.

## Common Pitfalls

### Pitfall 1: Partial Restore Corruption
**What goes wrong:** Restoring a backup partially (e.g., categories restored but not their video assignments) leaves the database in an inconsistent state.
**Why it happens:** Restore operations that span multiple tables without transactions, or transactions that are too large and time out.
**How to avoid:** Wrap the entire restore operation in a single Drizzle transaction. If any step fails, the whole restore rolls back. For very large restores, use batched inserts within the transaction.
**Warning signs:** Video counts don't match after restore; orphaned categoryVideos rows.

### Pitfall 2: Backup File Size Explosion
**What goes wrong:** Including full video metadata (descriptions, thumbnails, ETags) in every backup makes files unnecessarily large (potentially 10MB+).
**Why it happens:** Eagerly serialising entire database rows instead of only the data needed for reconstruction.
**How to avoid:** Backup only the structural data needed for restore: category names, category-video mappings (by YouTube video ID, not internal DB ID), and ML categorization states. Video metadata can be re-fetched from YouTube.
**Warning signs:** Backup files exceeding 5MB for 4000 videos.

### Pitfall 3: Internal DB IDs in Backups
**What goes wrong:** Storing internal serial IDs (e.g., category.id = 42) in backup JSON. On restore, ID 42 may already exist or the sequence may have moved past it.
**Why it happens:** Directly serialising database rows without mapping to stable identifiers.
**How to avoid:** Use YouTube IDs (video.youtubeId) and category names as the primary identifiers in backup JSON. On restore, look up or create entities by these stable identifiers, not by internal IDs.
**Warning signs:** Primary key conflicts during restore; foreign key violations.

### Pitfall 4: Operation Log Growing Unbounded
**What goes wrong:** After months of use, the operation log table has thousands of rows, making queries slow.
**Why it happens:** Append-only pattern without any retention policy.
**How to avoid:** Add a created_at index for efficient time-range queries. Consider a simple retention policy (e.g., auto-archive entries older than 90 days to a separate table or JSON export). For MVP, an index and pagination are sufficient.
**Warning signs:** getOperationLog query taking >100ms.

### Pitfall 5: Race Condition Between Backup and Operation
**What goes wrong:** Another user action modifies data between the moment the backup is created and the destructive operation executes, meaning the backup doesn't capture the final pre-operation state.
**Why it happens:** Backup and operation are separate server actions called sequentially.
**How to avoid:** Wrap backup creation and the destructive operation in a single server action. The backup is created within the same transaction or immediately before the destructive operation, not as a separate user-triggered step.
**Warning signs:** Restored state doesn't match what the user expected.

### Pitfall 6: BigInt String Returns from COUNT Aggregates
**What goes wrong:** PostgreSQL aggregate functions return strings via Drizzle (documented in MEMORY.md).
**Why it happens:** PostgreSQL bigint type maps to JavaScript string.
**How to avoid:** Always wrap `count()` results with `Number()`.
**Warning signs:** String concatenation instead of arithmetic in summary statistics.

## Code Examples

### Backup JSON Structure
```typescript
// The backup file structure — uses stable identifiers, not internal DB IDs
interface BackupSnapshot {
  version: '1.0';
  createdAt: string;                  // ISO 8601
  trigger: string;                    // What triggered this backup
  data: {
    categories: Array<{
      name: string;
      isProtected: boolean;
      videos: Array<{
        youtubeId: string;
        title: string;
        source: string;               // 'consolidation', 'manual', 'merge', etc.
      }>;
    }>;
    mlCategorizations: Array<{
      videoYoutubeId: string;
      suggestedCategoryName: string;
      confidence: 'HIGH' | 'MEDIUM' | 'LOW';
      similarityScore: number;
      acceptedAt: string | null;
      rejectedAt: string | null;
      manualCategoryName: string | null;
    }>;
    metadata: {
      totalCategories: number;
      totalVideos: number;
      totalCategorizations: number;
    };
  };
}
```

### Creating a Full Backup Server Action
```typescript
'use server';
import { promises as fs } from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { db } from '@/lib/db';
import { categories, categoryVideos, videos, mlCategorizations, backupSnapshots } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function createBackup(trigger: string = 'manual') {
  // 1. Gather all category + video assignment data
  const allCategories = await db.select().from(categories);
  const allCategoryVideos = await db
    .select({
      categoryId: categoryVideos.categoryId,
      videoYoutubeId: videos.youtubeId,
      videoTitle: videos.title,
      source: categoryVideos.source,
    })
    .from(categoryVideos)
    .innerJoin(videos, eq(categoryVideos.videoId, videos.id));

  // 2. Group videos by category
  const categoryData = allCategories.map(cat => ({
    name: cat.name,
    isProtected: cat.isProtected,
    videos: allCategoryVideos
      .filter(cv => cv.categoryId === cat.id)
      .map(cv => ({
        youtubeId: cv.videoYoutubeId,
        title: cv.videoTitle,
        source: cv.source,
      })),
  }));

  // 3. Build backup object
  const backup = {
    version: '1.0' as const,
    createdAt: new Date().toISOString(),
    trigger,
    data: {
      categories: categoryData,
      mlCategorizations: [], // Include if needed
      metadata: {
        totalCategories: allCategories.length,
        totalVideos: new Set(allCategoryVideos.map(cv => cv.videoYoutubeId)).size,
        totalCategorizations: 0,
      },
    },
  };

  // 4. Write to filesystem
  const json = JSON.stringify(backup, null, 2);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup-${trigger}-${timestamp}.json`;
  const backupsDir = path.join(process.cwd(), 'backups');
  await fs.mkdir(backupsDir, { recursive: true });
  await fs.writeFile(path.join(backupsDir, filename), json, 'utf-8');

  // 5. Record metadata in database
  const checksum = createHash('sha256').update(json).digest('hex');
  const [snapshot] = await db
    .insert(backupSnapshots)
    .values({
      filename,
      trigger,
      scope: 'full',
      entityCount: allCategories.length,
      fileSizeBytes: Buffer.byteLength(json, 'utf-8'),
      checksum,
    })
    .returning();

  return {
    success: true,
    snapshotId: snapshot.id,
    filename,
    timestamp: snapshot.createdAt,
  };
}
```

### Restore from Backup
```typescript
'use server';
import { promises as fs } from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { db } from '@/lib/db';
import { categories, categoryVideos, videos, backupSnapshots } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function restoreFromBackup(snapshotId: number) {
  // 1. Load and verify backup
  const [snapshot] = await db
    .select()
    .from(backupSnapshots)
    .where(eq(backupSnapshots.id, snapshotId));

  if (!snapshot) return { success: false, error: 'Backup not found' };

  const filepath = path.join(process.cwd(), 'backups', snapshot.filename);
  const content = await fs.readFile(filepath, 'utf-8');

  // Verify integrity
  const checksum = createHash('sha256').update(content).digest('hex');
  if (checksum !== snapshot.checksum) {
    return { success: false, error: 'Backup integrity check failed' };
  }

  const backup = JSON.parse(content);

  // 2. Create pre-restore backup (safety net)
  await createBackup('pre_restore');

  // 3. Restore in a single transaction
  await db.transaction(async (tx) => {
    // Delete all current category assignments and non-protected categories
    await tx.delete(categoryVideos);
    await tx.delete(categories).where(eq(categories.isProtected, false));

    // Restore categories and their video assignments
    for (const cat of backup.data.categories) {
      if (cat.isProtected) continue; // Skip Uncategorised, it already exists

      const [restored] = await tx
        .insert(categories)
        .values({
          name: cat.name,
          isProtected: false,
          videoCount: cat.videos.length,
        })
        .returning({ id: categories.id });

      for (const video of cat.videos) {
        // Look up video by YouTube ID
        const [existingVideo] = await tx
          .select({ id: videos.id })
          .from(videos)
          .where(eq(videos.youtubeId, video.youtubeId))
          .limit(1);

        if (existingVideo) {
          await tx.insert(categoryVideos).values({
            categoryId: restored.id,
            videoId: existingVideo.id,
            source: video.source ?? 'restore',
          });
        }
      }
    }
  });

  // 4. Log the restore operation
  await logOperation({
    action: 'restore_backup',
    entityType: 'backup',
    entityIds: [snapshotId],
    metadata: { filename: snapshot.filename, trigger: snapshot.trigger },
    backupSnapshotId: snapshotId,
  });

  return { success: true };
}
```

### Operation Log Query with Pagination
```typescript
export async function getOperationLog(
  limit: number = 50,
  offset: number = 0
): Promise<{ entries: OperationLogEntry[]; total: number }> {
  const [totalRow] = await db
    .select({ cnt: count() })
    .from(operationLog);

  const entries = await db
    .select()
    .from(operationLog)
    .orderBy(desc(operationLog.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    entries,
    total: Number(totalRow.cnt),
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| pg_dump for application backups | Application-level JSON snapshots | Standard for web apps | Targeted backup of only relevant data, faster restore |
| Trigger-based audit logging | Application-level operation logging | Ongoing preference for web apps | Simpler, more visible, testable |
| File-based undo (save/load state) | Database-backed operation log with filesystem snapshots | Modern web pattern | Persistent across sessions, queryable |

**Deprecated/outdated:**
- Pages Router API routes for file downloads: Use App Router Route Handlers instead (already the pattern in this project)
- `next/api` exports: Use `export async function GET()` in `route.ts` files

## Open Questions

1. **Should ML categorization results be included in backups?**
   - What we know: ML categorizations are stored in `mlCategorizations` table with accept/reject states
   - What's unclear: Whether the user would want to restore ML review progress (accepted/rejected states) or just re-run categorization
   - Recommendation: Include ML categorization states in full backups. They represent significant user effort (reviewing 4000+ suggestions). But make this optional — a restore could skip ML data if the user just wants category structure back.

2. **Backup retention policy**
   - What we know: Backups are JSON files on the filesystem. Automatic backups will be created before every destructive operation.
   - What's unclear: How many backups should be retained before old ones are cleaned up
   - Recommendation: For MVP, keep all backups indefinitely. Add a "cleanup old backups" action later if storage becomes an issue. The files are small (2-5MB each).

3. **Phase 8 "pending changes" granularity**
   - What we know: SAFE-06 requires "undo pending changes before syncing to YouTube". Phase 8 will sync category structure to YouTube.
   - What's unclear: Whether "undo" means reverting individual changes or rolling back to a snapshot
   - Recommendation: Implement "pending changes" as a computed view (what changed since last sync), with the ability to revert to the pre-change backup snapshot. Individual change undo is already handled by `useUndoStack` for in-session operations. Pre-sync undo = restore from the automatic pre-sync backup.

## Phase 8 Forward Compatibility

Phase 8 (Batch Sync Operations) depends on Phase 7's safety mechanisms. Key requirements Phase 7 must prepare for:

1. **SYNC-08: Operation journaling** — Phase 8 needs to journal all sync operations before execution with pending/complete/failed states. The `operationLog` table from Phase 7 provides the foundation, but Phase 8 will need an additional `syncOperations` table for the specific sync journal with state tracking. Phase 7's operation log is immutable (append-only); Phase 8's sync journal needs mutable state.

2. **Pre-sync backup** — Phase 8 will call `createBackup('pre_sync')` before starting any YouTube API operations. Phase 7 must expose this as a reusable function.

3. **Sync checkpoint** — The existing `syncState` table handles pagination progress. Phase 8 will extend this for write operations (create playlist, add video, delete playlist). Phase 7's operation log provides the audit trail.

4. **Rollback after failed sync** — If Phase 8 sync fails partway, the user needs to know what was and wasn't synced. Phase 7's operation log combined with Phase 8's sync journal enables this.

**Design principle:** Phase 7's operation log is **immutable and retrospective** (what happened). Phase 8's sync journal is **mutable and prospective** (what should happen, what has happened so far). They complement each other.

## Sources

### Primary (HIGH confidence)
- `/drizzle-team/drizzle-orm-docs` — Context7: PostgreSQL insert returning, JSONB columns, timestamp defaults
- `/vercel/next.js` — Context7: Route Handlers, streaming responses, file serving patterns
- Codebase analysis — Direct inspection of existing schema, server actions, undo stack, and mutation patterns

### Secondary (MEDIUM confidence)
- [Next.js file download discussion](https://github.com/vercel/next.js/discussions/51676) — Route Handler pattern for Content-Disposition file downloads
- [Immutable audit trail patterns](https://www.designgurus.io/answers/detail/how-do-you-enforce-immutability-and-appendonly-audit-trails) — Append-only table design, indexing strategies
- [PostgreSQL audit logging](https://www.bytebase.com/blog/postgres-audit-logging/) — Application-level vs trigger-based audit approaches

### Tertiary (LOW confidence)
- None — all findings verified through primary or secondary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — No new libraries needed; all tools already in project
- Architecture: HIGH — Patterns directly derived from existing codebase conventions (server actions, Drizzle transactions, JSONB columns)
- Pitfalls: HIGH — Based on direct analysis of existing code patterns (BigInt strings, transaction scope, ID stability)
- Phase 8 compatibility: MEDIUM — Phase 8 requirements are defined in the roadmap but not yet planned in detail

**Research date:** 2026-02-07
**Valid until:** 2026-03-07 (stable domain, no fast-moving dependencies)
