# Phase 4: Video Display & Organisation - Research

**Researched:** 2026-02-06
**Domain:** Virtualised video grid UI, search/filter, video organisation (move/copy between categories)
**Confidence:** HIGH

## Summary

Phase 4 builds the primary video browsing interface: a YouTube-style card grid with persistent category sidebar, search, sort, and video organisation (move/copy between categories). The core technical challenge is rendering 4,000+ video cards performantly with virtualisation while supporting responsive grid layouts, debounced search, and batch selection.

The codebase already has strong foundations: the `categories`/`categoryVideos` schema, `assignVideosToCategory` server action with move/copy modes, the `useUndoStack` hook with `UndoBanner` component, and `VideoSearchResult` type. Phase 4 extends these with a new `/videos` route using `@tanstack/react-virtual` for virtualised grid rendering, constructing higher-quality thumbnails from `youtubeId` (since only `default` 120x90 thumbnails are stored), and deterministic category colour generation for pill badges.

**Primary recommendation:** Use `@tanstack/react-virtual` with a single row virtualiser + CSS grid for columns (responsive 3-4 cards per row). This is simpler and more maintainable than dual-axis grid virtualisation, while delivering the same performance for 4,000+ items.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-virtual` | ^3.x | Row virtualisation for 4,000+ video cards | Headless, composable, active maintenance, better DX than react-window. Already using `@tanstack/react-table` in project |
| Next.js 15 (App Router) | ^15.5 | Routing, Server Components, Server Actions | Already in project |
| Drizzle ORM | ^0.45 | Database queries with category/video joins | Already in project |
| shadcn/ui | latest | UI primitives (dialog, checkbox, badge, dropdown-menu) | Already in project |
| react-hotkeys-hook | ^5.2 | Keyboard shortcuts (Cmd/Ctrl+Z for undo) | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@radix-ui/react-dropdown-menu` | latest | "Move to..." / "Copy to..." category picker | New shadcn component needed for batch operations toolbar |
| `lucide-react` | ^0.563 | Icons throughout UI | Already in project |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@tanstack/react-virtual` | `react-window` (FixedSizeGrid) | react-window is mentioned in requirements (UI-05) but is less flexible for responsive card grids; @tanstack/react-virtual is its spiritual successor by the same author, headless and composable |
| Custom row virtualiser | Dual-axis grid virtualiser (row + column) | Dual-axis is more complex to implement and maintain; single row virtualiser with CSS grid columns achieves the same visual result with simpler code |
| Server-side search | Client-side array filtering | With 4,000 videos loaded on the client via virtualisation, client-side filtering with `useMemo` is faster than round-tripping to the server for search |

**Installation:**
```bash
npm install @tanstack/react-virtual
npx shadcn@latest add dropdown-menu
```

## Architecture Patterns

### Recommended Page Structure
```
src/
├── app/
│   └── videos/
│       └── page.tsx                    # Server Component: fetch categories + initial video data
├── components/
│   └── videos/
│       ├── video-browse-page.tsx       # Client Component: orchestrates layout, state, undo
│       ├── category-sidebar.tsx        # Persistent left sidebar with category list + counts
│       ├── video-grid.tsx              # Virtualised grid with @tanstack/react-virtual
│       ├── video-card.tsx              # Individual card: thumbnail, title, channel, duration, badge
│       ├── video-toolbar.tsx           # Search bar, sort dropdown, select-all, move/copy buttons
│       ├── move-copy-dialog.tsx        # Confirmation dialog for bulk moves (5+ videos)
│       └── video-undo-banner.tsx       # Reuses existing UndoBanner pattern
├── app/
│   └── actions/
│       └── videos.ts                   # Server actions for video browsing queries
├── lib/
│   └── videos/
│       ├── category-colours.ts         # Deterministic colour generation from category name
│       └── thumbnail-url.ts            # Construct mqdefault thumbnail URL from youtubeId
└── types/
    └── videos.ts                       # VideoCardData, SortOption, etc.
```

### Pattern 1: Single Row Virtualiser with CSS Grid Columns
**What:** Virtualise rows only; each row renders 3-4 cards using CSS grid. The column count is responsive via `useResizeObserver` or a simple `useEffect` + `matchMedia`.
**When to use:** Card grids where all cards have the same height (fixed row height).
**Why:** Dramatically simpler than dual-axis virtualisation. The column virtualiser adds complexity without benefit when there are only 3-4 columns (all visible).

```typescript
// Source: TanStack Virtual docs + community patterns
import { useVirtualizer } from '@tanstack/react-virtual'

function VideoGrid({ videos, columnCount }: { videos: VideoCardData[]; columnCount: number }) {
  const parentRef = useRef<HTMLDivElement>(null)

  // Calculate row count from flat video array
  const rowCount = Math.ceil(videos.length / columnCount)

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT, // Fixed card height (e.g., 320px)
    overscan: 3, // Render 3 extra rows above/below viewport
  })

  return (
    <div ref={parentRef} style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
              display: 'grid',
              gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
              gap: '16px',
              padding: '0 16px',
            }}
          >
            {Array.from({ length: columnCount }, (_, colIndex) => {
              const videoIndex = virtualRow.index * columnCount + colIndex
              const video = videos[videoIndex]
              if (!video) return <div key={colIndex} /> // Empty cell for last row
              return <VideoCard key={video.id} video={video} />
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
```

### Pattern 2: Responsive Column Count
**What:** Compute column count from container width using a resize observer.
**When to use:** When the grid container can change width (e.g., sidebar collapse, window resize).

```typescript
function useColumnCount(containerRef: RefObject<HTMLDivElement | null>, minCardWidth = 300) {
  const [columnCount, setColumnCount] = useState(4)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0
      const cols = Math.max(1, Math.min(4, Math.floor(width / minCardWidth)))
      setColumnCount(cols)
    })

    observer.observe(el)
    return () => observer.disconnect()
  }, [containerRef, minCardWidth])

  return columnCount
}
```

### Pattern 3: Client-Side Search with Debounce
**What:** Filter videos in-memory with debounced input, using `useMemo` for filtered results.
**When to use:** When the full dataset is already loaded client-side (which it is with virtualisation).

```typescript
function useVideoSearch(videos: VideoCardData[], debounceMs = 300) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), debounceMs)
    return () => clearTimeout(timer)
  }, [query, debounceMs])

  const results = useMemo(() => {
    if (!debouncedQuery.trim()) return videos
    const q = debouncedQuery.toLowerCase()
    return videos.filter(
      (v) =>
        v.title.toLowerCase().includes(q) ||
        (v.channelTitle?.toLowerCase().includes(q) ?? false) ||
        (v.description?.toLowerCase().includes(q) ?? false)
    )
  }, [videos, debouncedQuery])

  return { query, setQuery, results, resultCount: results.length }
}
```

### Pattern 4: Deterministic Category Colour
**What:** Generate a consistent HSL colour from a category name string hash, ensuring good contrast and visual distinction.
**When to use:** Category pill badges on each video card.

```typescript
function getCategoryColour(name: string): { bg: string; text: string } {
  // Simple string hash
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
    hash = hash & hash // Convert to 32-bit integer
  }

  // Map hash to hue (0-360), keep saturation/lightness in pleasing range
  const hue = ((hash % 360) + 360) % 360
  return {
    bg: `hsl(${hue}, 65%, 92%)`,   // Light pastel background
    text: `hsl(${hue}, 65%, 30%)`,  // Dark readable text
  }
}
```

### Pattern 5: Thumbnail URL Construction
**What:** Construct higher-quality thumbnail URLs from `youtubeId` rather than using the stored 120x90 `default` URL.
**When to use:** Video cards need 320x180 thumbnails for the YouTube-style grid.

```typescript
// YouTube thumbnail URL pattern:
// https://img.youtube.com/vi/{VIDEO_ID}/{SIZE}.jpg
// Sizes: default (120x90), mqdefault (320x180), hqdefault (480x360),
//        sddefault (640x480), maxresdefault (1280x720)

function getThumbnailUrl(youtubeId: string, size: 'default' | 'mqdefault' | 'hqdefault' = 'mqdefault'): string {
  return `https://img.youtube.com/vi/${youtubeId}/${size}.jpg`
}
```

### Anti-Patterns to Avoid
- **Fetching all 4,000 videos from server on every category switch:** Load all videos for the selected category via a single server action call, then filter/search/sort client-side. Don't re-fetch on search/sort.
- **Dual-axis virtualisation for a 3-4 column grid:** Overengineered. All columns are always visible. Only virtualise rows.
- **Storing category colours in the database:** Deterministic generation from the name string is simpler and requires no schema changes.
- **Using react-window FixedSizeGrid:** Requires fixed dimensions and is less flexible for responsive layouts. @tanstack/react-virtual is headless and composable.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Virtualised list rendering | Custom DOM recycling / intersection observer windowing | `@tanstack/react-virtual` useVirtualizer | Scroll position management, overscan, resize handling, keyboard navigation are deceptively complex |
| Debounced search input | Custom setTimeout management | `useEffect` + `setTimeout` pattern (see Code Examples) | Simple enough as a hook; no library needed, but don't forget cleanup |
| Category colour generation | Manual colour assignment / DB column | Deterministic hash function (see Code Examples) | Automatic, consistent, zero-maintenance, no schema changes |
| Thumbnail sizing | Storing multiple thumbnail URLs | URL construction from `youtubeId` | YouTube's CDN serves any size from the same video ID |
| Undo for move/copy operations | New undo system | Extend existing `useUndoStack` hook + `UndoBanner` | Already proven in Phase 3; same pattern with new undo data types |
| Keyboard shortcut for undo | Manual keydown listeners | `react-hotkeys-hook` (already in project) | Already handles Cmd/Ctrl+Z; just wire up the undo callback |

**Key insight:** The existing codebase has most of the infrastructure. Phase 4 is primarily a new UI surface wiring existing server actions and patterns into a new page layout with virtualisation.

## Common Pitfalls

### Pitfall 1: Virtualiser Scroll Container Must Have Fixed Height
**What goes wrong:** The virtualised grid renders all items at once or shows nothing.
**Why it happens:** `@tanstack/react-virtual` requires a scroll container with a known, fixed height. If the container's height is `auto` or determined by content, the virtualiser cannot calculate which items are visible.
**How to avoid:** Always set the scroll container to a CSS height like `h-[calc(100vh-XXXpx)]` or `flex-1` within a flex column with a fixed parent height.
**Warning signs:** All 4,000+ cards render simultaneously; browser freezes; scrollbar is tiny.

### Pitfall 2: Stale Data After Move/Copy Operations
**What goes wrong:** After moving a video from Category A to Category B, the video still appears in Category A's grid.
**Why it happens:** Client-side state is not updated after server action completes; the previous data is cached.
**How to avoid:** After a successful move/copy server action, either (a) optimistically update client-side state by removing the video from the local array, or (b) refetch the category's video list. Option (a) is better UX. Also update the sidebar's video counts immediately.
**Warning signs:** Videos appear in both categories after a move; counts are stale.

### Pitfall 3: ISO 8601 Duration Parsing for Sort
**What goes wrong:** Sorting by duration treats "PT1H2M" as less than "PT15M" because of string comparison.
**Why it happens:** Duration is stored as ISO 8601 string (e.g., "PT15M33S"). String comparison is lexicographic, not numeric.
**How to avoid:** Parse duration to total seconds before sorting. The codebase already has `formatDuration` in `video-list-paginated.tsx` and `video-assignment-dialog.tsx` -- extract and extend it to return seconds for sorting.
**Warning signs:** Videos sorted by duration appear in wrong order; long videos sort before short ones.

### Pitfall 4: Search Scope Toggle (Current Category vs All) Not Resetting Virtualiser
**What goes wrong:** Toggling "search all categories" shows stale results or wrong scroll position.
**Why it happens:** The virtualiser caches row measurements. When the underlying data array changes dramatically (from 50 filtered results to 4,000 all-category results), the virtualiser must be told to recalculate.
**How to avoid:** Call `virtualizer.scrollToIndex(0)` when toggling search scope or when search results change significantly. Also ensure the row count is recomputed from the new data array length.
**Warning signs:** Blank space in the grid after toggling; scroll position jumps; items don't render.

### Pitfall 5: PostgreSQL Bigint Returns Strings
**What goes wrong:** Video counts display as strings or arithmetic fails.
**Why it happens:** PostgreSQL aggregates like `count()` return strings via Drizzle ORM.
**How to avoid:** Always wrap with `Number()` -- this is already documented in MEMORY.md and done in existing code, but new server actions must follow the same pattern.
**Warning signs:** "100" + 50 = "10050" instead of 150; counts display with quotes.

### Pitfall 6: Loading All Videos for "All Videos" View
**What goes wrong:** The "All Videos" view tries to load all 4,000+ videos with their category names at once, causing a slow initial load.
**Why it happens:** Each video needs its category names for the badge. Naive N+1 query pattern (one query per video to get categories).
**How to avoid:** Use a single join query to get all videos with their categories in one go. Structure as: `videos LEFT JOIN categoryVideos LEFT JOIN categories`, grouped by video ID. For the "All Videos" view, consider paginated server-side loading or loading only video metadata initially and category badges as a secondary enrichment.
**Warning signs:** 10+ second load times for "All Videos"; database connection pool exhaustion.

## Code Examples

Verified patterns from official sources and existing codebase:

### Video Card Data Type
```typescript
// Extends existing VideoSearchResult with additional fields for the card
export interface VideoCardData {
  id: number
  youtubeId: string
  title: string
  channelTitle: string | null
  duration: string | null           // ISO 8601 (e.g., "PT15M33S")
  publishedAt: Date | null
  description: string | null
  categoryId: number                // Which category this video belongs to (for current view)
  categoryName: string              // Category name for the pill badge
  categoryNames: string[]           // All categories this video is in (for "All Videos" view)
  addedAt: Date                     // When added to this category (from categoryVideos.addedAt)
}
```

### Server Action: Get Videos For Category
```typescript
// New server action for Phase 4 video browsing
export async function getVideosForCategory(
  categoryId: number | null // null = "All Videos"
): Promise<VideoCardData[]> {
  // Single query with JOIN to get videos + their category memberships
  // Return flat array for client-side virtualisation
  // Use Drizzle's join API, not N+1 queries
}
```

### Duration Parsing for Sort (Extract from existing code)
```typescript
// Already exists in video-list-paginated.tsx and video-assignment-dialog.tsx
// Extract to shared utility for reuse
function parseDurationToSeconds(isoDuration: string | null): number {
  if (!isoDuration) return 0
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  const hours = parseInt(match[1] || '0', 10)
  const minutes = parseInt(match[2] || '0', 10)
  const seconds = parseInt(match[3] || '0', 10)
  return hours * 3600 + minutes * 60 + seconds
}
```

### Sort Options (Claude's Discretion Decision)
Based on available database fields, recommended sort options:

| Sort Option | Field | Direction Default | Notes |
|-------------|-------|-------------------|-------|
| Date Added | `categoryVideos.addedAt` | Newest first | When the video was added to the current category |
| Published Date | `videos.publishedAt` | Newest first | When the video was published on YouTube |
| Title | `videos.title` | A-Z | Alphabetical sort |
| Channel | `videos.channelTitle` | A-Z | Group videos by creator |
| Duration | `videos.duration` | Longest first | Requires ISO 8601 parsing to seconds |

**Note:** `viewCount` is NOT stored in the database schema. The card design says "view count (if available)" -- it is not available, so omit from cards and sort options. This could be added in a future YouTube API re-sync phase.

### Move/Copy Undo Data Type
```typescript
// New undo data type for Phase 4 move/copy operations
export interface MoveUndoData {
  type: 'move'
  videoIds: number[]
  sourceCategoryId: number
  targetCategoryId: number
  sourceCategoryName: string
  targetCategoryName: string
}

export interface CopyUndoData {
  type: 'copy'
  videoIds: number[]
  targetCategoryId: number
  targetCategoryName: string
}
```

### Batch Move with Undo Support
```typescript
// Extend existing assignVideosToCategory for undo support
// The server action already handles move/copy with source category tracking
// Phase 4 wraps it with the undo stack:

async function handleBatchMove(
  videoIds: number[],
  targetCategoryId: number,
  sourceCategoryId: number,
  targetCategoryName: string,
  sourceCategoryName: string
) {
  const result = await assignVideosToCategory(targetCategoryId, videoIds, 'move', sourceCategoryId)
  if (result.success) {
    undoStack.push({
      type: 'move' as const,
      label: `Moved ${videoIds.length} video${videoIds.length > 1 ? 's' : ''} to "${targetCategoryName}"`,
      undoAction: async () => {
        // Move back: from target to source
        return await assignVideosToCategory(sourceCategoryId, videoIds, 'move', targetCategoryId)
      },
    })
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-window (FixedSizeList/Grid) | @tanstack/react-virtual (useVirtualizer) | 2022-2023 | Headless, composable, better TypeScript, same author (Tanner Linsley) |
| IntersectionObserver for lazy images | Native `loading="lazy"` + virtualisation | ~2020+ | Browser-native lazy loading eliminates need for custom observer when combined with virtualisation |
| Server-side search/filter | Client-side with full dataset | N/A (context-dependent) | With virtualisation loading all data client-side, client-side filtering is instantaneous vs. server round-trip |

**Deprecated/outdated:**
- `react-virtualized`: Predecessor to react-window, much larger bundle, use @tanstack/react-virtual instead
- `react-window`: Still works but react-window v2 was rewritten to be closer to @tanstack/react-virtual; the original is in maintenance mode

## Existing Codebase Assets to Reuse

These existing components and patterns should be extended, not rebuilt:

| Asset | Location | How to Reuse |
|-------|----------|-------------|
| `useUndoStack` hook | `src/lib/categories/undo-stack.ts` | Add 'move' and 'copy' undo types alongside existing 'delete' and 'merge' |
| `UndoBanner` component | `src/components/analysis/undo-banner.tsx` | Import directly or copy to videos/ -- supports Cmd/Ctrl+Z, countdown, floating banner |
| `assignVideosToCategory` | `src/app/actions/categories.ts` | Already handles move/copy with deduplication, 5,000 limit, source category removal |
| `getCategories` | `src/app/actions/categories.ts` | Returns CategoryListItem[] with video counts -- use for sidebar |
| `VideoSearchResult` type | `src/types/categories.ts` | Extend for card data; has id, youtubeId, title, thumbnailUrl, channelTitle, duration, categoryNames |
| `Badge` component | `src/components/ui/badge.tsx` | Use for category pill badges with custom colours via className/style |
| `Checkbox` component | `src/components/ui/checkbox.tsx` | Use for video selection checkboxes on cards |
| `Dialog` component | `src/components/ui/dialog.tsx` | Use for bulk move confirmation dialog |
| `ScrollArea` component | `src/components/ui/scroll-area.tsx` | Use for category sidebar scrolling |
| `formatDuration` function | `src/components/analysis/video-list-paginated.tsx` (line 30-42) | Extract to shared utility; also exists in video-assignment-dialog.tsx |
| `formatRelativeDate` function | `src/components/analysis/video-list-paginated.tsx` (line 44-60) | Extract to shared utility for card publish dates |

## Open Questions

Things that couldn't be fully resolved:

1. **Data loading strategy for "All Videos" view**
   - What we know: Loading all 4,000+ videos with category names requires a well-optimised query. The existing `searchVideosForAssignment` action has an N+1 pattern (enriching each video with category names individually).
   - What's unclear: Whether loading all 4,000 videos at once is feasible (memory, query time) or if pagination/streaming is needed.
   - Recommendation: Start with loading all videos for a single category (typically 50-500 videos). For "All Videos", test with the actual dataset size. If >2 seconds, implement cursor-based pagination with infinite scroll. The virtualiser supports this pattern well.

2. **Keyboard navigation in grid layout**
   - What we know: The existing `useCategoryKeyboardNav` hook handles up/down in lists. Grid navigation needs left/right/up/down across a 2D layout.
   - What's unclear: Whether arrow-key grid navigation is a requirement for this phase.
   - Recommendation: Defer grid keyboard navigation. Focus on checkbox selection + toolbar actions. The existing Cmd/Ctrl+Z undo shortcut is sufficient for Phase 4.

3. **Route structure: `/videos` or extend `/analysis`**
   - What we know: Currently `/analysis` hosts both analysis mode and management mode via a toggle. Phase 4 is a new primary browsing interface.
   - What's unclear: Whether to add a new `/videos` route or extend the `/analysis` page.
   - Recommendation: Create a new `/videos` route. The analysis page is already complex (947 lines in analysis-dashboard.tsx). A separate route provides cleaner separation and better URL semantics.

## Sources

### Primary (HIGH confidence)
- `/websites/tanstack_virtual` (Context7) - Grid virtualisation patterns, useVirtualizer API, responsive grid examples
- `/bvaughn/react-window` (Context7) - Grid component API, comparison with @tanstack/react-virtual
- Existing codebase: `src/lib/db/schema.ts`, `src/app/actions/categories.ts`, `src/lib/categories/undo-stack.ts`, `src/components/analysis/*` -- direct code analysis

### Secondary (MEDIUM confidence)
- [DEV Community: Building responsive virtualised grid with TanStack Virtual](https://dev.to/dango0812/building-a-responsive-virtualized-grid-with-tanstack-virtual-37nn) - Responsive column pattern with resize observer
- [Adam Collier: Using TanStack Virtual for grid of items](https://adamcollier.co.uk/posts/using-tanstack-virtual-and-window-virtualisation-for-a-grid-of-items) - Row virtualiser + CSS grid approach
- [TanStack Virtual GitHub Discussion #295](https://github.com/TanStack/virtual/discussions/295) - Community confirmation: row virtualiser + CSS grid is the recommended simple approach
- [YouTube Thumbnail URLs](https://gist.github.com/a1ip/be4514c1fd392a8c13b05e082c4da363) - YouTube thumbnail URL pattern and sizes

### Tertiary (LOW confidence)
- None -- all findings verified with primary or secondary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - @tanstack/react-virtual verified via Context7; existing codebase patterns directly analysed
- Architecture: HIGH - Responsive grid virtualisation pattern confirmed by multiple sources and TanStack community
- Pitfalls: HIGH - Based on direct codebase analysis (schema types, N+1 queries, duration parsing) and verified virtualisation gotchas

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (stable -- virtualisation patterns are well-established)
