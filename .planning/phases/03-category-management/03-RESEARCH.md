# Phase 3: Category Management - Research

**Researched:** 2026-02-06
**Domain:** CRUD category management extending existing Next.js 15 / Drizzle ORM analysis dashboard
**Confidence:** HIGH

## Summary

Phase 3 adds full CRUD control over the approved category structure from Phase 2. The codebase already has a rich analysis dashboard with a split-panel layout, category list with batch selection, category detail with video list, keyboard navigation, and 18+ server actions. Phase 3 extends this existing infrastructure rather than building from scratch.

The key technical challenges are: (1) the current data model uses `consolidationProposals` as the category table -- Phase 3 must decide whether to introduce a new `categories` table or continue using proposals-as-categories; (2) implementing an undo stack for destructive operations (delete, merge) within the session; (3) building a full-screen video assignment dialog with search and browse-by-source-category; (4) merge logic that combines multiple categories with automatic video deduplication.

**Primary recommendation:** Continue using the `consolidationProposals` table as the category table (renaming semantically via type aliases), add new server actions for rename/delete/merge/video-assignment CRUD operations, implement an in-memory undo stack via a `useUndoStack` hook, and build the video assignment dialog as a full-screen Radix Dialog with two-panel search/browse layout.

## Standard Stack

The established libraries/tools for this domain. Phase 3 adds NO new dependencies -- everything is built with the existing stack.

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.5.12 | App Router, Server Actions | Already used for all data mutations |
| React | 19.2.4 | UI rendering, hooks | `useTransition`, `useOptimistic` for async mutations |
| Drizzle ORM | 0.45.1 | Database access, transactions | `db.transaction()` for atomic merge/delete operations |
| @radix-ui/react-dialog | 1.1.15 | Modal dialogs | Rename dialog, merge confirmation, video assignment |
| @tanstack/react-table | 8.21.3 | Video list with pagination | Existing video table extended for selection |
| lucide-react | 0.563.0 | Icons | Pencil, Trash2, Merge, Copy, Move, Undo2 |
| zod | 4.3.6 | Input validation | Category name validation, merge input validation |
| react-hotkeys-hook | 5.2.4 | Keyboard shortcuts | Existing nav hook, extend for undo (Cmd+Z) |

### Supporting (Already Installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-checkbox | 1.3.3 | Checkbox inputs | Video selection in assignment dialog |
| @radix-ui/react-scroll-area | 1.2.10 | Scrollable containers | Video list, category browse |
| @radix-ui/react-tabs | 1.1.13 | Tab panels | Source category browsing tabs |
| react-resizable-panels | 4.6.1 | Split panel layout | Already used in dashboard |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-memory undo stack | `use-undo` npm package | Adds dependency for simple use case; custom hook is ~30 lines |
| Full-screen Dialog | Separate route/page | User decision locked: full-screen dialog, not a page |
| New `categories` table | Reuse `consolidationProposals` | New table is cleaner semantically but requires data migration; proposals table already has all needed fields |

**Installation:**
```bash
# No new packages needed -- Phase 3 uses the existing stack entirely
```

## Architecture Patterns

### Critical Data Model Decision: Proposals as Categories

The current schema uses `consolidationProposals` for categories. After Phase 2 finalization (`finalizedAt` timestamp on `analysisSessions`), approved proposals effectively ARE the categories.

**Recommendation: Introduce a new `categories` table and a `category_videos` join table.**

Reasons:
1. `consolidationProposals` has analysis-specific fields (confidenceScore, confidenceReason, sessionId) that are irrelevant post-finalization
2. Categories need a many-to-many relationship with videos (not playlists) for Phase 3's video assignment
3. The current model stores `sourcePlaylistIds` as JSONB -- good for analysis but wrong for category-level CRUD where individual video tracking matters
4. A `category_videos` join table enables move/copy semantics, orphan detection, and proper deduplication
5. Phase 3 needs "Uncategorized" as a pseudo-category -- easier with a real categories table

**New schema additions:**
```typescript
// New tables for Phase 3
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  sourceProposalId: integer('source_proposal_id').references(() => consolidationProposals.id),
  videoCount: integer('video_count').notNull().default(0), // denormalized for fast list rendering
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const categoryVideos = pgTable('category_videos', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id').references(() => categories.id, { onDelete: 'cascade' }).notNull(),
  videoId: integer('video_id').references(() => videos.id).notNull(),
  addedAt: timestamp('added_at').notNull().defaultNow(),
  source: text('source').default('consolidation'), // 'consolidation' | 'manual' | 'merge'
});
```

This requires a one-time migration that converts approved proposals into `categories` rows and populates `category_videos` from the proposal's source playlists' video data.

### Recommended Project Structure
```
src/
├── app/
│   ├── actions/
│   │   ├── analysis.ts           # Existing (Phase 2) -- keep unchanged
│   │   └── categories.ts         # NEW: Phase 3 CRUD server actions
│   └── analysis/
│       └── page.tsx              # Extended to load categories after finalization
├── components/
│   └── analysis/
│       ├── analysis-dashboard.tsx      # Extended: mode switch (analysis vs management)
│       ├── category-list.tsx           # Extended: hover action buttons, status indicators
│       ├── category-detail.tsx         # Extended: management actions layered on
│       ├── rename-category-dialog.tsx  # NEW: rename with name input
│       ├── delete-category-dialog.tsx  # NEW: confirmation with orphan info
│       ├── merge-categories-dialog.tsx # NEW: merge preview + name confirmation
│       ├── video-assignment-dialog.tsx # NEW: full-screen video search/browse/assign
│       ├── undo-banner.tsx             # NEW: floating undo notification
│       └── batch-operations.tsx        # Extended: merge button when multi-selected
├── lib/
│   └── categories/
│       └── undo-stack.ts         # NEW: useUndoStack hook
└── types/
    └── categories.ts             # NEW: Phase 3 type definitions
```

### Pattern 1: Server Actions for CRUD
**What:** All mutations go through server actions with consistent error handling
**When to use:** Every create, update, delete, merge operation
**Example:**
```typescript
// Source: existing pattern from src/app/actions/analysis.ts
'use server';

import { db } from '@/lib/db';
import { categories, categoryVideos, videos } from '@/lib/db/schema';
import { eq, inArray, sql, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function renameCategory(
  categoryId: number,
  newName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!newName.trim()) {
      return { success: false, error: 'Category name cannot be empty' };
    }

    await db
      .update(categories)
      .set({ name: newName.trim(), updatedAt: new Date() })
      .where(eq(categories.id, categoryId));

    revalidatePath('/analysis');
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}
```

### Pattern 2: Transactional Merge with Drizzle
**What:** Merge operation uses a database transaction to atomically combine categories
**When to use:** When merging 2+ categories into one
**Example:**
```typescript
// Source: Drizzle ORM transaction docs (https://orm.drizzle.team/docs/transactions)
export async function mergeCategories(
  sourceCategoryIds: number[],
  targetName: string
): Promise<{ success: boolean; mergedCategoryId?: number; error?: string }> {
  try {
    return await db.transaction(async (tx) => {
      // 1. Create the merged category
      const [merged] = await tx
        .insert(categories)
        .values({ name: targetName.trim() })
        .returning({ id: categories.id });

      // 2. Move all videos from source categories, deduplicating
      const sourceVideos = await tx
        .select({ videoId: categoryVideos.videoId })
        .from(categoryVideos)
        .where(inArray(categoryVideos.categoryId, sourceCategoryIds));

      const uniqueVideoIds = [...new Set(sourceVideos.map(v => v.videoId))];

      if (uniqueVideoIds.length > 0) {
        await tx.insert(categoryVideos).values(
          uniqueVideoIds.map(videoId => ({
            categoryId: merged.id,
            videoId,
            source: 'merge' as const,
          }))
        );
      }

      // 3. Delete source categories (cascade deletes their category_videos)
      await tx.delete(categories)
        .where(inArray(categories.id, sourceCategoryIds));

      // 4. Update video count
      await tx.update(categories)
        .set({ videoCount: uniqueVideoIds.length })
        .where(eq(categories.id, merged.id));

      revalidatePath('/analysis');
      return { success: true, mergedCategoryId: merged.id };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}
```

### Pattern 3: In-Memory Undo Stack
**What:** Client-side hook that stores undo entries for destructive operations
**When to use:** After delete or merge operations
**Example:**
```typescript
// Custom hook -- no external dependency needed
interface UndoEntry {
  id: string;
  type: 'delete' | 'merge';
  label: string; // "Deleted 'JavaScript'" or "Merged 3 categories into 'Web Dev'"
  undoAction: () => Promise<void>; // server action to reverse
  timestamp: number;
}

function useUndoStack(maxSize = 10, ttlMs = 30_000) {
  const [stack, setStack] = useState<UndoEntry[]>([]);

  const push = useCallback((entry: Omit<UndoEntry, 'id' | 'timestamp'>) => {
    const newEntry: UndoEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    setStack(prev => [newEntry, ...prev].slice(0, maxSize));
  }, [maxSize]);

  const undo = useCallback(async () => {
    const [latest, ...rest] = stack;
    if (!latest) return;
    await latest.undoAction();
    setStack(rest);
  }, [stack]);

  // Auto-expire old entries
  useEffect(() => {
    const interval = setInterval(() => {
      setStack(prev => prev.filter(e => Date.now() - e.timestamp < ttlMs));
    }, 5000);
    return () => clearInterval(interval);
  }, [ttlMs]);

  return { stack, push, undo, canUndo: stack.length > 0, latest: stack[0] ?? null };
}
```

### Pattern 4: Full-Screen Dialog for Video Assignment
**What:** Override shadcn Dialog's default `max-w-lg` to fill viewport
**When to use:** The video assignment dialog (user decision: "full-screen dialog")
**Example:**
```typescript
// Source: shadcn/ui GitHub issue #1401
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] max-h-[90vh] overflow-hidden flex flex-col">
    <DialogHeader>
      <DialogTitle>Assign Videos to {categoryName}</DialogTitle>
    </DialogHeader>

    {/* Two-panel layout: left = source/search, right = selection */}
    <div className="flex-1 flex gap-4 overflow-hidden">
      {/* Left panel: video search + browse */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Search bar + source category tabs */}
      </div>

      {/* Right panel: selected videos */}
      <div className="w-80 border-l pl-4 overflow-auto">
        {/* Selected video list with remove buttons */}
      </div>
    </div>

    <DialogFooter>
      {/* Move/Copy toggle + Assign button */}
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Anti-Patterns to Avoid
- **Direct DB mutations without transactions:** Never merge categories without wrapping in `db.transaction()` -- partial failures leave orphaned videos
- **Storing undo data in the database:** The undo stack is session-only per user decision; localStorage or DB persistence adds complexity for minimal value
- **Re-running analysis after management changes:** Phase 3 operates on finalized categories, not proposals; never trigger re-analysis from management actions
- **Building video assignment as a separate page:** User decision locks this to a dialog/modal, not a route

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Video search in assignment dialog | Custom search implementation | Extend `@tanstack/react-table` with `getFilteredRowModel` | Already used in `video-list-paginated.tsx`; handles pagination, filtering, column sorting |
| Confirmation dialogs | Custom modal logic | `@radix-ui/react-dialog` with `DialogContent` | Already wrapped in shadcn `Dialog` component; focus trapping, escape key, overlay click handled |
| Checkbox multi-select state | Custom Set management | Existing `useBatchSelection` hook | Already built in `batch-operations.tsx`; toggle, selectAll, clearAll, isSelected |
| Keyboard shortcuts | Custom keydown listeners | Existing `react-hotkeys-hook` via `useCategoryKeyboardNav` | Already integrated; extend for Cmd+Z undo |
| Category name validation | Regex + manual checks | `zod` schema validation | Already used in `validation.ts`; composable, type-safe |
| Video deduplication during merge | Manual Set intersection | SQL `DISTINCT` or `ON CONFLICT DO NOTHING` | Database handles dedup atomically, no race conditions |

**Key insight:** Phase 2 already built extensive infrastructure (batch selection, keyboard nav, dialog patterns, server action patterns, video tables). Phase 3's main job is extending these patterns for new CRUD operations, not inventing new patterns.

## Common Pitfalls

### Pitfall 1: Orphaned Videos After Category Delete
**What goes wrong:** Deleting a category removes the category but leaves videos pointing to nothing. User expects orphaned videos to go to "Uncategorized."
**Why it happens:** Cascade delete on `category_videos` removes the association, but nobody checks if the video still belongs to another category.
**How to avoid:** After deleting `category_videos` rows for the deleted category, query for any video IDs that no longer appear in ANY `category_videos` row, then insert them into the "Uncategorized" category.
**Warning signs:** Video counts across all categories don't sum to total videos.

```typescript
// After deleting category's video associations:
const orphanedVideoIds = await tx.execute(sql`
  SELECT v.id FROM videos v
  LEFT JOIN category_videos cv ON cv.video_id = v.id
  WHERE cv.id IS NULL
  AND v.id IN (${deletedVideoIds.join(',')})
`);
// Insert orphans into Uncategorized
```

### Pitfall 2: PostgreSQL Bigint String Coercion
**What goes wrong:** `count()` aggregates return strings in Drizzle/pg, causing `"5" + 1 = "51"` bugs.
**Why it happens:** PostgreSQL returns `bigint` for `count()`, and the `pg` driver serializes bigints as strings.
**How to avoid:** Always wrap aggregate results with `Number()`: `Number(row.videoCount)`.
**Warning signs:** Video counts display as concatenated strings like "15020" instead of 170.

### Pitfall 3: Race Condition in Concurrent Merge/Delete
**What goes wrong:** Two users (or two browser tabs) simultaneously merge overlapping categories, creating duplicate video assignments.
**Why it happens:** Non-transactional reads followed by writes allow interleaving.
**How to avoid:** Use `db.transaction()` for ALL merge and delete operations. Consider `SELECT ... FOR UPDATE` if needed.
**Warning signs:** Video count after merge exceeds expected unique count.

### Pitfall 4: Undo Stack Holding Stale Closures
**What goes wrong:** Undo action references stale state from when it was created, causing incorrect restoration.
**Why it happens:** JavaScript closures capture state at creation time, not execution time.
**How to avoid:** Store undo data as serializable snapshots (category IDs, video IDs, names), not closures over component state. The undo server action should read current state from DB and restore from the snapshot.
**Warning signs:** Undoing a delete restores wrong data or crashes.

### Pitfall 5: "Uncategorized" Category Race
**What goes wrong:** Multiple delete operations each try to create the "Uncategorized" category, causing duplicates.
**Why it happens:** Check-then-insert without locking.
**How to avoid:** Use `INSERT ... ON CONFLICT DO NOTHING` or ensure "Uncategorized" is created during the Phase 3 migration, not lazily.
**Warning signs:** Multiple "Uncategorized" categories appear in the list.

### Pitfall 6: Full-Screen Dialog z-index Conflicts
**What goes wrong:** The video assignment dialog's full-screen overlay conflicts with the undo banner or other toasts.
**Why it happens:** Both use `z-50` from Radix defaults.
**How to avoid:** Undo banner should use a lower z-index (e.g., `z-40`) and be placed outside the dialog portal. Or use Radix's stacking context properly.
**Warning signs:** Undo banner appears behind the dialog overlay.

## Code Examples

Verified patterns from official sources and the existing codebase:

### Delete Category with Orphan Handling
```typescript
// Pattern: Transactional delete with orphan reassignment
export async function deleteCategory(
  categoryId: number
): Promise<{ success: boolean; undoData?: DeleteUndoData; error?: string }> {
  try {
    return await db.transaction(async (tx) => {
      // 1. Get category info for undo
      const [cat] = await tx
        .select()
        .from(categories)
        .where(eq(categories.id, categoryId));

      if (!cat) return { success: false, error: 'Category not found' };

      // 2. Get all video IDs in this category (for undo + orphan check)
      const catVideos = await tx
        .select({ videoId: categoryVideos.videoId })
        .from(categoryVideos)
        .where(eq(categoryVideos.categoryId, categoryId));

      const videoIds = catVideos.map(v => v.videoId);

      // 3. Delete the category (cascade deletes category_videos)
      await tx.delete(categories).where(eq(categories.id, categoryId));

      // 4. Find truly orphaned videos (not in any other category)
      if (videoIds.length > 0) {
        const stillAssigned = await tx
          .select({ videoId: categoryVideos.videoId })
          .from(categoryVideos)
          .where(inArray(categoryVideos.videoId, videoIds));

        const stillAssignedSet = new Set(stillAssigned.map(v => v.videoId));
        const orphanedIds = videoIds.filter(id => !stillAssignedSet.has(id));

        // 5. Move orphans to Uncategorized
        if (orphanedIds.length > 0) {
          const [uncategorized] = await tx
            .select({ id: categories.id })
            .from(categories)
            .where(eq(categories.name, 'Uncategorized'));

          if (uncategorized) {
            await tx.insert(categoryVideos).values(
              orphanedIds.map(videoId => ({
                categoryId: uncategorized.id,
                videoId,
                source: 'orphan' as const,
              }))
            );
          }
        }
      }

      revalidatePath('/analysis');

      // Return undo data so client can push to undo stack
      return {
        success: true,
        undoData: {
          categoryName: cat.name,
          videoIds,
        },
      };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}
```

### Undo Delete (Server Action)
```typescript
// Restore a deleted category from undo snapshot
export async function undoDeleteCategory(
  undoData: DeleteUndoData
): Promise<{ success: boolean; error?: string }> {
  try {
    return await db.transaction(async (tx) => {
      // 1. Re-create the category
      const [restored] = await tx
        .insert(categories)
        .values({ name: undoData.categoryName })
        .returning({ id: categories.id });

      // 2. Re-assign videos (remove from Uncategorized if needed)
      if (undoData.videoIds.length > 0) {
        // Remove from Uncategorized
        const [uncategorized] = await tx
          .select({ id: categories.id })
          .from(categories)
          .where(eq(categories.name, 'Uncategorized'));

        if (uncategorized) {
          await tx.delete(categoryVideos).where(
            and(
              eq(categoryVideos.categoryId, uncategorized.id),
              inArray(categoryVideos.videoId, undoData.videoIds)
            )
          );
        }

        // Re-assign to restored category
        await tx.insert(categoryVideos).values(
          undoData.videoIds.map(videoId => ({
            categoryId: restored.id,
            videoId,
            source: 'undo' as const,
          }))
        );
      }

      revalidatePath('/analysis');
      return { success: true };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}
```

### Video Search Server Action
```typescript
// Search videos by title or channel, with optional category filter
export async function searchVideos(
  query: string,
  sourceCategoryId?: number,
  limit = 50,
  offset = 0
): Promise<{ videos: VideoDetail[]; total: number }> {
  const conditions = [];

  if (query.trim()) {
    conditions.push(
      sql`(${videos.title} ILIKE ${'%' + query.trim() + '%'}
           OR ${videos.channelTitle} ILIKE ${'%' + query.trim() + '%'})`
    );
  }

  // ... build query with optional category join
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useReducer` + manual history | `useOptimistic` + server actions | React 19 / Next.js 15 | Optimistic UI updates are built into React 19; use for instant rename feedback |
| Custom modal z-index management | Radix Dialog stacking context | Radix 1.x | Nested dialogs (confirmation inside assignment) handled automatically |
| Manual form validation | Zod 4.x schemas | Zod 4 (current) | Server-side validation with type inference |
| `serial` primary keys | `identity` columns | PostgreSQL 10+ / Drizzle recommendation | Serial still works fine; no migration needed for existing tables |

**Deprecated/outdated:**
- None specific to this phase -- the existing stack is current

## Discretionary Decisions

Areas marked as Claude's discretion in CONTEXT.md, with recommendations:

### 1. YouTube 5,000 Video Limit Enforcement
**Recommendation: Soft warning at 4,500 + hard block at 5,000.**
- Phase 2 already validates at 4,500 (safety margin). Keep that as the warning threshold.
- Add a hard block at 5,000 (YouTube's actual limit) for Phase 3 video assignment.
- Show yellow warning badge at 4,500, red error badge at 5,000.
- The `createCustomCategory` server action already blocks at 4,500; align Phase 3 assignment to match.

### 2. Undo Stack Implementation
**Recommendation: In-memory only, NOT persisted.**
- The undo stack is session-scoped (user decision: "within session").
- Store undo entries as React state via a custom `useUndoStack` hook.
- Each entry stores serializable snapshot data (category name, video IDs), not closures.
- The undo server action reconstructs state from the snapshot.
- TTL of 30 seconds per entry, max 10 entries. Entries auto-expire and fall off.
- Keyboard shortcut: Cmd/Ctrl+Z triggers undo (extend existing `react-hotkeys-hook` usage).

### 3. Loading States and Error Handling
**Recommendation: Follow existing patterns from Phase 2.**
- Use `useTransition` for server action calls (same as `ProposalActions`, `BatchToolbar`).
- `Loader2` spinner icon during pending state (already used throughout).
- Error displayed inline beneath the action trigger (same as `CreateCategoryDialog`).
- Success feedback via `Badge` component auto-dismissed after 4 seconds (same as `BatchToolbar`).

### 4. Video Assignment Dialog Layout
**Recommendation: Two-column layout with search/browse on left, selection summary on right.**
- Left panel (70%): Search bar at top, tabs below for "Search Results" and "Browse by Category"
- Right panel (30%): Running list of selected videos with remove buttons, count, and move/copy toggle
- Bottom: Action bar with "Assign X videos" button, disabled until videos selected + move/copy chosen
- Use existing `@tanstack/react-table` for video rows with checkboxes (extends `VideoListPaginated` pattern)

## Open Questions

Things that couldn't be fully resolved:

1. **Migration strategy for proposals-to-categories conversion**
   - What we know: Approved proposals need to become categories with video associations
   - What's unclear: Should this be a Drizzle migration script or a one-time server action? The project has only one migration file and Phase 2 tables seem to have been pushed directly.
   - Recommendation: Create a Drizzle migration for the new tables, then a seed script (run via `tsx`) that converts finalized proposals to categories. This matches the existing pattern of using `tsx` scripts for data operations.

2. **Denormalized video count accuracy**
   - What we know: A `videoCount` column on `categories` avoids counting joins on every list render
   - What's unclear: How to keep it in sync during concurrent video assignment/removal
   - Recommendation: Update `videoCount` inside every transaction that modifies `category_videos`. Add a periodic reconciliation check, but trust the transactional updates for normal operation.

3. **"Uncategorized" category semantics**
   - What we know: Orphaned videos go to "Uncategorized" when their only category is deleted
   - What's unclear: Should "Uncategorized" be deletable? Should it appear differently in the UI?
   - Recommendation: Create "Uncategorized" during migration. It cannot be deleted or renamed (enforce in server actions). Show it at the bottom of the category list with a subtle visual indicator.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/app/actions/analysis.ts` -- 18 existing server actions establishing patterns
- Codebase analysis: `src/lib/db/schema.ts` -- current DB schema with 7 tables
- Codebase analysis: `src/components/analysis/` -- 17 existing components to extend
- [Drizzle ORM Transactions](https://orm.drizzle.team/docs/transactions) -- `db.transaction()`, `tx.rollback()`, nested transactions
- [Radix Dialog](https://www.radix-ui.com/primitives/docs/components/dialog) -- @radix-ui/react-dialog 1.1.15

### Secondary (MEDIUM confidence)
- [shadcn/ui full-screen dialog pattern](https://github.com/shadcn-ui/ui/issues/1401) -- `max-w-[95vw] h-[90vh]` override
- [React useOptimistic](https://react.dev/reference/react/useOptimistic) -- built-in optimistic update hook
- [use-undo pattern](https://github.com/homerchen19/use-undo) -- past/present/future state structure

### Tertiary (LOW confidence)
- [React undo/redo with useReducer](https://gist.github.com/johanquiroga/cbbfc0da2e9f11d2dbfd15acc4db6fc0) -- community pattern, unverified for React 19

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all libraries already installed and version-verified
- Architecture: HIGH -- patterns directly derived from existing Phase 2 codebase
- Data model: HIGH -- schema decision informed by actual table structure analysis
- Pitfalls: HIGH -- identified from MEMORY.md learnings (bigint strings, JSONB quirks) and codebase patterns
- Undo stack: MEDIUM -- custom implementation; pattern well-established but React 19 specifics less documented

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (stable stack, no fast-moving dependencies)
