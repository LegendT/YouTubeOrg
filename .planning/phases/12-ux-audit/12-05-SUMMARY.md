---
phase: 12-ux-audit
plan: 05
subsystem: ui
tags: [phosphor-icons, dark-mode, semantic-colours, dialog-components, tailwind-css-v4]

# Dependency graph
requires:
  - phase: 12-ux-audit
    provides: ThemeProvider, Phosphor Icons, semantic colour tokens (success/warning/info), Spinner component
provides:
  - All 8 analysis dialog components migrated to Phosphor icons and semantic colours
  - Dark-mode-compatible dialogs (final-review, split-wizard, duplicate-resolver, video-assignment, manual-adjustments, merge, rename, delete)
affects: [12-06 remaining analysis components, any future analysis dialog work]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Phosphor GitMerge replaces Lucide Merge icon", "Phosphor MagnifyingGlass replaces Lucide Search icon", "Spinner component pattern replaces all Loader2 + animate-spin usage", "Semantic colour tokens (text-success, text-warning, bg-warning/10) replace hardcoded Tailwind colour classes"]

key-files:
  created: []
  modified:
    - src/components/analysis/final-review.tsx
    - src/components/analysis/split-wizard.tsx
    - src/components/analysis/duplicate-resolver.tsx
    - src/components/analysis/video-assignment-dialog.tsx
    - src/components/analysis/manual-adjustments.tsx
    - src/components/analysis/merge-categories-dialog.tsx
    - src/components/analysis/rename-category-dialog.tsx
    - src/components/analysis/delete-category-dialog.tsx

key-decisions:
  - "Lucide Merge icon mapped to Phosphor GitMerge (closest semantic equivalent)"
  - "Lucide Search icon mapped to Phosphor MagnifyingGlass (Phosphor has no Search icon)"
  - "amber-50/amber-600/amber-800 hardcoded colours all mapped to semantic warning/10 and text-warning tokens"
  - "green-600/green-50 mapped to text-success and bg-success/10; red-600/red-50 mapped to text-destructive and bg-destructive/10"

patterns-established:
  - "Pattern: All loading spinners use <Spinner size={N} /> instead of <Loader2 className='animate-spin' />"
  - "Pattern: Warning states use text-warning and bg-warning/10 instead of text-amber-600 dark:text-amber-400"
  - "Pattern: Success states use text-success instead of text-green-600"

# Metrics
duration: 5min
completed: 2026-02-08
---

# Phase 12 Plan 05: Analysis Dialogs Migration Summary

**All 8 analysis dialog components migrated from Lucide to Phosphor icons and from hardcoded Tailwind colours to semantic tokens for full dark mode support**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-08T16:04:16Z
- **Completed:** 2026-02-08T17:20:46Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Replaced all Lucide icon imports with Phosphor equivalents across 8 dialog components (CheckCircle, Warning, ArrowRight, ArrowDown, ArrowLeft, Scissors, CheckCircle, ListChecks, MagnifyingGlass, X, Plus, FolderPlus, GitMerge)
- Replaced all Loader2 + animate-spin patterns with reusable Spinner component
- Replaced all hardcoded colour classes (green-600, red-600, amber-600, amber-50, amber-800, amber-950, amber-500, amber-400, green-50, red-50, green-800, red-800, green-950, red-950, green-200, red-200) with semantic tokens (text-success, text-destructive, text-warning, bg-success/10, bg-destructive/10, bg-warning/10)
- Delete dialog already uses variant="destructive" button (confirmed correct pattern)

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate large dialog/wizard components** - `392633c` (feat)
2. **Task 2: Migrate smaller dialog components** - `6ffc96e` (feat)

## Files Created/Modified
- `src/components/analysis/final-review.tsx` - Lucide CheckCircle/AlertTriangle/Loader2/ArrowRight/ArrowDown replaced with Phosphor + Spinner + semantic colours
- `src/components/analysis/split-wizard.tsx` - Lucide Loader2/ArrowLeft/ArrowRight/Scissors replaced with Phosphor + Spinner, amber-600 replaced with warning token
- `src/components/analysis/duplicate-resolver.tsx` - Lucide CheckCircle2/ListChecks/Loader2 replaced with Phosphor CheckCircle/ListChecks + Spinner, green-600 replaced with success token
- `src/components/analysis/video-assignment-dialog.tsx` - Lucide Search/X/AlertTriangle/Loader2 replaced with Phosphor MagnifyingGlass/X/Warning + Spinner, amber colours replaced with warning token
- `src/components/analysis/manual-adjustments.tsx` - Lucide Plus/X/Search/FolderPlus/AlertTriangle/Loader2 replaced with Phosphor + Spinner, amber-50/amber-800 replaced with warning/10 token
- `src/components/analysis/merge-categories-dialog.tsx` - Lucide Merge/AlertTriangle/Loader2 replaced with Phosphor GitMerge/Warning + Spinner, amber-500 border replaced with warning/50
- `src/components/analysis/rename-category-dialog.tsx` - Lucide Loader2 replaced with Spinner (no other icons or hardcoded colours present)
- `src/components/analysis/delete-category-dialog.tsx` - Lucide AlertTriangle/Loader2 replaced with Phosphor Warning + Spinner, amber-50/amber-800/amber-950/amber-200 replaced with warning/10 + warning tokens

## Decisions Made
- **Lucide Merge mapped to Phosphor GitMerge:** Phosphor does not have a direct "Merge" icon. GitMerge is the closest semantic equivalent and is commonly used for merge operations.
- **Lucide Search mapped to Phosphor MagnifyingGlass:** Phosphor's search icon is named MagnifyingGlass. Both have the same visual appearance.
- **Hardcoded dark mode overrides removed:** Patterns like `text-amber-600 dark:text-amber-400` and `bg-amber-50 dark:bg-amber-950 dark:text-amber-200` were replaced with single semantic tokens (`text-warning`, `bg-warning/10`) that automatically adapt to light/dark mode via CSS custom properties.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- **Disk space exhaustion during build verification:** The system disk was at 100% capacity, preventing `npm run build` from completing. Used `rm -rf .next` to free space and verified with `npx tsc --noEmit` instead. All type checks passed with no new errors (only pre-existing errors from other concurrent plan work).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 8 analysis dialog components fully migrated to Phosphor icons and semantic colours
- Zero Lucide imports remaining in these 8 files
- Zero hardcoded colour classes remaining in these 8 files
- All dialogs work correctly in dark mode via semantic colour tokens
- Remaining Lucide imports exist in other analysis components (category-detail, category-list, proposal-table, etc.) which are covered by other Phase 12 plans

---
*Phase: 12-ux-audit*
*Completed: 2026-02-08*
