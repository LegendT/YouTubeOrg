---
phase: 04-video-display-organization
plan: 02
subsystem: api
tags: [server-actions, drizzle, data-layer, navigation, ui]
completed: 2026-02-06
duration: 2.9 min

# Dependency graph
requires:
  - phase: 04-01
    provides: VideoCardData type, getThumbnailUrl utility, CategoryListItem type
  - phase: 03-06
    provides: Categories table, categoryVideos join table, getCategories action
provides:
  - getVideosForCategory server action with optimised batch query pattern
  - CategorySidebar component with category list and selection state
  - Videos page data layer foundation
affects:
  - 04-03 # Video page orchestrator will use getVideosForCategory and CategorySidebar
  - 04-04 # Video list component will consume VideoCardData from getVideosForCategory
  - 04-05 # Uncategorised videos may filter using getVideosForCategory

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Batch enrichment pattern: single join query + single batch query for all category names (not N+1)"
    - "Deduplication in 'All Videos' mode: Map<videoId, string[]> for category names"

# File tracking
key-files:
  created:
    - src/app/actions/videos.ts
    - src/components/videos/category-sidebar.tsx
  modified:
    - src/app/actions/categories.ts

# Decisions
decisions:
  - "Batch enrichment pattern: 2 DB queries max (1 join + 1 batch) instead of N+1 for category names"
  - "All Videos mode uses natural title sort, specific category uses dateAdded DESC"
  - "CategorySidebar uses button elements for accessibility (keyboard nav, screen readers)"
  - "Added revalidatePath('/videos') to assignVideosToCategory for cache invalidation"
---

# Phase 4 Plan 02: Server Actions & Category Sidebar Summary

**One-liner:** getVideosForCategory server action with batch enrichment (2 queries, not N+1) and CategorySidebar component with All Videos entry and category list

## What Was Built

### Server Action (src/app/actions/videos.ts)

**getVideosForCategory(categoryId: number | null): Promise<VideoCardData[]>**

Optimised video fetching with two query patterns:

**Specific Category Mode (categoryId = number):**
- Single join query: videos + categoryVideos + categories
- Filter by categoryId
- Order by categoryVideos.addedAt DESC (newest videos first)

**All Videos Mode (categoryId = null):**
- Single join query: videos + categoryVideos + categories (all categorised videos)
- Order by videos.title ASC (natural alphabetical browse order)
- Deduplicate videos (video may appear in multiple categories)

**Batch Enrichment Pattern (both modes):**
1. Primary query returns video rows with first category assignment
2. Collect unique video IDs
3. Single batch query: get ALL category names for all videos via inArray
4. Group by video ID into Map<videoId, string[]>
5. Enrich VideoCardData with complete categoryNames array

**Performance:** Maximum 2 database queries per call. No N+1 pattern.

### Category Sidebar Component (src/components/videos/category-sidebar.tsx)

**Props:**
- `categories: CategoryListItem[]` - All categories from getCategories
- `selectedCategoryId: number | null` - Current selection (null = "All Videos")
- `onSelectCategory: (categoryId: number | null) => void` - Selection callback
- `totalVideoCount: number` - Count for "All Videos" badge

**Layout:**
- 280px width, persistent left sidebar with border-right
- Header: "Categories" title
- ScrollArea for category list (handles overflow)
- Button elements for accessibility

**All Videos Entry:**
- Always at top
- Shows totalVideoCount badge
- Selected when categoryId = null

**Category Entries:**
- Sorted alphabetically (via getCategories: isProtected, then name)
- "Uncategorised" pinned to bottom (isProtected sort)
- Video count badge per category
- Truncate long names

**Visual States:**
- Selected: bg-accent text-accent-foreground
- Hover: bg-muted
- Count badges: text-muted-foreground, tabular-nums font

### Cache Revalidation Enhancement

Added `revalidatePath('/videos')` to `assignVideosToCategory` in categories.ts:
- Ensures videos page refreshes after video assignments
- Mirrors existing `/analysis` revalidation pattern
- Applied to both success cases (standard + 4500 warning threshold)

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

1. **Batch enrichment over N+1 queries**: Primary query uses join for first category assignment (required for filtering/sorting), then single batch query enriches with all category names. This avoids N+1 pattern from Phase 3 searchVideosForAssignment while maintaining complete category information per video.

2. **Deduplication in All Videos mode**: When categoryId is null, a video in 3 categories appears 3 times in the join result. Track seen video IDs in Set, filter to first occurrence. Preserves title sort order from database.

3. **Different sort orders by mode**:
   - Specific category: dateAdded DESC (see newest additions to category)
   - All Videos: title ASC (natural alphabetical browse when viewing all content)

4. **Button elements in sidebar**: Use semantic button tags instead of div with onClick. Improves accessibility (keyboard navigation, screen readers, focus management).

5. **revalidatePath for videos page**: assignVideosToCategory already revalidates /analysis. Adding /videos ensures video browsing page cache invalidates when category assignments change (user assigns videos, then navigates to /videos expecting to see changes).

## Architecture

### Query Optimisation

**Problem:** searchVideosForAssignment in categories.ts uses N+1 pattern (one query per video to fetch category names). Acceptable for paginated search results (limit 50), but unacceptable for video browsing which may load hundreds of videos.

**Solution:** Batch enrichment
```typescript
// Step 1: Primary join query (1 query)
const videoRows = await db
  .select(...)
  .from(categoryVideos)
  .innerJoin(videos, ...)
  .innerJoin(categories, ...)
  .where(eq(categoryVideos.categoryId, categoryId));

// Step 2: Batch query for all category names (1 query)
const categoryNameRows = await db
  .select({ videoId: categoryVideos.videoId, categoryName: categories.name })
  .from(categoryVideos)
  .innerJoin(categories, ...)
  .where(inArray(categoryVideos.videoId, videoIds));

// Step 3: Group into Map (in-memory)
const categoryNamesByVideoId = new Map<number, string[]>();
```

**Total:** 2 queries regardless of result size. Scales to hundreds/thousands of videos.

### Component Architecture

CategorySidebar is a pure presentation component:
- No data fetching (receives categories as prop)
- No state management beyond local selection
- Callback pattern for selection (parent controls routing/state)
- Reusable for any category-based navigation

Parent orchestrator (future 04-03) will:
- Fetch categories via getCategories
- Calculate totalVideoCount
- Manage selectedCategoryId state
- Handle category selection (update state, call getVideosForCategory)

## Testing & Verification

✅ **TypeScript compilation:** npx tsc --noEmit passes (no errors in new files)
✅ **Export verification:** getVideosForCategory exported from videos.ts, CategorySidebar exported from category-sidebar.tsx
✅ **Query count:** 2 database queries (verified via grep "await db" count)
✅ **Batch pattern:** inArray used for category name enrichment (not loop with individual queries)
✅ **Type safety:** VideoCardData returned with categoryNames array populated

## File Structure

```
src/
├── app/
│   └── actions/
│       ├── videos.ts              # NEW: getVideosForCategory server action
│       └── categories.ts          # MODIFIED: Added revalidatePath('/videos')
└── components/
    └── videos/
        └── category-sidebar.tsx   # NEW: Category navigation sidebar
```

## Task Commits

1. **Task 1: Create getVideosForCategory server action** - `27dcc33` (feat)
   - Server action with batch enrichment pattern
   - Support for specific category and All Videos modes
   - Added revalidatePath('/videos') to categories.ts

2. **Task 2: Create CategorySidebar component** - `b1e3c72` (feat)
   - Client component with category list and selection
   - All Videos entry at top
   - ScrollArea for overflow handling
   - Accessible button elements

## Next Phase Readiness

**Phase 4 data layer complete.** Server action provides optimised video fetching, sidebar component provides category navigation.

**Ready to proceed to 04-03**: Video display components (VideoCard, VideoGrid, VideoToolbar) will consume getVideosForCategory and integrate with CategorySidebar.

**No blockers identified.**

## Metrics

- **Tasks completed:** 2/2
- **Commits:** 2
  - 27dcc33: getVideosForCategory server action
  - b1e3c72: CategorySidebar component
- **Files created:** 2 (videos.ts action, category-sidebar.tsx component)
- **Files modified:** 1 (categories.ts revalidatePath)
- **Duration:** 2.9 minutes
- **Deviations:** 0

---
*Phase: 04-video-display-organization*
*Completed: 2026-02-06*
