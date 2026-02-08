# Phase 11 Plan 02: Visual Separation of Checkbox and Approval State Summary

**One-liner:** Coloured left borders replace inline StatusIcon for approval state, Reset batch operation added to toolbar

## What Was Done

### Task 1: Replace inline StatusIcon with coloured left border
- Added `getStatusBorderClass` helper function returning Tailwind border classes (green-500/red-500/transparent)
- Applied coloured left border to both main proposals and review-needed sections in analysis mode
- Removed `StatusIcon` component entirely (was only used in analysis mode)
- Kept `StatusBadge` text badges on the right side of each row
- Management mode rendering completely untouched (still uses FolderOpen icon)
- **Commit:** 55e5813

### Task 2: Add Reset button to analysis BatchToolbar
- Added `RotateCcw` icon import from lucide-react
- Widened `handleBatchAction` type from `'approved' | 'rejected'` to `'approved' | 'rejected' | 'pending'`
- Added feedback label "reset to pending" for the pending status case
- Inserted Reset button (ghost variant) before Reject in the toolbar button group
- Reset calls `bulkUpdateStatus(ids, 'pending')` which was enabled by Plan 11-01
- ManagementBatchToolbar left unchanged
- **Commit:** df23e62

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Remove StatusIcon entirely rather than keeping definition | Component was only used in analysis mode rows; no other consumers existed |
| Keep Check/X/Circle imports | Still used by StatusBadge component |
| Reset button uses ghost variant | Least destructive action gets least prominent styling (ghost < outline < default) |

## Verification Results

1. `npx tsc --noEmit` passes with zero errors
2. `getStatusBorderClass` applied to both main and review sections (lines 547, 625)
3. `StatusIcon` has zero references in the file
4. `StatusBadge` remains on right side (lines 575, 657)
5. Checkboxes unchanged - exclusively for batch selection
6. BatchToolbar has Reset (ghost) / Reject (outline) / Approve (default) buttons
7. `handleBatchAction('pending')` wired to Reset button
8. Management mode uses FolderOpen icon, no coloured borders

## Files Modified

| File | Changes |
|------|---------|
| `src/components/analysis/category-list.tsx` | Replaced StatusIcon with getStatusBorderClass, added border classes to rows |
| `src/components/analysis/analysis-dashboard.tsx` | Added RotateCcw import, widened handleBatchAction, added Reset button |

## Duration

~2.4 minutes
