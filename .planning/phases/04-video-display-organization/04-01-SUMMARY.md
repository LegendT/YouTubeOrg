---
phase: 04-video-display-organization
plan: 01
subsystem: foundation
tags: [types, utilities, dependencies, foundation]
completed: 2026-02-06
duration: 4.6 min

# Dependency graph
requires:
  - 03-06 # Category management complete with management mode
provides:
  - Shared video types (VideoCardData, SortOption, UndoData)
  - Format utilities (duration, date, seconds parsing)
  - Category colour generator (deterministic HSL from name)
  - Thumbnail URL constructor (YouTube mqdefault)
  - @tanstack/react-virtual for virtualized lists
  - shadcn dropdown-menu component
affects:
  - 04-02 # Browse categories page will use these types
  - 04-03 # Video card component will use VideoCardData
  - 04-04 # Video list with sort/filter will use SortOption
  - 04-05 # Uncategorised videos will use shared utilities

# Tech tracking
tech-stack:
  added:
    - "@tanstack/react-virtual@3.13.18"
    - "@radix-ui/react-dropdown-menu@2.1.16"
  patterns:
    - "Shared utility extraction pattern for cross-phase code reuse"
    - "Deterministic colour generation from string hashing"

# File tracking
key-files:
  created:
    - src/types/videos.ts
    - src/lib/videos/format.ts
    - src/lib/videos/category-colours.ts
    - src/lib/videos/thumbnail-url.ts
    - src/components/ui/dropdown-menu.tsx
  modified:
    - package.json
    - package-lock.json
    - src/components/analysis/video-list-paginated.tsx
    - src/components/analysis/video-assignment-dialog.tsx
    - src/components/playlist-list.tsx

# Decisions
decisions:
  - "Extract format utilities from Phase 2 components to /lib/videos/ for reuse across video display"
  - "Use mqdefault (320x180) thumbnail quality as standard - available for all videos, good balance of size/quality"
  - "SortOption includes both dateAdded variants (newest/oldest) for flexible default sorting in browse UI"
  - "VideoCardData includes categoryNames array for multi-category badge display"
  - "getCategoryColour uses HSL with fixed saturation/lightness for consistent visual appearance"
---

# Phase 4 Plan 01: Foundation Types & Utilities Summary

**One-liner:** Installed virtualization and dropdown dependencies, created shared video types (VideoCardData, SortOption, UndoData), extracted format utilities from Phase 2, added category colour and thumbnail URL generators

## What Was Built

### Dependencies & UI Components
- **@tanstack/react-virtual** (v3.13.18): Virtual scrolling library for high-performance rendering of large video lists
- **dropdown-menu shadcn component**: Radix UI-based dropdown for sort/filter controls in video lists

### Shared Types (src/types/videos.ts)
- **VideoCardData**: Standard interface for video display with id, youtubeId, title, thumbnailUrl, duration, channelTitle, publishedAt, categoryNames
- **SortOption**: Union type with 5 variants (dateAdded, dateAddedOldest, publishedAt, title, duration)
- **MoveUndoData**: Undo tracking for move operations (videoIds, from/to category IDs and names)
- **CopyUndoData**: Undo tracking for copy operations (videoIds, target category, categoryVideoIds for removal)

### Format Utilities (src/lib/videos/format.ts)
Extracted from Phase 2 components (video-list-paginated.tsx, video-assignment-dialog.tsx):
- **parseDurationToSeconds**: Converts ISO 8601 duration (PT1H2M3S) to total seconds
- **formatDuration**: Converts ISO 8601 to human-readable MM:SS or H:MM:SS
- **formatRelativeDate**: Converts Date/ISO string to relative time ("2 days ago", "3 months ago")

### Colour Generator (src/lib/videos/category-colours.ts)
- **getCategoryColour**: Deterministic HSL colour from category name string
  - Simple string hash maps to hue (0-360)
  - Fixed saturation (65%) and lightness (55%) for consistent appearance
  - Same name always produces same colour

### Thumbnail URL (src/lib/videos/thumbnail-url.ts)
- **getThumbnailUrl**: Constructs YouTube mqdefault (320x180) thumbnail URL from video ID
  - Uses i.ytimg.com/vi/{id}/mqdefault.jpg
  - Returns null if no ID provided

### Refactoring
- Updated video-list-paginated.tsx to import formatDuration/formatRelativeDate from shared utilities
- Updated video-assignment-dialog.tsx to import formatDuration from shared utilities
- Fixed playlist-list.tsx to handle nullable itemCount from database schema (nullish coalescing to 0)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed nullable itemCount type mismatch in playlist-list.tsx**
- **Found during:** TypeScript compilation verification
- **Issue:** PlaylistList component defined itemCount as non-nullable, but database schema returns number | null, causing build failure
- **Fix:** Updated Playlist interface to itemCount: number | null, added nullish coalescing (?? 0) at display sites
- **Files modified:** src/components/playlist-list.tsx
- **Commit:** 869a3f1 (combined with Task 2)

This was a blocking issue preventing verification of Task 2 completion. The type mismatch existed from Phase 1 but wasn't caught until TypeScript strict checking during this build.

## Decisions Made

1. **Extract format utilities to shared location**: Phase 2 components had duplicate formatDuration/formatRelativeDate implementations. Extracting to /lib/videos/ eliminates duplication and ensures consistency across all video display interfaces.

2. **Use mqdefault thumbnail quality**: YouTube offers multiple thumbnail sizes (default/mqdefault/hqdefault/sddefault/maxresdefault). mqdefault (320x180) chosen as standard:
   - Available for all videos (maxresdefault isn't guaranteed)
   - Good balance of file size vs quality for card thumbnails
   - Consistent aspect ratio (16:9)

3. **SortOption includes bidirectional dateAdded**: Most browse UIs default to newest-first (dateAdded), but some contexts (watch queue, chronological viewing) need oldest-first (dateAddedOldest). Including both avoids runtime string manipulation.

4. **VideoCardData includes categoryNames array**: Videos belong to multiple categories. Including full array enables:
   - Badge rendering without additional queries
   - "Already in category" detection for assignment dialogs
   - Filtering/grouping by category in list views

5. **Deterministic colour generation via hashing**: Category badges need consistent colours without database storage. String hash → hue (0-360) with fixed saturation/lightness ensures:
   - Same category always renders same colour
   - Visual distinction between categories
   - No colour management overhead

## Integration Points

### Phase 2 Refactoring
- video-list-paginated.tsx: Removed inline formatDuration/formatRelativeDate, imports from /lib/videos/format
- video-assignment-dialog.tsx: Removed inline formatDuration, imports from /lib/videos/format
- Both components now share single implementation, reducing maintenance burden

### Phase 4 Foundation
All subsequent Phase 4 plans build on these types and utilities:
- **04-02** (Browse Categories): Uses VideoCardData, getCategoryColour, getThumbnailUrl
- **04-03** (Video Card Component): Implements VideoCardData interface
- **04-04** (Video List with Sort/Filter): Uses SortOption, formatDuration, formatRelativeDate
- **04-05** (Uncategorised Videos): Uses shared types and utilities

## Testing & Verification

✅ **npm ls @tanstack/react-virtual**: v3.13.18 installed
✅ **ls src/components/ui/dropdown-menu.tsx**: Component exists
✅ **npx tsc --noEmit**: All type definitions compile without errors
✅ **Import test**: All exports verified with temporary TypeScript file
✅ **Refactored components**: video-list-paginated and video-assignment-dialog compile with new imports
✅ **Build verification**: TypeScript compilation passes after itemCount fix

## File Structure

```
src/
├── types/
│   └── videos.ts              # VideoCardData, SortOption, UndoData types
├── lib/
│   └── videos/
│       ├── format.ts          # Duration/date formatting utilities
│       ├── category-colours.ts # Deterministic colour generation
│       └── thumbnail-url.ts   # YouTube thumbnail URL constructor
└── components/
    ├── ui/
    │   └── dropdown-menu.tsx  # shadcn dropdown component
    └── analysis/
        ├── video-list-paginated.tsx    # Updated to use shared utilities
        └── video-assignment-dialog.tsx # Updated to use shared utilities
```

## Next Phase Readiness

**Phase 4 foundation complete.** All types, utilities, and dependencies in place for video browsing interface.

**Ready to proceed to 04-02**: Browse Categories page with category list and video display area.

**No blockers identified.**

## Metrics

- **Tasks completed:** 2/2
- **Commits:** 2
  - f3e9e75: Install @tanstack/react-virtual and dropdown-menu component
  - 869a3f1: Create shared video types and utility functions
- **Files created:** 5 (types + utilities + dropdown component)
- **Files modified:** 5 (dependencies + refactored Phase 2 components + bug fix)
- **Duration:** 4.6 minutes
- **Deviations:** 1 (blocking type mismatch fix)
