# Phase 11 Plan 01: Reset Proposal Action & Button Summary

**One-liner:** resetProposal server action and contextual Reset button enabling undo of approve/reject decisions

## What Was Done

### Task 1: Add resetProposal server action and widen bulkUpdateStatus
- Added `resetProposal` server action mirroring approveProposal/rejectProposal pattern
- Sets `status: 'pending'`, `approvedAt: null`, `updatedAt: new Date()`
- Imported `ProposalStatus` type from `@/types/analysis`
- Widened `bulkUpdateStatus` signature from `'approved' | 'rejected'` to `ProposalStatus`
- Added `else if (status === 'pending') { updateData.approvedAt = null; }` branch in bulkUpdateStatus

### Task 2: Add Reset button to ProposalActions component
- Imported `RotateCcw` icon from lucide-react and `resetProposal` from actions
- Added `handleReset` function following existing `handleApprove`/`handleReject` pattern
- Reset button renders conditionally: `{status !== 'pending' && ...}`
- Uses `variant="ghost"` to visually distinguish from Approve/Reject outline buttons
- Disabled only during `isPending` transitions (always clickable when visible and idle)
- Approve/Reject disabled logic unchanged

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Ghost variant for Reset button | Visually distinguishes the undo action from primary Approve/Reject outline buttons |
| Reset button placed between Reject and Badge | Natural position for an undo action, near the status badge it modifies |
| Reset only disabled during isPending | No need to disable when visible -- if visible, it can always be clicked |

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS (zero errors) |
| `resetProposal` exported from analysis.ts | PASS (line 176) |
| `bulkUpdateStatus` accepts `ProposalStatus` | PASS (line 660) |
| Reset button conditional render | PASS (`status !== 'pending'`) |
| Import link from component to action | PASS (`import { ...resetProposal } from '@/app/actions/analysis'`) |

## Key Files

### Modified
- `src/app/actions/analysis.ts` -- Added resetProposal action, widened bulkUpdateStatus, imported ProposalStatus type
- `src/components/analysis/proposal-actions.tsx` -- Added Reset button with RotateCcw icon, handleReset function

## Commits

| Hash | Message |
|------|---------|
| bda1479 | feat(11-01): add resetProposal server action and widen bulkUpdateStatus |
| 2c401eb | feat(11-01): add Reset button to ProposalActions component |

## Duration

~2.2 minutes
