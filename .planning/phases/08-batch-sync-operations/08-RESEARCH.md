# Phase 8: Batch Sync Operations - Research

**Researched:** 2026-02-07
**Domain:** YouTube Data API v3 write operations, quota-aware multi-day batch processing, checkpoint/resume state machines
**Confidence:** HIGH

## Summary

Phase 8 syncs the locally approved category structure to YouTube by creating new playlists, adding videos to them, optionally removing videos from Watch Later, and deleting old playlists. The core challenge is that YouTube API write operations cost 50 quota units each against a 10,000 unit/day limit, making a full sync of ~4,000+ videos across ~25 categories a multi-day operation spanning approximately 20-25 days.

The existing codebase provides strong foundations: Bottleneck rate limiter with reservoir tracking, persistent quota usage tracking in PostgreSQL, ETag-based caching, and a safety system with automatic pre-operation backups and immutable operation logging. The primary new work is a state machine for multi-stage sync orchestration, YouTube API write operation wrappers, and a dedicated sync UI.

**Two critical discoveries drive the architecture:**
1. **Watch Later API is fully deprecated** (since September 2020). `playlistItems.insert`/`playlistItems.delete` do not work on the WL playlist. This operation must be removed from scope or handled manually.
2. **OAuth scope upgrade required.** The current scope is `youtube.readonly`. Phase 8 requires `youtube` or `youtube.force-ssl` for write operations.

**Primary recommendation:** Build a state-machine-driven sync engine with stage-level checkpointing, using the existing Bottleneck + quota tracking infrastructure. Use a dedicated `/sync` page with a preview step that shows exact quota cost estimates and multi-day timeline. Remove Watch Later removal from automated scope.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| googleapis | ^171.3.0 | YouTube Data API v3 client | Already in use (Phase 1). Provides typed `playlists.insert`, `playlists.delete`, `playlistItems.insert`, `playlistItems.delete` methods |
| bottleneck | ^2.19.5 | Rate limiting with quota reservoir | Already in use. Reservoir tracks remaining quota, `stop()` for graceful pause, `updateSettings()` for dynamic reconfiguration |
| drizzle-orm | ^0.45.1 | Database ORM for sync state persistence | Already in use. Will add new sync-specific tables |
| next | ^15.5.12 | App framework, server actions | Already in use. Server actions for sync control, polling for progress updates |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | ^4.3.6 | Validation of sync configuration and API responses | Already in use. Validate sync parameters, API response shapes |
| lucide-react | ^0.563.0 | Icons for sync UI (Play, Pause, RefreshCw, CheckCircle) | Already in use. Sync page icons |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Bottleneck reservoir for quota | Manual counter in DB | Bottleneck already handles this; DB is the persistent layer. Use both together as already designed |
| Server actions + polling | Server-Sent Events (SSE) | SSE provides real-time updates but adds complexity. Polling every 2-3 seconds via server action is simpler and matches existing patterns (e.g., server actions don't stream progress, per Phase 5/6 decisions) |
| Database state machine | BullMQ / Redis queue | Overkill for single-user app. PostgreSQL is already the persistence layer. No need for Redis infrastructure |

**Installation:**
```bash
# No new packages needed - everything is already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   └── youtube/
│       ├── client.ts             # (existing) YouTube API client
│       ├── playlists.ts          # (existing) Read operations
│       ├── videos.ts             # (existing) Read operations
│       ├── quota.ts              # (existing) Quota tracking
│       └── write-operations.ts   # (NEW) playlists.insert/delete, playlistItems.insert/delete
│   └── sync/
│       ├── engine.ts             # (NEW) Sync state machine orchestrator
│       ├── preview.ts            # (NEW) Compute sync plan and quota estimates
│       └── stages.ts             # (NEW) Individual stage executors
├── app/
│   ├── sync/
│   │   └── page.tsx              # (NEW) Dedicated sync page
│   └── actions/
│       └── sync.ts               # (NEW) Server actions for sync control
├── components/
│   └── sync/
│       ├── sync-preview.tsx      # (NEW) Change preview with quota estimate
│       ├── sync-progress.tsx     # (NEW) Stage progress display
│       └── sync-report.tsx       # (NEW) Completion report
└── types/
    └── sync.ts                   # (NEW) Sync-related type definitions
```

### Pattern 1: Stage-Based State Machine

**What:** A sync operation progresses through ordered stages, each tracked in the database. The machine can pause at any stage boundary and resume later.

**When to use:** Multi-day operations where progress must survive process restarts, quota exhaustion, and user-initiated pauses.

**How it works:**
```typescript
// Sync stages in execution order
type SyncStage =
  | 'pending'           // Not started, preview computed
  | 'backup'            // Creating pre-sync backup
  | 'create_playlists'  // Creating new YouTube playlists from categories
  | 'add_videos'        // Adding videos to new playlists
  | 'delete_playlists'  // Deleting old YouTube playlists
  | 'completed'         // All stages done
  | 'failed'            // Terminal failure (user must decide)
  | 'paused';           // Quota exhausted or user-paused

// Sync job record in database
interface SyncJob {
  id: number;
  stage: SyncStage;
  currentStageProgress: number;  // Items completed in current stage
  currentStageTotal: number;     // Total items in current stage
  stageResults: StageResults;    // JSONB: per-stage success/failure counts
  quotaUsedToday: number;        // Units consumed today
  pauseReason: string | null;    // 'quota_exhausted' | 'user_paused' | 'errors_collected'
  errors: SyncError[];           // JSONB: collected errors for review
  startedAt: Date;
  completedAt: Date | null;
  lastResumedAt: Date | null;
}
```

### Pattern 2: Idempotent Stage Execution

**What:** When resuming at a stage, re-executing already-completed items is safe because operations are idempotent or checked.

**When to use:** Stage-level resume where tracking individual items within a stage is not required.

**How it works:**
- `create_playlists`: Before inserting, check if a playlist with the same title already exists (by querying local DB for youtubePlaylistId). If it does, skip. Store the YouTube playlist ID on the category row.
- `add_videos`: Before inserting a video into a playlist, query playlistItems.list to check if already present. Or simply accept the duplicate (YouTube allows duplicates in playlists but will reject exact duplicates of the same video in same playlist).
- `delete_playlists`: Before deleting, verify playlist still exists. If already deleted (404), mark as success and continue.

**Key:** The categories table needs a `youtubePlaylistId` column to map local categories to created YouTube playlists. This enables resume: if the stage restarts, it skips categories that already have a youtubePlaylistId.

### Pattern 3: Quota-Aware Execution Loop

**What:** Each operation checks remaining quota before executing. When quota is low, the engine pauses gracefully.

**When to use:** Any operation that consumes YouTube API quota.

```typescript
// Pseudocode for the execution loop
async function executeStage(stage: SyncStage, operations: Operation[]) {
  for (const op of operations) {
    // Check remaining quota before each operation
    const remaining = await getRemainingQuota();
    if (remaining < QUOTA_PAUSE_THRESHOLD) {
      await pauseSync('quota_exhausted');
      return; // Exit, user will resume tomorrow
    }

    try {
      await executeOperation(op);
      await updateProgress(op);
    } catch (error) {
      if (isQuotaExhaustedError(error)) {
        await pauseSync('quota_exhausted');
        return;
      }
      // Collect error, continue with next operation
      await recordError(op, error);
    }
  }

  // Stage complete - advance to next stage
  await advanceToNextStage();
}
```

### Pattern 4: Polling-Based Progress Updates

**What:** Client polls the server action every 2-3 seconds to get current sync status, rather than using WebSockets or SSE.

**When to use:** Progress display in Next.js App Router where server actions cannot stream.

```typescript
// Client-side polling
useEffect(() => {
  if (syncStatus !== 'running') return;

  const interval = setInterval(async () => {
    const status = await getSyncProgress();
    setProgress(status);

    if (status.stage === 'completed' || status.stage === 'paused' || status.stage === 'failed') {
      clearInterval(interval);
    }
  }, 3000);

  return () => clearInterval(interval);
}, [syncStatus]);
```

### Anti-Patterns to Avoid
- **Per-video checkpoint:** Tracking every individual video's sync status adds massive complexity with minimal benefit. Stage-level resume with idempotent operations is sufficient.
- **Automatic resume on quota reset:** User decided on manual resume. Do not add timer-based auto-resume.
- **Streaming progress via server actions:** Next.js server actions cannot stream. Use polling instead.
- **Shared Bottleneck instance for sync and reads:** The sync engine should track its own quota consumption via the database, not rely solely on the in-memory Bottleneck reservoir (which resets on server restart). The existing `getRemainingQuota()` function reads from the persistent `quotaUsage` table.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate limiting | Custom queue/timer system | Bottleneck (already in use) | Handles concurrency, backoff, reservoir tracking. Well-tested edge cases |
| Quota tracking | In-memory counter | Existing `quotaUsage` table + `getRemainingQuota()` | Must survive server restarts. Already built in Phase 1 |
| Retry with backoff | Manual setTimeout chains | Existing Bottleneck `failed` event handler | Already handles 429 with exponential backoff, ignores 403 quotaExceeded. Extend for write operation errors |
| Pre-sync backup | Custom data export | Existing `createSnapshot('pre_sync')` | Phase 7 backup system already handles full data snapshots |
| Operation audit trail | Custom logging | Existing `logOperation()` | Phase 7 immutable operation log already provides structured audit |
| OAuth scope upgrade | New auth flow | Update scope string in existing `config.ts` + force re-consent | NextAuth handles the OAuth flow; just change the scope parameter |

**Key insight:** Phase 8 builds on top of significant existing infrastructure. The unique new work is: (1) YouTube API write wrappers, (2) sync state machine with stage transitions, (3) sync preview/progress/report UI, and (4) database schema additions for sync tracking.

## Common Pitfalls

### Pitfall 1: Watch Later API Is Fully Deprecated
**What goes wrong:** Attempting to call `playlistItems.delete` or `playlistItems.list` on the Watch Later playlist (ID: 'WL') returns empty results or errors.
**Why it happens:** YouTube deprecated Watch Later API access in 2016, with `playlistItems.insert`/`delete` support for WL fully deprecated as of September 2020 (per YouTube API revision history).
**How to avoid:** Remove "Remove from Watch Later" from the automated sync pipeline. This must be done manually by the user through the YouTube interface, or the app can display instructions for manual cleanup after sync.
**Warning signs:** Empty results from `playlistItems.list` for playlist 'WL'. No error thrown, just no items returned.

### Pitfall 2: OAuth Scope Must Be Upgraded
**What goes wrong:** Write operations (playlists.insert, playlistItems.insert, playlists.delete) fail with 403 Forbidden "Insufficient Permission".
**Why it happens:** Current OAuth scope is `youtube.readonly`. Write operations require `youtube` or `youtube.force-ssl` scope.
**How to avoid:** Change the scope in `src/lib/auth/config.ts` from `youtube.readonly` to `youtube.force-ssl`. User must re-authenticate (sign out + sign in) to grant the new scope. The existing `prompt: "consent"` configuration ensures the consent screen appears on every login.
**Warning signs:** 403 errors on any write operation despite valid authentication.

### Pitfall 3: playlistItems.delete Requires Playlist Item ID, Not Video ID
**What goes wrong:** Trying to delete a video from a playlist using the video's YouTube ID fails.
**Why it happens:** `playlistItems.delete` requires the `playlistItem.id` (a unique identifier for that specific video-in-playlist entry), not the video ID. The playlist item ID is only available from `playlistItems.list` responses.
**How to avoid:** When deleting videos from playlists, first call `playlistItems.list` to get the playlist item IDs, then call `playlistItems.delete` with those IDs. This costs 1 + 50 = 51 units per video (list page + delete), though listing returns up to 50 items per page.
**Warning signs:** "Not Found" errors when passing video IDs to playlistItems.delete.

### Pitfall 4: Quota Math -- Multi-Day Sync is Longer Than Expected
**What goes wrong:** Sync takes 20-25 days instead of the "~2 days" the user might expect.
**Why it happens:** With ~4,000 videos and ~25 categories, the quota breakdown is:
- Create 25 playlists: 25 x 50 = 1,250 units
- Add ~4,000 videos (assuming ~1.1 avg categories/video = ~4,400 inserts): 4,400 x 50 = 220,000 units
- Delete 87 old playlists: 87 x 50 = 4,350 units
- Total: ~225,600 units / 10,000 per day = ~23 days

The preview MUST show this accurately. Do not mislead the user with optimistic estimates.
**How to avoid:** Compute exact operation counts from the actual data before showing the preview. Be transparent about multi-day timeline. Consider: does the user really want multi-category duplicate videos? If each video goes to exactly 1 playlist, it's ~4,000 inserts = 200,000 units = ~20 days.
**Warning signs:** User surprise or frustration at sync duration.

### Pitfall 5: Bottleneck Reservoir Resets on Server Restart
**What goes wrong:** After server restart (e.g., dev server hot reload, deployment), Bottleneck's in-memory reservoir resets to 10,000 even if quota was partially consumed today.
**Why it happens:** Bottleneck reservoir is in-memory only. The `quotaUsage` table tracks persistent usage, but the Bottleneck instance starts fresh.
**How to avoid:** On sync engine initialisation, read `getRemainingQuota()` from the database and call `youtubeRateLimiter.updateSettings({ reservoir: remainingQuota })` to sync the in-memory state with reality. Or, bypass the Bottleneck reservoir entirely for sync operations and rely solely on the DB-based quota check before each operation.
**Warning signs:** Quota exceeded errors despite Bottleneck showing available reservoir.

### Pitfall 6: YouTube playlists.insert Response Contains the New Playlist ID
**What goes wrong:** Not capturing and storing the YouTube playlist ID from the create response, making it impossible to add videos to the newly created playlist.
**Why it happens:** The response from `playlists.insert` contains the full playlist resource including the new `id`. This must be stored in the categories table.
**How to avoid:** Store the YouTube playlist ID immediately after creation. Add a `youtubePlaylistId` column to the `categories` table.
**Warning signs:** Null youtubePlaylistId when trying to add videos.

### Pitfall 7: Server Action Timeout for Long-Running Sync
**What goes wrong:** A single server action call that tries to run the entire sync will timeout.
**Why it happens:** Server actions have default timeouts (typically 10-30 seconds in production). A single API call with Bottleneck delays could take minutes.
**How to avoid:** Use a "fire-and-process" pattern: the server action starts a batch of operations (e.g., 10-20 at a time), saves progress, and returns. The client polls and triggers the next batch. Or process a fixed number of operations per server action invocation.
**Warning signs:** 504 Gateway Timeout or action termination without completion.

## Code Examples

### YouTube API Write Operations (googleapis Node.js)

```typescript
// Source: YouTube Data API v3 official docs + existing project patterns

import { youtube_v3 } from 'googleapis';
import { createYouTubeClient } from '@/lib/youtube/client';
import { callYouTubeAPI } from '@/lib/rate-limiter';
import { trackQuotaUsage, QUOTA_COSTS } from '@/lib/youtube/quota';

/**
 * Create a new YouTube playlist.
 * Quota cost: 50 units
 */
export async function createYouTubePlaylist(
  accessToken: string,
  title: string,
  description?: string
): Promise<string> {
  const youtube = createYouTubeClient(accessToken);

  const response = await callYouTubeAPI(
    async () => {
      const result = await youtube.playlists.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: { title, description: description || '' },
          status: { privacyStatus: 'private' }, // Start as private, user can change later
        },
      });
      return result.data;
    },
    QUOTA_COSTS['playlists.insert'],
    'playlists.insert'
  );

  await trackQuotaUsage('playlists.insert', { title });

  if (!response.id) {
    throw new Error('Playlist created but no ID returned');
  }

  return response.id; // Store this in categories.youtubePlaylistId
}

/**
 * Add a video to a YouTube playlist.
 * Quota cost: 50 units
 */
export async function addVideoToPlaylist(
  accessToken: string,
  playlistId: string,
  videoId: string
): Promise<string> {
  const youtube = createYouTubeClient(accessToken);

  const response = await callYouTubeAPI(
    async () => {
      const result = await youtube.playlistItems.insert({
        part: ['snippet'],
        requestBody: {
          snippet: {
            playlistId,
            resourceId: {
              kind: 'youtube#video',
              videoId,
            },
          },
        },
      });
      return result.data;
    },
    QUOTA_COSTS['playlistItems.insert'],
    'playlistItems.insert'
  );

  await trackQuotaUsage('playlistItems.insert', { playlistId, videoId });

  return response.id!; // playlistItem ID (needed for future deletion if required)
}

/**
 * Delete a YouTube playlist.
 * Quota cost: 50 units
 * Returns 204 No Content on success.
 */
export async function deleteYouTubePlaylist(
  accessToken: string,
  playlistId: string
): Promise<void> {
  const youtube = createYouTubeClient(accessToken);

  await callYouTubeAPI(
    async () => {
      await youtube.playlists.delete({ id: playlistId });
    },
    QUOTA_COSTS['playlists.delete'],
    'playlists.delete'
  );

  await trackQuotaUsage('playlists.delete', { playlistId });
}
```

### Sync State Machine (Pseudocode)

```typescript
// Source: Derived from project patterns and CONTEXT.md decisions

type SyncStage = 'pending' | 'backup' | 'create_playlists' | 'add_videos' | 'delete_playlists' | 'completed' | 'failed' | 'paused';

interface SyncJob {
  id: number;
  stage: SyncStage;
  currentStageProgress: number;
  currentStageTotal: number;
  stageResults: Record<string, { succeeded: number; failed: number; skipped: number }>;
  errors: Array<{ stage: string; entityId: string; message: string; timestamp: Date }>;
  quotaUsedThisSync: number;
  pauseReason: 'quota_exhausted' | 'user_paused' | 'errors_collected' | null;
  startedAt: Date;
  completedAt: Date | null;
}

async function runSyncStage(job: SyncJob, accessToken: string): Promise<void> {
  switch (job.stage) {
    case 'backup':
      await createSnapshot('pre_sync');
      await advanceStage(job.id, 'create_playlists');
      break;

    case 'create_playlists':
      await executeCreatePlaylists(job, accessToken);
      break;

    case 'add_videos':
      await executeAddVideos(job, accessToken);
      break;

    case 'delete_playlists':
      await executeDeletePlaylists(job, accessToken);
      break;
  }
}

// Called by client polling, processes a batch then returns
async function processSyncBatch(batchSize: number = 10): Promise<SyncJob> {
  const job = await getCurrentSyncJob();
  if (!job || job.stage === 'completed' || job.stage === 'paused' || job.stage === 'failed') {
    return job;
  }

  const session = await getServerSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  // Process up to batchSize operations
  await runSyncStage(job, session.access_token);

  return await getCurrentSyncJob();
}
```

### Sync Preview Computation

```typescript
// Source: Derived from project data model and CONTEXT.md decisions

interface SyncPreview {
  stages: {
    createPlaylists: { count: number; quotaCost: number; categoryNames: string[] };
    addVideos: { count: number; quotaCost: number };
    deletePlaylists: { count: number; quotaCost: number; playlistNames: string[] };
  };
  totalQuotaCost: number;
  estimatedDays: number;
  dailyQuotaLimit: number;
}

async function computeSyncPreview(): Promise<SyncPreview> {
  // Count categories that need YouTube playlists (exclude protected "Uncategorised")
  const categoriesToCreate = await db
    .select()
    .from(categories)
    .where(eq(categories.isProtected, false));

  // Count total video-to-category assignments (each becomes a playlistItems.insert)
  const videoAssignments = await db
    .select({ cnt: count() })
    .from(categoryVideos)
    .innerJoin(categories, eq(categoryVideos.categoryId, categories.id))
    .where(eq(categories.isProtected, false));

  const assignmentCount = Number(videoAssignments[0].cnt);

  // Count old playlists to delete
  const oldPlaylists = await db.select().from(playlists);

  const createCost = categoriesToCreate.length * QUOTA_COSTS['playlists.insert'];
  const addCost = assignmentCount * QUOTA_COSTS['playlistItems.insert'];
  const deleteCost = oldPlaylists.length * QUOTA_COSTS['playlists.delete'];
  const totalCost = createCost + addCost + deleteCost;

  return {
    stages: {
      createPlaylists: {
        count: categoriesToCreate.length,
        quotaCost: createCost,
        categoryNames: categoriesToCreate.map(c => c.name),
      },
      addVideos: {
        count: assignmentCount,
        quotaCost: addCost,
      },
      deletePlaylists: {
        count: oldPlaylists.length,
        quotaCost: deleteCost,
        playlistNames: oldPlaylists.map(p => p.title),
      },
    },
    totalQuotaCost: totalCost,
    estimatedDays: Math.ceil(totalCost / 10000),
    dailyQuotaLimit: 10000,
  };
}
```

## Critical Findings

### 1. Watch Later API Deprecation (HIGH Confidence)

The YouTube Data API revision history explicitly states:
- **August 2016:** `contentDetails.relatedPlaylists.watchLater` returns `'WL'` for all channels; `playlistItems.list` returns empty list.
- **September 2020:** `playlistItems.insert` and `playlistItems.delete` support for Watch Later is "fully deprecated."

**Impact:** The CONTEXT.md decision "Remove from Watch Later -- videos are removed from Watch Later after being added to their category playlists" **cannot be implemented via the API**. The user must manually remove videos from Watch Later through the YouTube UI.

**Recommendation:** Remove Watch Later removal from the sync pipeline entirely. Add a post-sync instruction screen: "Sync complete. To clean up your Watch Later, visit YouTube and manually remove videos that have been categorised."

### 2. OAuth Scope Upgrade Required (HIGH Confidence)

Current scope: `https://www.googleapis.com/auth/youtube.readonly`
Required scope: `https://www.googleapis.com/auth/youtube.force-ssl`

The `youtube.force-ssl` scope covers all read and write operations. Changing the scope string in `config.ts` and having the user re-authenticate is sufficient. The existing `prompt: "consent"` configuration ensures the consent screen always appears, so the user will be asked to grant the new scope.

**Google Cloud Console note:** The `youtube.force-ssl` scope is classified as "sensitive" by Google. For the current testing-mode OAuth consent screen, this should work with test users. Production deployment would require Google verification.

### 3. Quota Math Reality (HIGH Confidence)

| Operation | Count | Cost Each | Total Units |
|-----------|-------|-----------|-------------|
| Create playlists | ~25 | 50 | 1,250 |
| Add videos to playlists | ~4,000-4,400 | 50 | 200,000-220,000 |
| Delete old playlists | 87 | 50 | 4,350 |
| **Total** | | | **~205,600-225,600** |
| **Days at 10k/day** | | | **~21-23 days** |

The preview must show this transparently. The "~15,000 units, ~2 days" estimate from the CONTEXT.md discussion was based on incomplete information; the actual cost is an order of magnitude higher.

### 4. No Batch API for Write Operations (HIGH Confidence)

Unlike `videos.list` which accepts up to 50 IDs in one call (1 quota unit), write operations are strictly one-at-a-time:
- `playlistItems.insert`: One video per call, 50 units each
- `playlists.insert`: One playlist per call, 50 units each
- `playlists.delete`: One playlist per call, 50 units each

There is no batch endpoint or way to reduce per-operation costs.

## Claude's Discretion Recommendations

### Sync Operation Order: Create -> Add Videos -> Delete Old Playlists

**Recommendation:** `backup` -> `create_playlists` -> `add_videos` -> `delete_playlists`

**Rationale:** This is the safest order because:
1. Backup first preserves the pre-sync state (leveraging Phase 7)
2. Create playlists before adding videos (you need the playlist to exist)
3. Add all videos before deleting old playlists (ensures no data loss -- old playlists still exist as a safety net until videos are confirmed in new structure)
4. Delete old playlists last (destructive operation only after everything else succeeds)

Watch Later removal has been dropped due to API deprecation.

### Page Placement: Dedicated /sync Page

**Recommendation:** Create a dedicated `/sync` page accessible from the navigation bar.

**Rationale:**
- The sync workflow has distinct stages (preview, in-progress, report) that would be cramped inside the dashboard
- A dedicated page can show the full preview table, progress indicators, and completion report without competing for space
- Matches the existing pattern: each major workflow has its own page (`/analysis`, `/videos`, `/ml-categorization`, `/ml-review`, `/safety`)
- Add a "Sync" item to the navigation bar with a `RefreshCw` (or `Upload`) icon from lucide-react

### Change Preview Grouping: By Operation Type

**Recommendation:** Group the preview by operation type (Create Playlists, Add Videos, Delete Playlists), not by category.

**Rationale:**
- Shows the three distinct stages clearly
- Quota costs are uniform within each stage (all creates cost 50, all adds cost 50)
- Easier to understand the multi-day timeline when you can see "Stage 2: Add 4,200 videos -- 210,000 units -- ~21 days"
- By-category grouping would create a very long list (25+ categories) where each entry shows a small number
- Within each stage section, list the specific items (e.g., playlist names to create, count of videos per category)

### Retry Strategy and Exponential Backoff

**Recommendation:** Extend the existing Bottleneck `failed` handler for write operations:
- 429 Rate Limit: Retry with existing exponential backoff (200ms, 400ms, 800ms... up to 30s), max 3 retries
- 403 quotaExceeded: Do NOT retry. Immediately pause sync with reason `'quota_exhausted'`
- 404 Not Found (on delete): Treat as success (playlist already deleted -- idempotent)
- 409 Conflict / duplicate: Treat as success for `playlistItems.insert` (video already in playlist)
- 5xx Server Error: Retry up to 3 times with exponential backoff (1s, 2s, 4s)
- All other errors: Collect in errors array, continue to next operation

### Quota Threshold for Pausing

**Recommendation:** Pause when `remainingQuota < 200` (i.e., fewer than 4 write operations possible).

**Rationale:**
- Each write operation costs 50 units, so 200 units = 4 operations
- Provides a small buffer to avoid accidentally exceeding the limit
- The success criteria mention "9,000 units used" as the pause point (= 1,000 remaining). 200 remaining is more aggressive but safer. Given the 20+ day timeline, preserving a few hundred units per day for any read operations the user might trigger is prudent.
- Recommend 1,000 remaining (9,000 used) as the default, matching the success criteria. This leaves room for the user to browse the app (which may trigger read operations) without hitting the limit.

**Final recommendation: Pause at 1,000 remaining (9,000 used today)** to match the success criteria exactly.

### Idempotency Approach for Stage-Level Resume

**Recommendation:** Use local database state to determine which operations within a stage are complete:

| Stage | Idempotency Check |
|-------|-------------------|
| `create_playlists` | Category has non-null `youtubePlaylistId` -> skip |
| `add_videos` | `syncVideoStatus` table tracks each (categoryId, videoId) pair as pending/completed/failed |
| `delete_playlists` | Playlist record has `deletedFromYoutubeAt` timestamp -> skip. 404 on delete -> treat as success |

For `add_videos` (the longest stage, spanning ~20 days), a simple tracking table is needed despite the "stage-level resume" user decision, because you cannot re-insert 4,000 videos every time you resume. The compromise: track at the video-assignment level within the add_videos stage, but don't expose this granularity to the user. The UI shows "Adding videos: 1,234 / 4,200" which is stage-level from the user's perspective.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Watch Later API access | Fully deprecated | September 2020 | Cannot programmatically remove from Watch Later |
| `youtube.readonly` scope | Need `youtube.force-ssl` for writes | Scope has existed since API v3 launch | Must upgrade OAuth scope and re-authenticate user |
| Bottleneck reservoir as sole quota tracker | DB-based quota + Bottleneck as rate limiter | Project architecture decision (Phase 1) | Dual tracking provides resilience across restarts |

**Deprecated/outdated:**
- Watch Later playlist API access (since 2020): Cannot list, insert, or delete items in WL playlist via API
- `contentDetails.relatedPlaylists.watchLater` (since 2016): Returns hardcoded 'WL' for all channels

## Database Schema Additions

The following new tables/columns are needed:

### New Column: `categories.youtubePlaylistId`
```sql
ALTER TABLE categories ADD COLUMN youtube_playlist_id TEXT;
```
Maps each local category to its created YouTube playlist. Used for idempotent resume of `create_playlists` stage.

### New Table: `syncJobs`
Tracks the overall sync operation state machine.
```sql
CREATE TABLE sync_jobs (
  id SERIAL PRIMARY KEY,
  stage TEXT NOT NULL DEFAULT 'pending',
  current_stage_progress INTEGER NOT NULL DEFAULT 0,
  current_stage_total INTEGER NOT NULL DEFAULT 0,
  stage_results JSONB NOT NULL DEFAULT '{}',
  errors JSONB NOT NULL DEFAULT '[]',
  quota_used_this_sync INTEGER NOT NULL DEFAULT 0,
  pause_reason TEXT,
  preview_data JSONB,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  last_resumed_at TIMESTAMP,
  backup_snapshot_id INTEGER REFERENCES backup_snapshots(id)
);
```

### New Table: `syncVideoOperations`
Tracks individual video-to-playlist operations within the `add_videos` stage for idempotent resume.
```sql
CREATE TABLE sync_video_operations (
  id SERIAL PRIMARY KEY,
  sync_job_id INTEGER NOT NULL REFERENCES sync_jobs(id),
  category_id INTEGER NOT NULL REFERENCES categories(id),
  video_id INTEGER NOT NULL REFERENCES videos(id),
  youtube_video_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, completed, failed, skipped
  error_message TEXT,
  completed_at TIMESTAMP
);
```

### New Column: `playlists.deletedFromYoutubeAt`
```sql
ALTER TABLE playlists ADD COLUMN deleted_from_youtube_at TIMESTAMP;
```
Tracks which old playlists have been deleted for idempotent resume of `delete_playlists` stage.

## Open Questions

### 1. Multi-Day Token Expiry
- **What we know:** Access tokens expire after 1 hour. The existing JWT callback refreshes tokens automatically using the refresh_token.
- **What's unclear:** Over a 20+ day sync, will the refresh_token itself remain valid? Google may rotate or expire long-lived refresh tokens.
- **Recommendation:** The existing token refresh logic should handle this. If the refresh_token is revoked, the session callback sets `error: "RefreshAccessTokenError"`, and the sync should pause with a clear message asking the user to re-authenticate. Add this check to the sync loop.

### 2. YouTube Playlist Limit Per Channel
- **What we know:** YouTube has a limit on the number of playlists per channel, historically around 200.
- **What's unclear:** The exact current limit (may have changed). With 87 old + 25 new = 112 playlists, we should be fine, but worth noting.
- **Recommendation:** Check during the create_playlists stage; handle "too many playlists" errors gracefully.

### 3. User Expectation Management for ~23-Day Sync
- **What we know:** The user expected "~15,000 units, ~2 days" per the CONTEXT.md discussion.
- **What's unclear:** Whether the user will find a ~23-day sync acceptable.
- **Recommendation:** The preview page must be brutally honest about the timeline. Consider presenting the option: "With multi-category videos, total operations: 4,400. One category per video: 3,932. This affects sync duration from 23 days to 20 days." The user should make this informed decision at the preview stage.

## Sources

### Primary (HIGH confidence)
- YouTube Data API v3 revision history (https://developers.google.com/youtube/v3/revision_history) - Watch Later deprecation timeline, verified via WebFetch
- YouTube Data API v3 official docs - playlistItems.insert, playlistItems.delete, playlists.insert, playlists.delete parameters and quota costs, verified via WebFetch
- Context7 `/sgrondin/bottleneck` - Reservoir management, stop/drain, updateSettings, failed events, retry patterns
- Codebase analysis - Direct reading of 15+ source files across src/lib/, src/app/actions/, src/types/, src/components/

### Secondary (MEDIUM confidence)
- YouTube quota calculator (https://developers.google.com/youtube/v3/determine_quota_cost) - Confirmed 50 units for all write operations
- Google OAuth scope documentation - youtube.force-ssl scope requirements for write operations

### Tertiary (LOW confidence)
- YouTube playlist-per-channel limit (~200) - sourced from community knowledge, not verified against official docs. LOW confidence. Flag for validation during implementation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using only existing project dependencies
- Architecture: HIGH - State machine pattern well-understood, based on existing project patterns
- YouTube API operations: HIGH - Verified against official docs via WebFetch
- Watch Later deprecation: HIGH - Verified against official revision history
- Quota math: HIGH - Arithmetic from verified per-operation costs
- Pitfalls: HIGH - Derived from official docs + codebase analysis
- Playlist-per-channel limit: LOW - Community knowledge, not officially verified

**Research date:** 2026-02-07
**Valid until:** 2026-03-07 (30 days - YouTube API is stable, unlikely to change)
