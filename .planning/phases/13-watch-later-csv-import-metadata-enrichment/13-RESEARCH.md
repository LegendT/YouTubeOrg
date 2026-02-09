# Phase 13: Watch Later CSV Import & Metadata Enrichment - Research

**Researched:** 2026-02-09
**Domain:** CSV parsing, YouTube Data API v3 batch enrichment, Next.js file upload, Drizzle ORM upserts
**Confidence:** HIGH

## Summary

This phase imports ~3,932 Watch Later videos from a Google Takeout CSV into the existing database schema, enriches them with YouTube API metadata, and makes them available to the ML categorisation pipeline. The CSV format is simple (two columns: Video ID and timestamp), the existing `fetchVideoBatch()` function handles metadata enrichment with upsert logic, and the existing schema (`playlists`, `videos`, `playlistVideos`) requires no modifications.

The primary technical challenges are: (1) client-side CSV parsing and validation before upload, (2) server-side batch processing with progress reporting back to the UI, (3) handling unavailable/deleted videos gracefully, and (4) re-import idempotency given that `playlistVideos` has no unique constraint on `(playlist_id, video_id)`.

**Primary recommendation:** Parse CSV client-side for instant validation and preview, then send parsed video IDs + timestamps to a server action that processes in batches with polling-based progress (matching the existing sync page pattern). Use the existing `fetchVideoBatch()` for metadata enrichment. Handle re-import by querying existing video IDs before inserting relationships.

## Standard Stack

### Core (Already in Project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.5.12 | App Router, Server Actions, file handling | Already the project framework |
| Drizzle ORM | 0.45.1 | Database operations, upserts | Already used throughout |
| googleapis | 171.3.0 | YouTube Data API v3 `videos.list` | Already used for all YT operations |
| Zod | 4.3.6 | CSV data validation schema | Already in project, used in analysis validation |
| sonner | 2.0.7 | Toast notifications | Already used for error/success feedback |
| Bottleneck | 2.19.5 | Rate limiting YouTube API calls | Already configured with reservoir |

### Supporting (Already in Project)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-progress | 1.1.8 | Progress bar component | Import progress display |
| @phosphor-icons/react | 2.1.10 | Icons for UI | Upload, status, navigation icons |

### No New Dependencies Needed

This phase requires **zero new npm packages**. CSV parsing is simple enough (two columns, no quoting needed) to handle with `String.split()`. The Google Takeout CSV format uses no commas within fields, no quoting, no escaping -- it is trivially parseable.

**Installation:**
```bash
# No new packages needed
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual CSV split | Papa Parse library | Overkill for 2-column CSV with no quoting/escaping. Adds dependency for zero benefit. |
| Server-side file upload | Client-side FileReader | Client-side parsing gives instant validation + preview before any network call. Use this. |
| Server-Sent Events for progress | Polling with setInterval | Existing sync page already uses polling pattern successfully. SSE adds unnecessary complexity. |

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── import/                       # New route: /import
│   │   ├── page.tsx                  # Server component (auth check, render client)
│   │   └── import-page-client.tsx    # Client orchestrator (file upload + progress)
│   └── actions/
│       └── import.ts                 # Server actions for import operations
├── components/
│   └── import/                       # Import-specific UI components
│       ├── csv-upload.tsx            # File input + validation + preview
│       ├── import-progress.tsx       # Stage-based progress display
│       └── import-summary.tsx        # Completion summary with stats
└── lib/
    └── import/                       # Import business logic
        ├── csv-parser.ts             # CSV parsing + validation utilities
        └── watch-later.ts            # WL playlist creation + relationship logic
```

### Pattern 1: Client-Side CSV Parsing with FileReader API

**What:** Parse the CSV entirely on the client before sending data to the server. This gives instant validation, preview (video count), and avoids uploading invalid files.

**When to use:** Always for this feature. The CSV is small (~130KB for 3,932 rows) and parsing is trivial.

**Example:**
```typescript
// Source: Web FileReader API (standard browser API)
interface ParsedCSVRow {
  videoId: string;
  addedAt: string; // ISO 8601 timestamp
}

interface CSVParseResult {
  success: true;
  rows: ParsedCSVRow[];
  totalCount: number;
} | {
  success: false;
  error: string;
}

function parseWatchLaterCSV(csvText: string): CSVParseResult {
  const lines = csvText.trim().split('\n');

  if (lines.length < 2) {
    return { success: false, error: 'CSV file is empty or has no data rows' };
  }

  // Validate header
  const header = lines[0].trim();
  if (header !== 'Video ID,Playlist Video Creation Timestamp') {
    return { success: false, error: 'Invalid CSV format. Expected Google Takeout Watch Later export.' };
  }

  const rows: ParsedCSVRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines

    const commaIndex = line.indexOf(',');
    if (commaIndex === -1) continue;

    const videoId = line.substring(0, commaIndex).trim();
    const timestamp = line.substring(commaIndex + 1).trim();

    // Validate video ID format (11 chars, alphanumeric + hyphens + underscores)
    if (!/^[\w-]{11}$/.test(videoId)) continue;

    rows.push({ videoId, addedAt: timestamp });
  }

  return { success: true, rows, totalCount: rows.length };
}
```

### Pattern 2: Batch Processing Server Action with Progress Tracking

**What:** Process metadata enrichment in server-action-invoked batches, with the client polling for progress. Matches the existing sync page pattern exactly.

**When to use:** For the metadata enrichment stage, which makes ~79 API calls.

**Example:**
```typescript
// Source: Existing pattern from src/app/actions/sync.ts + src/components/sync/sync-progress.tsx
// The client calls a "process batch" action repeatedly, updating UI between calls.

// Server action: process one batch of videos
export async function processImportBatch(
  videoIds: string[],
  batchIndex: number,
  batchSize: number = 50,
): Promise<{
  success: boolean;
  processed: number;
  unavailable: number;
  error?: string;
}> {
  const batch = videoIds.slice(batchIndex * batchSize, (batchIndex + 1) * batchSize);
  // Use existing fetchVideoBatch() for metadata
  // Detect unavailable = sent IDs minus returned IDs
}
```

### Pattern 3: Idempotent Playlist Creation (ON CONFLICT DO NOTHING)

**What:** Create the Watch Later playlist entry using Drizzle's `onConflictDoNothing()` on the `youtubeId` unique constraint.

**When to use:** Every import invocation (first or re-import).

**Example:**
```typescript
// Source: Existing pattern from src/lib/youtube/playlists.ts (onConflictDoUpdate)
const [watchLaterPlaylist] = await db
  .insert(playlists)
  .values({
    youtubeId: 'WL',
    title: 'Watch Later',
    description: 'Imported from Google Takeout',
    itemCount: videoCount,
    lastFetched: new Date(),
  })
  .onConflictDoUpdate({
    target: playlists.youtubeId,
    set: {
      itemCount: videoCount,
      updatedAt: new Date(),
    },
  })
  .returning();
```

### Pattern 4: Unavailable Video Detection

**What:** Videos that are deleted/private on YouTube will not appear in the `videos.list` response. Detect them by comparing sent IDs versus returned IDs.

**When to use:** After each `fetchVideoBatch()` call.

**Example:**
```typescript
// Source: Codebase pattern from src/lib/youtube/videos.ts
const sentIds = batch; // string[]
const returnedVideos = await fetchVideoBatch(accessToken, sentIds);
const returnedIds = new Set(returnedVideos.map(v => v.id));

const unavailableIds = sentIds.filter(id => !returnedIds.has(id));

// Insert placeholder records for unavailable videos
for (const id of unavailableIds) {
  await db
    .insert(videos)
    .values({
      youtubeId: id,
      title: '[Unavailable Video]',
      lastFetched: new Date(),
    })
    .onConflictDoNothing(); // Skip if somehow already exists
}
```

### Anti-Patterns to Avoid

- **Uploading the file to the server for parsing:** The CSV is trivially small (~130KB). Parse it client-side with FileReader for instant validation. Never send raw files to server actions (they have a 1MB default limit and add unnecessary latency).

- **Using a single long-running server action:** A single action that runs for 60+ seconds will timeout. Process in batches with the client driving the loop (existing sync pattern).

- **Modifying `fetchVideoBatch()` for this feature:** The existing function already does exactly what is needed (batch of 50, upsert to DB, track quota). Reuse it directly; do not fork or modify it.

- **Adding a unique constraint migration for `playlistVideos`:** The table has been in production without one. Adding it now risks migration issues with existing data. Instead, handle deduplication in application code by checking before insert.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Video metadata fetching | Custom YouTube API calls | Existing `fetchVideoBatch()` in `src/lib/youtube/videos.ts` | Already handles batching, upsert, quota tracking, ETag caching |
| Rate limiting | Custom throttling | Existing `callYouTubeAPI()` with Bottleneck reservoir | Already configured with 10k daily quota, 200ms intervals, retry logic |
| Quota tracking | Manual counting | Existing `trackQuotaUsage()` in `src/lib/youtube/quota.ts` | Already integrated into `fetchVideoBatch()` |
| YouTube client setup | Manual OAuth client | Existing `createYouTubeClient()` in `src/lib/youtube/client.ts` | Already handles OAuth2 credential injection |
| Toast notifications | Custom alerts | Existing Sonner toaster in layout | Already configured with position, duration, rich colours |
| Progress bar | Custom div styling | Existing `@radix-ui/react-progress` component at `src/components/ui/progress.tsx` | Already installed and styled |

**Key insight:** The v1.0 codebase already contains 90% of the backend logic needed for this phase. The `fetchVideoBatch()` function is the workhorse -- it handles YouTube API calls, batching to 50, database upserts with ON CONFLICT DO UPDATE, and quota tracking. The new code primarily orchestrates calling it with CSV-derived video IDs instead of playlist-derived ones.

## Common Pitfalls

### Pitfall 1: playlistVideos Has No Unique Constraint

**What goes wrong:** On re-import, inserting `playlistVideos` records without checking for existing entries creates duplicate rows. The table has NO unique constraint on `(playlist_id, video_id)` -- only a serial primary key.

**Why it happens:** The original code in `videos.ts` line 157 uses `.onConflictDoNothing()` which requires a constraint to trigger. With only a PK constraint, it never triggers a conflict on `(playlist_id, video_id)` duplicates.

**How to avoid:** Before inserting `playlistVideos` entries, query for existing records for the Watch Later playlist. Build a Set of existing `videoId` values and skip any that already exist. This is the application-level deduplication approach.

```typescript
// Query existing relationships for Watch Later playlist
const existingRelations = await db
  .select({ videoId: playlistVideos.videoId })
  .from(playlistVideos)
  .where(eq(playlistVideos.playlistId, watchLaterPlaylistId));

const existingVideoIds = new Set(existingRelations.map(r => r.videoId));

// Only insert new relationships
const newRelations = videoDbRecords.filter(v => !existingVideoIds.has(v.id));
```

**Warning signs:** Row count in `playlistVideos` doubles after re-import.

### Pitfall 2: PostgreSQL Bigint Returns Strings via Drizzle

**What goes wrong:** Aggregate queries like `COUNT(*)` return string values through Drizzle. Arithmetic on strings gives wrong results (string concatenation instead of addition).

**Why it happens:** PostgreSQL's `bigint` type maps to JavaScript strings in the `pg` driver. Drizzle passes these through without conversion.

**How to avoid:** Always wrap aggregate results with `Number()`. The existing codebase already does this (see `getReviewStats()` in `ml-categorisation.ts` line 434).

**Warning signs:** Progress counters showing "12" instead of 3 (string "1" + "2" instead of 1 + 2).

### Pitfall 3: Server Action Serialisation Blocking

**What goes wrong:** Multiple server actions from the same component tree via `startTransition` block each other. A long-running import action prevents other UI interactions.

**Why it happens:** React's server action queue serialises transitions from the same component tree. The project memory explicitly notes this.

**How to avoid:** Process in small batches (1 API call per server action invocation), let the client drive the loop with `setInterval` polling. Each action completes quickly (~1-2 seconds for a batch of 50 videos). This matches the existing sync progress pattern.

**Warning signs:** UI freezes during import; other buttons become unresponsive.

### Pitfall 4: Re-import Must Skip Existing Videos for API Quota Conservation

**What goes wrong:** Re-importing a CSV fetches metadata for all 3,932 videos again, wasting ~79 quota units unnecessarily.

**Why it happens:** Naive implementation sends all video IDs to the YouTube API without checking which already have metadata in the database.

**How to avoid:** Before calling `fetchVideoBatch()`, query the `videos` table for existing records with valid metadata (non-null title that is not '[Unavailable Video]'). Only fetch metadata for genuinely new video IDs.

```typescript
const existingVideos = await db
  .select({ youtubeId: videos.youtubeId })
  .from(videos)
  .where(inArray(videos.youtubeId, allVideoIds));

const existingYoutubeIds = new Set(existingVideos.map(v => v.youtubeId));
const newVideoIds = allVideoIds.filter(id => !existingYoutubeIds.has(id));
```

**Warning signs:** Re-import uses same quota as initial import.

### Pitfall 5: CSV Trailing Newline Creates Empty Row

**What goes wrong:** A trailing newline in the CSV file creates an empty line that fails video ID validation.

**Why it happens:** Google Takeout CSV files typically end with a newline character.

**How to avoid:** Use `.trim()` on the full CSV text before splitting, and skip empty lines during parsing. The code example in Pattern 1 already handles this.

**Warning signs:** "Invalid video ID" errors on the last row.

### Pitfall 6: Unavailable Videos Missing from Database Breaks Relationship Creation

**What goes wrong:** If an unavailable video is not inserted into the `videos` table, the `playlistVideos` foreign key insert fails.

**Why it happens:** `fetchVideoBatch()` only inserts videos that the YouTube API returns. Deleted/private videos are silently omitted from the API response.

**How to avoid:** After `fetchVideoBatch()`, detect missing IDs and insert placeholder records with `title: '[Unavailable Video]'` before creating `playlistVideos` entries. This ensures the foreign key reference exists.

**Warning signs:** Foreign key constraint violations during relationship creation.

## Code Examples

### CSV Upload Component with FileReader

```typescript
// Client component for file upload with instant validation
'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { UploadSimple, FileText, Warning } from '@phosphor-icons/react';

interface CSVUploadProps {
  onParsed: (rows: ParsedCSVRow[]) => void;
}

export function CSVUpload({ onParsed }: CSVUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videoCount, setVideoCount] = useState<number>(0);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const result = parseWatchLaterCSV(text);

      if (!result.success) {
        setError(result.error);
        return;
      }

      setFileName(file.name);
      setVideoCount(result.totalCount);
      setError(null);
      onParsed(result.rows);
    };
    reader.readAsText(file);
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        className="hidden"
      />
      <Button onClick={() => fileInputRef.current?.click()} variant="outline">
        <UploadSimple size={18} className="mr-2" />
        Select CSV File
      </Button>
      {fileName && (
        <div className="flex items-center gap-2 text-sm text-foreground">
          <FileText size={16} />
          <span>{fileName}</span>
          <span className="text-muted-foreground">({videoCount.toLocaleString()} videos)</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <Warning size={16} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
```

### Server Action: Import Batch

```typescript
// Source: Pattern from existing src/app/actions/sync.ts
'use server';

import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db';
import { videos, playlists, playlistVideos } from '@/lib/db/schema';
import { fetchVideoBatch } from '@/lib/youtube/videos';
import { eq, inArray } from 'drizzle-orm';

export async function importWatchLaterBatch(
  videoIds: string[],
  startIndex: number,
  batchSize: number = 50
): Promise<{
  success: boolean;
  processed: number;
  unavailable: number;
  skipped: number;
  error?: string;
}> {
  const session = await auth();
  if (!session?.access_token) {
    return { success: false, processed: 0, unavailable: 0, skipped: 0, error: 'Not authenticated' };
  }

  const batch = videoIds.slice(startIndex, startIndex + batchSize);
  if (batch.length === 0) {
    return { success: true, processed: 0, unavailable: 0, skipped: 0 };
  }

  // Check which already exist with metadata
  const existing = await db
    .select({ youtubeId: videos.youtubeId })
    .from(videos)
    .where(inArray(videos.youtubeId, batch));
  const existingIds = new Set(existing.map(v => v.youtubeId));

  const newIds = batch.filter(id => !existingIds.has(id));
  const skipped = batch.length - newIds.length;

  let unavailable = 0;

  if (newIds.length > 0) {
    // Fetch metadata from YouTube API (uses existing fetchVideoBatch)
    const returned = await fetchVideoBatch(session.access_token, newIds);
    const returnedIds = new Set(returned.map(v => v.id));

    // Insert placeholders for unavailable videos
    const missingIds = newIds.filter(id => !returnedIds.has(id));
    unavailable = missingIds.length;

    for (const id of missingIds) {
      await db.insert(videos).values({
        youtubeId: id,
        title: '[Unavailable Video]',
        lastFetched: new Date(),
      }).onConflictDoNothing();
    }
  }

  return {
    success: true,
    processed: newIds.length - unavailable,
    unavailable,
    skipped,
  };
}
```

### Watch Later Playlist Upsert

```typescript
// Source: Pattern from existing src/lib/youtube/playlists.ts
export async function ensureWatchLaterPlaylist(videoCount: number): Promise<number> {
  const result = await db
    .insert(playlists)
    .values({
      youtubeId: 'WL',
      title: 'Watch Later',
      description: 'Imported from Google Takeout',
      itemCount: videoCount,
      lastFetched: new Date(),
    })
    .onConflictDoUpdate({
      target: playlists.youtubeId,
      set: {
        itemCount: videoCount,
        updatedAt: new Date(),
      },
    })
    .returning({ id: playlists.id });

  return result[0].id;
}
```

### Re-import Deduplication for playlistVideos

```typescript
// Source: Application-level dedup needed because table lacks unique constraint
export async function createPlaylistVideoRelationships(
  playlistId: number,
  videoRows: { youtubeId: string; addedAt: string; position: number }[]
): Promise<{ created: number; skipped: number }> {
  // Get all video DB IDs for the YouTube IDs
  const youtubeIds = videoRows.map(r => r.youtubeId);
  const videoRecords = await db
    .select({ id: videos.id, youtubeId: videos.youtubeId })
    .from(videos)
    .where(inArray(videos.youtubeId, youtubeIds));

  const youtubeToDbId = new Map(videoRecords.map(v => [v.youtubeId, v.id]));

  // Get existing relationships for this playlist
  const existingRelations = await db
    .select({ videoId: playlistVideos.videoId })
    .from(playlistVideos)
    .where(eq(playlistVideos.playlistId, playlistId));

  const existingVideoIds = new Set(existingRelations.map(r => r.videoId));

  let created = 0;
  let skipped = 0;

  for (const row of videoRows) {
    const dbId = youtubeToDbId.get(row.youtubeId);
    if (!dbId) continue; // Video record not found

    if (existingVideoIds.has(dbId)) {
      skipped++;
      continue;
    }

    await db.insert(playlistVideos).values({
      playlistId,
      videoId: dbId,
      position: row.position,
      addedAt: new Date(row.addedAt),
    });
    created++;
  }

  return { created, skipped };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| YouTube API Watch Later access | Google Takeout CSV export | ~2016 | API returns empty/404; CSV is only option |
| Server-side file upload | Client-side FileReader + server action | Next.js 13+ | No need for multipart form handling; parse on client, send data to server |
| Long-running server action | Batch processing with polling | React 18+ transitions | Avoids timeout, enables progress UI |

**Deprecated/outdated:**
- `playlistItems.list({ playlistId: 'WL' })`: Returns empty/404 since ~2016. Do not attempt.
- `playlists.list({ mine: true })` for Watch Later: This endpoint does NOT return the Watch Later playlist.

## Open Questions

1. **Should deleted/private videos be visually distinguished in the UI?**
   - What we know: They will have `title: '[Unavailable Video]'` and no thumbnail/channel data.
   - What's unclear: Whether to show them in the ML pipeline or filter them out.
   - Recommendation: Store them in DB for accurate counts, but the ML pipeline will naturally skip them (no meaningful title to categorise). Consider filtering `[Unavailable Video]` titles from `getDataForCategorisation()` in a future iteration.

2. **Should the import page be added to the main navigation?**
   - What we know: It is a one-time (or occasional) operation, not a daily workflow.
   - What's unclear: Whether it warrants permanent nav space or should be accessible from the dashboard.
   - Recommendation: Add it to the navigation bar with an `UploadSimple` or `FileCsv` icon from Phosphor. The nav already has 7 items; 8 is still manageable. The user needs to discover it easily.

3. **Batch insert vs individual insert for playlistVideos?**
   - What we know: Drizzle supports batch inserts via `.values([...])`. With 3,932 rows, individual inserts work but are slower.
   - What's unclear: Whether the application-level dedup check makes batch insert practical (need to filter the array first).
   - Recommendation: Filter to new-only rows first, then batch insert in chunks of 500. This balances performance with memory usage.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** -- Direct reading of all relevant source files:
  - `src/lib/db/schema.ts` -- Full schema, table definitions, constraints
  - `src/lib/youtube/videos.ts` -- `fetchVideoBatch()` pattern (lines 241-325)
  - `src/lib/youtube/quota.ts` -- Quota tracking utilities
  - `src/lib/youtube/client.ts` -- YouTube client + ETag caching
  - `src/lib/rate-limiter.ts` -- Bottleneck configuration
  - `src/app/actions/sync.ts` -- Server action pattern for long operations
  - `src/components/sync/sync-progress.tsx` -- Polling-based progress UI pattern
  - `src/components/navigation.tsx` -- Navigation structure
  - `drizzle/schema.ts` + `drizzle/0000_rare_hex.sql` -- Actual DB constraints
- **Google Takeout CSV** -- Direct examination of `data/playlists/Watch later-videos.csv` (3,933 lines = 1 header + 3,932 data rows)
- **Project memory (MEMORY.md)** -- Confirmed YouTube API Watch Later limitations, PostgreSQL/Drizzle gotchas, Next.js server action serialisation issues

### Secondary (MEDIUM confidence)
- Web FileReader API -- Standard browser API, well-documented, no version concerns
- Next.js Server Actions file handling -- Based on codebase patterns already in use

### Tertiary (LOW confidence)
- None. All findings are verified against the actual codebase.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All libraries already in the project; no new dependencies needed
- Architecture: HIGH -- All patterns directly observed in existing codebase (sync page, video fetching)
- CSV format: HIGH -- Actual CSV file examined; format is trivially simple
- Pitfalls: HIGH -- All identified from direct codebase analysis (schema constraints, existing patterns)
- Re-import logic: HIGH -- Verified `playlistVideos` table lacks unique constraint via migration SQL

**Critical finding:** The `playlistVideos` table has NO unique constraint on `(playlist_id, video_id)`. The existing `onConflictDoNothing()` in `videos.ts` line 157 operates against the serial PK, not a composite key. Re-import MUST use application-level deduplication.

**Research date:** 2026-02-09
**Valid until:** 2026-03-09 (stable -- no external API changes expected; codebase patterns are established)
