# Phase 2: Playlist Analysis & Consolidation - Research

**Researched:** 2026-02-06
**Domain:** Playlist duplicate detection, text similarity clustering, consolidation proposal UI, split-panel analysis views
**Confidence:** HIGH

## Summary

Phase 2 requires building a comprehensive analysis and consolidation system for 87 YouTube playlists. The work divides into three domains: (1) backend analysis -- duplicate video detection via SQL aggregation, playlist name clustering via Dice coefficient similarity + hierarchical clustering, and proposal generation with validation; (2) persistence -- new database tables for proposals, analysis sessions, and duplicate records; (3) UI -- a category-centric split-panel view with resizable panels, approval/rejection workflow, batch operations, detailed conflict resolution, and a guided split wizard.

The CONTEXT.md decisions are detailed and prescriptive, specifying exactly what the UI must include: side-by-side resizable panels, category-centric view, color-coded confidence badges, progress tracking with auto-save, bulk duplicate resolution, Conservative/Aggressive algorithm modes, and a comprehensive final review screen. The UI is substantially more complex than the original Phase 2 plans assumed.

The standard approach uses: (a) `fast-dice-coefficient` for O(n) string similarity (the old `string-similarity` package is unmaintained), (b) `ml-hclust` v4.0.0 for hierarchical clustering with its built-in `group(k)` method to cut the dendrogram into exactly k clusters, (c) shadcn/ui Resizable component (built on `react-resizable-panels` v4.6.0) for the split-panel layout, (d) shadcn/ui DataTable + `@tanstack/react-table` for paginated, sortable, selectable lists, (e) `react-hotkeys-hook` for keyboard navigation, and (f) Drizzle ORM aggregate queries for duplicate detection.

**Primary recommendation:** Build the analysis engine as pure server-side functions (no API cost, all data is cached in PostgreSQL from Phase 1). Use shadcn/ui Resizable + DataTable for the split-panel category view, persist all state to database via debounced server actions for auto-save, and implement the algorithm with Conservative/Aggressive presets by varying the similarity threshold passed to `ml-hclust`'s `group()` method.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ml-hclust | 4.0.0 | Hierarchical clustering (AGNES) with `group(k)` method | TypeScript-native, MIT licensed, has built-in `group(k)` to cut dendrogram into exactly k clusters. Published Nov 2025, actively maintained by mljs org |
| fast-dice-coefficient | 1.0.0 | Dice coefficient string similarity | O(n) linear time vs O(n^2) for string-similarity. 44k ops/sec vs 7.5k ops/sec. Zero dependencies |
| @tanstack/react-table | 8.21.3 | Headless table with sort/filter/paginate/select | Standard for shadcn/ui data tables. Powers pagination, sorting, row selection with checkboxes. React 19 compatible |
| react-resizable-panels | 4.6.0 | Resizable split-panel layouts | Underlies shadcn/ui Resizable component. Supports horizontal/vertical, keyboard nav, Server Components, pixel/percentage units |
| react-hotkeys-hook | 5.2.1 | Keyboard shortcuts for navigation | Arrow keys, Enter, batch operations. Scoped hotkeys prevent conflicts. Used in Client Components with 'use client' |
| lucide-react | 0.563.0 | Icons for status badges and actions | Standard icon library for shadcn/ui. Check, X, AlertTriangle, ChevronRight etc. |
| zod | 4.3.6 | Validation for playlist limits and proposals | Already in stack from Phase 1. .max() for video count validation, schema types |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| drizzle-orm | 0.45.1 | SQL aggregation for duplicate detection | Already in stack. GROUP BY, HAVING, count, countDistinct for finding cross-playlist duplicates |
| shadcn/ui components | latest | Resizable, DataTable, Badge, Progress, ScrollArea, Dialog, Checkbox, Button | Install individually via CLI: `npx shadcn@latest add [component]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| fast-dice-coefficient | cmpstr (actively maintained, 11 metrics) | cmpstr is more featureful but heavier; fast-dice-coefficient is focused, O(n), sufficient for 87 short playlist titles |
| fast-dice-coefficient | string-similarity 4.0.4 | string-similarity is unmaintained (5 years, no updates); fast-dice-coefficient is faster and sufficient |
| ml-hclust group(k) | Custom threshold-based cutting | group(k) is built into the library and produces exactly k clusters. Custom code would be error-prone |
| react-resizable-panels | CSS grid with fixed panels | User decision requires toggle between horizontal/vertical split and resizable panels |
| @tanstack/react-table | Manual HTML tables | DataTable needed for pagination (50/100/250/all), sorting, checkbox selection per CONTEXT.md |

**Installation:**
```bash
npm install ml-hclust fast-dice-coefficient @tanstack/react-table react-hotkeys-hook
npx shadcn@latest add resizable table badge progress scroll-area dialog checkbox button separator card tabs
# lucide-react is typically already installed with shadcn/ui
# zod, drizzle-orm already in project from Phase 1
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  app/
    analysis/
      page.tsx                          # Analysis page (Server Component - loads data from DB)
      layout.tsx                        # Layout with nav back to dashboard
    actions/
      analysis.ts                       # Server actions: runAnalysis, approveProposal, rejectProposal, etc.
  lib/
    analysis/
      duplicates.ts                     # SQL aggregate queries for duplicate video detection
      similarity.ts                     # Dice coefficient pairwise similarity matrix
      clustering.ts                     # ml-hclust AGNES clustering + group(k)
      proposals.ts                      # Generate consolidation proposals from clusters
      validation.ts                     # Zod schemas + YouTube limit validation
      category-naming.ts               # Extract meaningful category names from cluster titles
    db/
      schema.ts                         # ADD: analysisSession, consolidationProposals, duplicateRecords tables
  components/
    analysis/
      analysis-dashboard.tsx            # Top-level client component orchestrating the view
      summary-card.tsx                  # "87 playlists -> 28 categories, 234 duplicates" overview
      category-list.tsx                 # Left panel: list of proposed categories with status badges
      category-detail.tsx               # Right panel: detail view for selected category
      duplicate-resolver.tsx            # Conflict resolution view with bulk actions
      confidence-badge.tsx              # Color-coded HIGH/MEDIUM/LOW badge
      video-list-paginated.tsx          # Paginated video list with search/filter
      proposal-actions.tsx              # Approve/reject/adjust buttons
      split-wizard.tsx                  # Guided split dialog (How many? -> Name -> Assign)
      final-review.tsx                  # Pre-execution comprehensive review screen
      progress-tracker.tsx              # "Reviewed: 12/25 categories" with progress bar
      algorithm-mode-toggle.tsx         # Conservative/Aggressive mode selector
      analysis-loading.tsx              # Staged loading: "Detecting duplicates... (1/3)"
```

### Pattern 1: Duplicate Video Detection via SQL Aggregation
**What:** Use Drizzle ORM `countDistinct` with GROUP BY and HAVING to find videos appearing in multiple playlists. All data already in PostgreSQL from Phase 1 sync.
**When to use:** During analysis generation, and when displaying overlap statistics.
**Example:**
```typescript
// Source: Drizzle ORM docs (https://orm.drizzle.team/docs/select)
import { db } from '@/lib/db'
import { playlistVideos, videos, playlists } from '@/lib/db/schema'
import { eq, sql, count, countDistinct } from 'drizzle-orm'

export async function findDuplicateVideos() {
  // Step 1: Find videos in multiple playlists
  const duplicates = await db
    .select({
      videoId: playlistVideos.videoId,
      playlistCount: sql<number>`count(distinct ${playlistVideos.playlistId})`.as('playlist_count'),
    })
    .from(playlistVideos)
    .groupBy(playlistVideos.videoId)
    .having(sql`count(distinct ${playlistVideos.playlistId}) > 1`)

  // Step 2: For each duplicate, get full details
  const detailed = await Promise.all(
    duplicates.map(async (dup) => {
      const [video] = await db
        .select()
        .from(videos)
        .where(eq(videos.id, dup.videoId))
        .limit(1)

      const containingPlaylists = await db
        .select({
          playlistId: playlists.id,
          playlistTitle: playlists.title,
          playlistYoutubeId: playlists.youtubeId,
        })
        .from(playlistVideos)
        .innerJoin(playlists, eq(playlistVideos.playlistId, playlists.id))
        .where(eq(playlistVideos.videoId, dup.videoId))

      return {
        video,
        playlistCount: dup.playlistCount,
        playlists: containingPlaylists,
      }
    })
  )

  return detailed
}

// Count unique videos for a set of playlists (for consolidated category size)
export async function countUniqueVideosForPlaylists(playlistIds: number[]): Promise<number> {
  const result = await db
    .select({
      count: countDistinct(playlistVideos.videoId),
    })
    .from(playlistVideos)
    .where(sql`${playlistVideos.playlistId} IN (${sql.join(playlistIds.map(id => sql`${id}`), sql`, `)})`)

  return result[0]?.count ?? 0
}
```

### Pattern 2: Playlist Similarity + Hierarchical Clustering with group(k)
**What:** Compute pairwise Dice coefficient similarity between all 87 playlist titles. Feed distance matrix to ml-hclust AGNES. Use built-in `group(k)` method to cut dendrogram into target number of clusters.
**When to use:** When generating initial consolidation proposals.
**Example:**
```typescript
// Source: ml-hclust GitHub (https://github.com/mljs/hclust), fast-dice-coefficient npm
import { agnes } from 'ml-hclust'
import { similarity } from 'fast-dice-coefficient'

interface PlaylistForClustering {
  id: number
  title: string
  itemCount: number
}

// Aggressive mode: lower target count (more merging), Conservative: higher target count (less merging)
const ALGORITHM_PRESETS = {
  aggressive: { targetClusters: 25 },
  conservative: { targetClusters: 35 },
} as const

export function clusterPlaylists(
  playlists: PlaylistForClustering[],
  mode: 'aggressive' | 'conservative' = 'aggressive'
): number[][] {
  const n = playlists.length
  const titles = playlists.map(p => p.title.toLowerCase())

  // Build distance matrix: distance = 1 - similarity
  const distances: number[][] = Array.from({ length: n }, () => Array(n).fill(0))

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = similarity(titles[i], titles[j])
      const distance = 1 - sim
      distances[i][j] = distance
      distances[j][i] = distance
    }
  }

  // AGNES hierarchical clustering with average linkage
  const tree = agnes(distances, { method: 'average' })

  // Use built-in group() to cut into target number of clusters
  const { targetClusters } = ALGORITHM_PRESETS[mode]
  const clusters = tree.group(targetClusters)

  // clusters is an array of Cluster objects; extract leaf indices
  return clusters.map(cluster => cluster.indices())
}
```

### Pattern 3: Resizable Split-Panel Layout
**What:** Category-centric view with resizable left/right panels. Left panel shows category list, right panel shows detail when selected. User can toggle between horizontal and vertical orientation.
**When to use:** Main analysis page layout.
**Example:**
```tsx
// Source: shadcn/ui Resizable docs (https://ui.shadcn.com/docs/components/radix/resizable)
'use client'

import { useState } from 'react'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'

type Orientation = 'horizontal' | 'vertical'

export function AnalysisLayout() {
  const [orientation, setOrientation] = useState<Orientation>('horizontal')
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)

  return (
    <div className="h-[calc(100vh-200px)]">
      <ResizablePanelGroup direction={orientation}>
        <ResizablePanel defaultSize={35} minSize={25}>
          <CategoryList
            onSelect={setSelectedCategoryId}
            selectedId={selectedCategoryId}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={65} minSize={30}>
          {selectedCategoryId ? (
            <CategoryDetail categoryId={selectedCategoryId} />
          ) : (
            <EmptyState message="Select a category to view details" />
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
```

### Pattern 4: Auto-Save State via Debounced Server Actions
**What:** All approvals/rejections save automatically to database. Use debounced server action calls so rapid changes batch together.
**When to use:** Every user interaction that changes proposal state (approve, reject, adjust).
**Example:**
```typescript
// Server action (src/app/actions/analysis.ts)
'use server'

import { db } from '@/lib/db'
import { consolidationProposals } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function updateProposalStatus(
  proposalId: number,
  status: 'pending' | 'approved' | 'rejected'
) {
  await db
    .update(consolidationProposals)
    .set({
      status,
      updatedAt: new Date(),
      ...(status === 'approved' ? { approvedAt: new Date() } : {}),
    })
    .where(eq(consolidationProposals.id, proposalId))

  revalidatePath('/analysis')
  return { success: true }
}

// Client-side usage with immediate save
// No debouncing needed for discrete approve/reject actions
// But debounce manual edits (playlist reassignment, etc.)
```

### Pattern 5: Database Schema for Analysis State
**What:** New tables to persist analysis sessions, proposals, and duplicate records. Enables multi-session workflow with staleness detection.
**When to use:** Store all analysis results and user decisions.
**Example:**
```typescript
// Source: Drizzle ORM schema patterns + existing project conventions
import { pgTable, serial, text, timestamp, integer, jsonb, pgEnum, boolean } from 'drizzle-orm/pg-core'

export const proposalStatusEnum = pgEnum('proposal_status', ['pending', 'approved', 'rejected'])
export const algorithmModeEnum = pgEnum('algorithm_mode', ['conservative', 'aggressive'])

// Track analysis sessions for staleness detection
export const analysisSessions = pgTable('analysis_sessions', {
  id: serial('id').primaryKey(),
  mode: algorithmModeEnum('mode').notNull().default('aggressive'),
  playlistCount: integer('playlist_count').notNull(),
  proposalCount: integer('proposal_count').notNull(),
  duplicateCount: integer('duplicate_count').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  playlistDataTimestamp: timestamp('playlist_data_timestamp').notNull(), // When playlist data was last synced
})

// Individual consolidation proposals
export const consolidationProposals = pgTable('consolidation_proposals', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id').references(() => analysisSessions.id).notNull(),
  categoryName: text('category_name').notNull(),
  sourcePlaylistIds: jsonb('source_playlist_ids').$type<number[]>().notNull(),
  uniqueVideoCount: integer('unique_video_count').notNull(), // After deduplication
  duplicateVideoCount: integer('duplicate_video_count').notNull(),
  confidenceScore: integer('confidence_score').notNull(), // 0-100
  confidenceReason: text('confidence_reason').notNull(),
  status: proposalStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  approvedAt: timestamp('approved_at'),
})

// Track duplicate videos found during analysis
export const duplicateRecords = pgTable('duplicate_records', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id').references(() => analysisSessions.id).notNull(),
  videoId: integer('video_id').references(() => videos.id).notNull(),
  playlistIds: jsonb('playlist_ids').$type<number[]>().notNull(),
  occurrenceCount: integer('occurrence_count').notNull(),
  resolvedPlaylistId: integer('resolved_playlist_id'), // Which playlist "wins" (null = unresolved)
  analyzedAt: timestamp('analyzed_at').notNull().defaultNow(),
})
```

### Anti-Patterns to Avoid
- **Do not cluster videos instead of playlists.** Phase 2 clusters 87 playlist titles into ~25-35 categories. Video-level categorization is Phase 5 (ML).
- **Do not use Levenshtein distance for short playlist names.** Dice coefficient handles abbreviations ("JS" vs "JavaScript") better than character-edit distance.
- **Do not load all videos into memory for duplicate detection.** Use SQL GROUP BY with HAVING -- the database does the work.
- **Do not run analysis on page load.** Analysis is triggered by explicit "Run Analysis" button (user decision). Cache results in database.
- **Do not store playlist names in proposals.** Store playlist IDs. Display current names fetched from playlists table (handles renames).
- **Do not skip validation before approval.** Validate at pre-approval check time (user decision), not real-time. But always validate when user clicks "Execute consolidation".
- **Do not hand-roll resizable panels.** Use shadcn/ui Resizable (react-resizable-panels) which handles keyboard nav, touch, RTL, and accessibility.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| String similarity algorithm | Custom bigram matcher | fast-dice-coefficient | O(n) performance, zero deps, well-tested implementation |
| Hierarchical clustering | Manual threshold-based grouping | ml-hclust AGNES + group(k) | Built-in `group(k)` method cuts dendrogram into exactly k clusters; handles linkage methods properly |
| Resizable split panels | CSS flexbox with drag handler | shadcn/ui Resizable (react-resizable-panels) | Keyboard nav, touch support, pixel/percentage units, Server Component compatible, min/max size constraints |
| Paginated data table | Custom table with manual pagination | shadcn/ui DataTable + @tanstack/react-table | Sorting, filtering, row selection, pagination with configurable page sizes -- all built in |
| Keyboard shortcuts | addEventListener('keydown') handlers | react-hotkeys-hook | Scoped shortcuts prevent conflicts, works with 'use client', handles modifier keys |
| Duplicate detection | Nested loops comparing video arrays | PostgreSQL GROUP BY + HAVING | Database returns only duplicates, sub-100ms for 87 playlists, proper indexing |
| YouTube limit validation | Manual if-statements | Zod schema with .max(4500) | Type-safe, composable, already in stack, generates TS types from schema |

**Key insight:** The analysis engine is entirely server-side (data already in PostgreSQL from Phase 1). No YouTube API calls needed. The complexity is in the UI -- the CONTEXT.md decisions specify a feature-rich interface with split panels, batch operations, keyboard nav, progress tracking, guided wizards, and a comprehensive final review. Plan accordingly.

## Common Pitfalls

### Pitfall 1: Unmaintained string-similarity Package
**What goes wrong:** Using `string-similarity` (4.0.4, unmaintained for 5 years) introduces security/compatibility risk with no path for bug fixes.
**Why it happens:** Old research recommended it. npm page still shows high download counts.
**How to avoid:** Use `fast-dice-coefficient` instead. Same algorithm (Dice/Sorensen), faster (44k vs 7.5k ops/sec), O(n) vs O(n^2). API is `similarity(str1, str2)` returning 0-1.
**Warning signs:** npm audit warnings, TypeScript type issues with `@types/string-similarity`.

### Pitfall 2: Not Using ml-hclust's Built-in group(k)
**What goes wrong:** Developer implements custom dendrogram cutting logic that produces wrong cluster counts, misses edge cases (empty clusters, single-item clusters).
**Why it happens:** Old research noted `cutDendrogram` as TODO. The `group(k)` method was not discovered.
**How to avoid:** Use `tree.group(k)` which is built into ml-hclust. It uses a max-heap to merge leaves until reaching exactly k clusters. Returns array of Cluster objects with `.indices()` for leaf indices.
**Warning signs:** Custom tree traversal code, cluster count not matching target, off-by-one errors.

### Pitfall 3: Ignoring YouTube's 5,000 Video Limit During Validation
**What goes wrong:** User approves category with 6,000 videos. Phase 8 sync fails after adding 5,000.
**Why it happens:** Validation only at sync time, not during analysis approval.
**How to avoid:** Per CONTEXT.md, validate at pre-approval check time (when user clicks finalize). Use `countUniqueVideosForPlaylists()` to get ACTUAL unique count after dedup (not raw sum). Color-code: Green <3000, Yellow 3000-4500, Red >4500.
**Warning signs:** No validation before "Execute consolidation" button, using raw itemCount sum instead of deduplicated count.

### Pitfall 4: Calculating Video Counts from Raw Sums Instead of Deduplicated Counts
**What goes wrong:** Category shows "4,800 videos" based on sum of source playlists' itemCount. After dedup, actual count is 3,200. User unnecessarily splits category.
**Why it happens:** Using `SUM(playlists.itemCount)` instead of `COUNT(DISTINCT videoId)` across source playlists.
**How to avoid:** Always use `countUniqueVideosForPlaylists(playlistIds)` which counts DISTINCT videoId across the playlist_videos table for the given playlist set.
**Warning signs:** Category video counts don't match what user sees in YouTube.

### Pitfall 5: Not Persisting Analysis State for Multi-Session Workflow
**What goes wrong:** User reviews 10/25 categories, closes browser. Returns next day -- all progress lost, must start over.
**Why it happens:** Storing approval state only in React state (client-side), not in database.
**How to avoid:** Per CONTEXT.md, auto-save all state to database. Each approve/reject immediately persists via server action. Analysis page loads from database on mount, restoring all progress.
**Warning signs:** No database table for proposal status, using only useState/useReducer for approval tracking.

### Pitfall 6: Stale Analysis After New Data Sync
**What goes wrong:** User runs analysis, then syncs new YouTube data (adding videos). Old analysis proposals show incorrect video counts.
**Why it happens:** Analysis session doesn't track when playlist data was last synced.
**How to avoid:** Per CONTEXT.md, implement staleness detection. Store `playlistDataTimestamp` in `analysisSessions` table. Compare against latest `playlists.lastFetched`. If newer data exists, show "Data has changed since analysis. Re-analyze?" prompt.
**Warning signs:** No timestamp tracking, analysis always shows cached results regardless of data changes.

### Pitfall 7: Poor Category Name Generation
**What goes wrong:** Cluster containing "JavaScript Tutorials", "JS Advanced", "Web Dev" gets named "Cluster 0" or "the".
**Why it happens:** Naive word-frequency approach picks common stopwords or generic terms.
**How to avoid:** Extract meaningful words, filter stopwords (the, and, of, videos, playlist, my), prefer longer/more descriptive words. Use the longest playlist name in cluster as default, allow user edit later (in Phase 3 per CONTEXT.md).
**Warning signs:** Category names are "Cluster_N", single common words, or very long concatenations.

### Pitfall 8: Aggressive Algorithm Mode Producing Too Few Categories
**What goes wrong:** Aggressive mode (targetClusters=25) merges unrelated playlists. "Bardcore" and "Post punk" end up in same music category alongside "MUSIC" and "Music Vids".
**Why it happens:** With only 87 playlists and target of 25, average linkage clustering must merge some dissimilar playlists. String similarity alone cannot detect that "Bardcore" and "Post punk" are music-related.
**How to avoid:** For clusters where all members have low pairwise similarity (<0.2), mark confidence as LOW and place in "Review needed" section. Also consider video overlap as a secondary signal -- playlists sharing many videos are likely related regardless of name similarity.
**Warning signs:** Many LOW confidence proposals, unrelated playlists grouped together, user rejects most proposals.

## Code Examples

### Confidence Score Calculation
```typescript
// Confidence based on name similarity + video overlap
export function calculateConfidence(
  clusterTitles: string[],
  videoOverlapPercent: number
): { score: number; reason: string } {
  // Average pairwise name similarity within cluster
  let totalSim = 0
  let pairs = 0
  for (let i = 0; i < clusterTitles.length; i++) {
    for (let j = i + 1; j < clusterTitles.length; j++) {
      totalSim += similarity(clusterTitles[i].toLowerCase(), clusterTitles[j].toLowerCase())
      pairs++
    }
  }
  const avgNameSim = pairs > 0 ? totalSim / pairs : 1

  // Combined score: 60% name similarity, 40% video overlap
  const score = Math.round((avgNameSim * 0.6 + (videoOverlapPercent / 100) * 0.4) * 100)

  const level = score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW'
  const reason = `Name similarity: ${Math.round(avgNameSim * 100)}%, Video overlap: ${videoOverlapPercent}%`

  return { score, reason }
}
```

### Category Naming from Cluster
```typescript
const STOPWORDS = new Set([
  'the', 'and', 'of', 'in', 'for', 'to', 'a', 'an', 'my',
  'videos', 'playlist', 'watch', 'later', 'vids',
])

export function generateCategoryName(playlistTitles: string[]): string {
  if (playlistTitles.length === 1) return playlistTitles[0]

  // Score each title: prefer longer, more descriptive names
  const scored = playlistTitles.map(title => ({
    title,
    wordCount: title.split(/\s+/).filter(w => !STOPWORDS.has(w.toLowerCase())).length,
    length: title.length,
  }))

  // Return the most descriptive title (most meaningful words, then longest)
  scored.sort((a, b) => b.wordCount - a.wordCount || b.length - a.length)
  return scored[0].title
}
```

### Keyboard Navigation in Category List
```typescript
// Source: react-hotkeys-hook docs (https://react-hotkeys-hook.vercel.app/)
'use client'

import { useHotkeys } from 'react-hotkeys-hook'
import { useState } from 'react'

export function useCategoryNavigation(categories: { id: number }[]) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  useHotkeys('up, k', () => {
    setSelectedIndex(prev => Math.max(0, prev - 1))
  }, { preventDefault: true })

  useHotkeys('down, j', () => {
    setSelectedIndex(prev => Math.min(categories.length - 1, prev + 1))
  }, { preventDefault: true })

  useHotkeys('enter', () => {
    // Expand/select current category
  }, { preventDefault: true })

  return { selectedIndex, selectedCategory: categories[selectedIndex] }
}
```

### Split Wizard Flow
```typescript
// Guided split: How many? -> Name each -> Assign playlists
interface SplitWizardState {
  step: 'count' | 'name' | 'assign'
  splitCount: number
  names: string[]
  assignments: Record<string, number[]> // categoryName -> playlistIds
}

// Server action to execute split
export async function splitProposal(
  proposalId: number,
  newCategories: { name: string; playlistIds: number[] }[]
) {
  // 1. Mark original proposal as rejected
  await updateProposalStatus(proposalId, 'rejected')

  // 2. Create new proposals for each split category
  for (const cat of newCategories) {
    const uniqueCount = await countUniqueVideosForPlaylists(cat.playlistIds)
    await db.insert(consolidationProposals).values({
      sessionId: /* current session */,
      categoryName: cat.name,
      sourcePlaylistIds: cat.playlistIds,
      uniqueVideoCount: uniqueCount,
      duplicateVideoCount: 0, // Recalculated
      confidenceScore: 100, // User-created
      confidenceReason: 'Manually created via split wizard',
      status: 'pending',
    })
  }

  revalidatePath('/analysis')
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| string-similarity 4.0.4 (unmaintained) | fast-dice-coefficient 1.0.0 OR cmpstr 3.2+ | string-similarity unmaintained since ~2021 | Must use alternative; fast-dice-coefficient provides same algo with better performance |
| Custom dendrogram cutting code | ml-hclust group(k) built-in method | Available in ml-hclust 4.0.0 | Eliminates custom tree traversal; produces exactly k clusters |
| react-beautiful-dnd (archived 2023) | Not needed for Phase 2 (deferred drag-drop decision) | 2023 | CONTEXT.md specifies add/remove buttons and guided wizard instead of drag-drop for Phase 2 |
| Manual HTML table | shadcn/ui DataTable + @tanstack/react-table | 2024-2025 | Built-in pagination, sorting, selection with shadcn styling |
| Fixed panel layout | react-resizable-panels 4.6.0 | v4 released 2025 | Server Component support, pixel/percentage units, keyboard accessibility |

**Deprecated/outdated:**
- **string-similarity:** Unmaintained for 5 years. Use fast-dice-coefficient or cmpstr.
- **react-beautiful-dnd:** Archived by Atlassian in 2023. Use @dnd-kit if drag-drop needed (but CONTEXT.md specifies buttons/wizard for Phase 2 adjustments, not drag-drop).
- **Custom cutDendrogram function:** ml-hclust has built-in `group(k)`. Do not write custom tree traversal.

## Open Questions

1. **How should video overlap be incorporated into clustering signal?**
   - What we know: Name similarity alone cannot detect that "Bardcore" and "Post punk" are both music. Video overlap (shared videos between playlists) is a strong signal.
   - What's unclear: Should video overlap be a separate distance metric combined with name similarity before clustering, or a post-clustering validation step?
   - Recommendation: Use a combined distance matrix: `distance = w1 * (1 - nameSimilarity) + w2 * (1 - videoOverlapPercent/100)` where w1=0.6, w2=0.4. This way playlists with many shared videos cluster together even if names differ. Start with these weights as the aggressive mode; conservative mode could use w1=0.8, w2=0.2.

2. **What is the actual data shape of 87 playlists?**
   - What we know: From exported CSV files, playlists include: CSS, css animations, CSS Animations & Transitions, css grid, css tidbit (5 CSS-related). Also JS, js libs (2 JS-related). Storybook, storybook (duplicate). Recipes - Low Carb, recipies (typo), Food (3 food-related). Multiple music: Bardcore, MUSIC, Music 4 Roisin, Music Vids, Post punk.
   - What's unclear: Exact video counts per playlist (stored in DB but varies). Whether all 87 playlists have synced videos yet (Phase 1 sync may not be complete).
   - Recommendation: Analysis must work with whatever data is synced. Show warning if some playlists have 0 synced videos. The actual data shows that name-based clustering will work well for many groups (CSS*, JS*, Storybook*, Drupal*) but music/food categories need video overlap signal.

3. **Should "Watch Later" playlist be excluded from clustering analysis?**
   - What we know: Watch Later (4,000 videos) is the target for Phase 5 ML categorization, not a source for Phase 2 consolidation.
   - What's unclear: CONTEXT.md doesn't explicitly state whether Watch Later should be in the analysis.
   - Recommendation: Exclude Watch Later from clustering. It would skew all categories (it likely shares videos with many playlists). Mark it as excluded in the UI with explanation.

4. **How to handle the "keep from most specific playlist" duplicate resolution default?**
   - What we know: CONTEXT.md specifies "keep from most specific playlist" with "longer, more descriptive playlist names preferred."
   - What's unclear: Algorithm for determining "specificity" -- is it just name length? Or something more nuanced?
   - Recommendation: Use name length as primary signal. Longer name = more specific. "Advanced JavaScript Patterns" (length 30) beats "JS" (length 2). Tiebreaker: playlist with fewer total videos (more focused = more specific). Store resolved_playlist_id in duplicate_records table.

## Sources

### Primary (HIGH confidence)
- **ml-hclust GitHub source code** (https://github.com/mljs/hclust) - Confirmed `group(k)` method on Cluster class, `indices()` for leaf extraction, `cut(threshold)` for height-based cutting. v4.0.0 published Nov 2025.
- **react-resizable-panels npm** (https://www.npmjs.com/package/react-resizable-panels) - v4.6.0, actively maintained (published Feb 2026), Server Component support confirmed.
- **shadcn/ui Resizable docs** (https://ui.shadcn.com/docs/components/radix/resizable) - Built on react-resizable-panels, supports horizontal/vertical orientation, keyboard navigation.
- **shadcn/ui Data Table docs** (https://ui.shadcn.com/docs/components/radix/data-table) - Requires @tanstack/react-table, supports pagination, sorting, row selection with checkboxes.
- **Drizzle ORM Select docs** (https://orm.drizzle.team/docs/select) - GROUP BY, HAVING, count, countDistinct, sql template literal for complex queries.
- **YouTube Data API** - 5,000 video per playlist limit confirmed by multiple sources (https://outofthe925.com/youtube-playlist-limit/).
- **react-hotkeys-hook** (https://react-hotkeys-hook.vercel.app/) - v5.2.1, scoped hotkeys, 'use client' compatible.

### Secondary (MEDIUM confidence)
- **fast-dice-coefficient npm** (https://www.npmjs.com/package/fast-dice-coefficient) - O(n) performance confirmed, 44k ops/sec benchmark. Package inactive maintenance but algorithm is stable/complete.
- **string-similarity npm** (https://www.npmjs.com/package/string-similarity) - v4.0.4, confirmed unmaintained. Validated as reason to use alternative.
- **@tanstack/react-table npm** (https://www.npmjs.com/package/@tanstack/react-table) - v8.21.3, React 19 compatible.
- **lucide-react npm** (https://www.npmjs.com/package/lucide-react) - v0.563.0, standard icon library for shadcn/ui.

### Tertiary (LOW confidence)
- **fast-dice-coefficient maintenance status:** Package is functionally complete but inactive maintenance (no updates in 12 months). The algorithm itself is mathematically stable and unlikely to need changes. If maintenance becomes a concern, cmpstr (actively maintained, 11 metrics) is a drop-in alternative.
- **Video overlap as clustering signal:** The combined distance matrix approach (w1*nameSim + w2*videoOverlap) is standard in information retrieval but the specific weights (0.6/0.4) are unverified for YouTube playlist data. May need tuning during implementation.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** - All libraries verified via npm/GitHub with current versions, maintenance status confirmed, APIs verified from source code
- Architecture: **HIGH** - Patterns follow existing Phase 1 conventions (Server Components, server actions, Drizzle ORM), new patterns (Resizable, DataTable) verified from official shadcn/ui docs
- Pitfalls: **HIGH** - Critical issues verified (unmaintained string-similarity, YouTube 5k limit, group(k) existence), all mitigation strategies use verified library features
- Algorithm design: **MEDIUM** - Dice coefficient + AGNES clustering is well-established, but video overlap weighting and category naming heuristics need validation on actual data
- UI complexity: **MEDIUM** - CONTEXT.md specifies extensive UI features. Individual components verified, but integration complexity (split wizard, bulk operations, keyboard nav across panels) will require careful implementation

**Research date:** 2026-02-06
**Valid until:** March 8, 2026 (30 days -- stable domain, verify npm package updates for react-resizable-panels v4.x and ml-hclust)
