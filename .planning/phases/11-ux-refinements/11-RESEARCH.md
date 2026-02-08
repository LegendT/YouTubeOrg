# Phase 11: UX Refinements - Research

**Researched:** 2026-02-08
**Domain:** React component refactoring (shadcn/Radix UI, Lucide icons, Drizzle ORM server actions)
**Confidence:** HIGH

## Summary

Phase 11 addresses three scoped UX issues in the analysis workflow: approval toggle behaviour, checkbox/approval visual conflation, and a missing Cancel button in the Final Review dialog. All changes are to existing components in `src/components/analysis/`.

The codebase already has all the building blocks: shadcn `Dialog` with `DialogFooter`, Lucide icons including `RotateCcw` (used elsewhere for "restore"), `Undo2` (used for undo), Drizzle ORM server actions for status updates, and a `bulkUpdateStatus` function that needs its type signature widened to accept `'pending'`. No new dependencies are needed.

The three changes are isolated to 4-5 existing files plus one new server action function. The existing `ProposalStatus` type already includes `'pending'` and the database enum supports it natively, so the "reset to pending" flow requires only a new server action and UI buttons -- no schema migration.

**Primary recommendation:** Implement as three independent plans that can each be verified in isolation: (1) reset button + approval behaviour, (2) checkbox/approval visual separation, (3) final review cancel button.

## Standard Stack

### Core (Already Installed -- No New Dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@radix-ui/react-dialog` | (via shadcn) | Dialog primitive for Final Review | Already used throughout |
| `lucide-react` | 0.563.0 | Icons for Reset, status indicators | Already used throughout |
| `sonner` | (installed) | Toast notifications | Already used in Phase 10 |
| `drizzle-orm` | (installed) | Server action DB updates | Already used for approve/reject |
| `tailwindcss` | v4 | Styling | Already configured |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn `Button` | local | All action buttons | Reset, Cancel, Approve, Reject |
| shadcn `Badge` | local | Status display | Approval state indicators |
| shadcn `Checkbox` | local | Batch selection | Already used in CategoryList |
| shadcn `DialogFooter` | local | Footer layout for Cancel/Execute | Already exported from dialog.tsx |

### Alternatives Considered

None -- all tools are already in the codebase. No new libraries needed.

**Installation:**
```bash
# No installation needed -- all dependencies already present
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/analysis/
│   ├── proposal-actions.tsx    # MODIFY: Add Reset button, change approve/reject behaviour
│   ├── category-list.tsx       # MODIFY: Visual separation of checkbox vs approval state
│   ├── final-review.tsx        # MODIFY: Add Cancel button to dialog footer
│   ├── analysis-dashboard.tsx  # MODIFY: Add "Reset selected" to BatchToolbar, pass toast
│   └── batch-operations.tsx    # MODIFY: Add "Reset selected" batch operation
├── app/actions/
│   └── analysis.ts             # MODIFY: Add resetProposal server action, widen bulkUpdateStatus
└── types/
    └── analysis.ts             # NO CHANGE: ProposalStatus already includes 'pending'
```

### Pattern 1: Three-State Approval with Reset
**What:** Proposal has three states: pending, approved, rejected. Approve/Reject buttons transition between states. A contextual Reset button returns any non-pending state to pending.
**When to use:** For the `ProposalActions` component.
**Key behaviours (locked decisions):**
- Approve on already-approved = no-op (button disabled)
- Reject on already-rejected = no-op (button disabled)
- Approve on rejected = direct transition to approved (allowed)
- Reject on approved = direct transition to rejected (allowed)
- Reset button appears only when status is approved or rejected
- Reset returns to pending

**Current code (`proposal-actions.tsx` line 69):**
```typescript
disabled={isPending || status === 'approved' || videoCount > 4500}
```
The Approve button currently disables when `status === 'approved'` -- this is correct and stays.
The Reject button disables when `status === 'rejected'` -- this is correct and stays.

**What changes:** Remove no other disabling logic. Add a Reset button that calls `resetProposal(proposalId)`. The Reset button only renders when `status !== 'pending'`.

### Pattern 2: Server Action for Reset
**What:** A new `resetProposal` server action that sets status back to 'pending' and clears `approvedAt`.
**When to use:** For individual and batch reset operations.

**Implementation pattern (mirrors existing `approveProposal`/`rejectProposal`):**
```typescript
// Source: existing pattern from src/app/actions/analysis.ts lines 130-168
export async function resetProposal(proposalId: number): Promise<ProposalActionResult> {
  try {
    await db
      .update(consolidationProposals)
      .set({
        status: 'pending',
        approvedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(consolidationProposals.id, proposalId));

    revalidatePath('/analysis');
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}
```

### Pattern 3: Widened bulkUpdateStatus for Batch Reset
**What:** The existing `bulkUpdateStatus` function only accepts `'approved' | 'rejected'`. Widen to `ProposalStatus` (includes `'pending'`) to support "Reset selected" batch operation.
**When to use:** For the batch toolbar in `analysis-dashboard.tsx`.

**Current signature (line 636):**
```typescript
status: 'approved' | 'rejected'
```
**New signature:**
```typescript
status: ProposalStatus  // 'pending' | 'approved' | 'rejected'
```
**Additional logic:** When status is `'pending'`, set `approvedAt: null` to clear the approval timestamp.

### Pattern 4: DialogFooter for Cancel + Execute
**What:** Use the existing shadcn `DialogFooter` component for the Final Review dialog's action area.
**When to use:** For the FinalReview component bottom section.

**The existing project pattern (e.g., `delete-category-dialog.tsx`, `CreateNewCategoryDialog`):**
```typescript
<DialogFooter>
  <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
    Cancel
  </Button>
  <Button onClick={handleExecute} disabled={isPending || approved.length === 0}>
    Execute consolidation
  </Button>
</DialogFooter>
```
`DialogFooter` renders as `flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2` which naturally places Cancel left, Execute right on desktop (the locked decision).

### Pattern 5: Visual Separation of Checkboxes from Approval State
**What:** Checkboxes serve batch selection only. Approval state is communicated through a different visual channel (coloured left border + status icon) that cannot be confused with a checkbox.
**When to use:** For each category row in `CategoryList`.

**Current problem:** Each row has both a Checkbox (for batch selection) AND a `StatusIcon` + `StatusBadge` -- but the StatusIcon is a small circle/check/X that could be confused with the checkbox, and both are left-aligned.

**Recommendation (Claude's Discretion area):**

1. **Checkboxes: Always visible** (not toggle-to-show). Rationale: The batch toolbar only appears when items are selected, so hiding checkboxes would make the feature undiscoverable. This is the standard pattern in Gmail, GitHub, and other batch-operation UIs.

2. **Approval state: Coloured left border + icon removal from inline position.** Replace the small inline `StatusIcon` (Check/X/Circle) with a 3px coloured left border on the row:
   - `border-l-3 border-green-500` for approved
   - `border-l-3 border-red-500` for rejected
   - `border-l-3 border-transparent` for pending (maintains alignment)

3. **Keep the StatusBadge** on the right side of each row. It already reads "Approved" / "Rejected" / "Pending" with appropriate colours. This provides explicit text confirmation of the state. The badge is visually distinct from the checkbox (different position, different shape, has text).

4. **Remove the inline StatusIcon** (the small Check/X/Circle before the category name). This is the element most likely to be confused with a checkbox since it sits at the same vertical position.

This approach creates clear spatial separation: checkbox = leftmost column (for batch ops), coloured border = immediate visual state indicator, badge = explicit textual state on the right.

### Anti-Patterns to Avoid
- **Using checkbox appearance for approval state:** The whole point of this phase is to separate these visually. Never use a checkbox-like control for approval.
- **Toggle-to-show batch checkboxes:** Adds a hidden mode that makes batch operations undiscoverable.
- **Custom animations or transitions:** Out of scope. These are simple state changes, not animated transitions.
- **Changing the data model:** The existing `ProposalStatus` type and DB enum already support all three states. No schema changes needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dialog footer layout | Custom flex layout | `DialogFooter` from shadcn | Already handles responsive stacking |
| Reset icon | Custom SVG | `RotateCcw` from lucide-react | Already used in project for restore/reset semantics |
| Status-based conditional rendering | Complex ternary chains | Simple `status !== 'pending'` guard for Reset button | Cleaner, matches existing pattern |
| Batch operation extension | Separate batch reset function | Widen existing `bulkUpdateStatus` | Reuses existing error handling, revalidation, UI |

**Key insight:** Every UI primitive needed (Button, Badge, Dialog, Checkbox, icons) already exists in the project. This phase is pure composition and refactoring -- zero new dependencies.

## Common Pitfalls

### Pitfall 1: useTransition Serialisation Blocking
**What goes wrong:** Multiple server actions called via `startTransition` from the same component tree block each other, causing the UI to appear hung.
**Why it happens:** React batches transitions and only one can be active per component tree at a time. The project MEMORY.md explicitly flags this.
**How to avoid:** Each action button should have its own `useTransition` hook, or use a single transition with clear mutual exclusion (disable all buttons during any pending state). The existing `ProposalActions` already uses a single `useTransition` with `isPending` disabling all buttons -- keep this pattern and extend it to the Reset button.
**Warning signs:** Clicking Reset while Approve/Reject is pending, or vice versa.

### Pitfall 2: approvedAt Not Cleared on Reset
**What goes wrong:** Resetting a proposal to pending but leaving `approvedAt` set causes stale data when the proposal is re-approved (the old timestamp persists).
**Why it happens:** Forgetting to null out `approvedAt` in the reset server action.
**How to avoid:** The `resetProposal` server action MUST set `approvedAt: null` alongside `status: 'pending'`. The `bulkUpdateStatus` function must also handle this for batch resets.
**Warning signs:** Proposals showing old approval timestamps after being reset and re-approved.

### Pitfall 3: Cancel Button Closing During Execution
**What goes wrong:** User clicks Cancel while the consolidation is executing, closing the dialog mid-operation.
**Why it happens:** The Cancel button calls `onOpenChange(false)` unconditionally.
**How to avoid:** Disable the Cancel button (and the X close button) during `isPending` state. The existing code already handles this in `handleOpenChange` (line 106: `if (!isPending)`), so the Cancel button just needs `disabled={isPending}`.
**Warning signs:** Dialog closing with a spinner still visible.

### Pitfall 4: Inconsistent Border Styling in Tailwind v4
**What goes wrong:** `border-l-3` might not work as expected in Tailwind v4 without explicit configuration.
**Why it happens:** Tailwind v4 uses CSS-first configuration. Arbitrary values like `border-l-[3px]` are always safe; named widths depend on theme.
**How to avoid:** Use `border-l-[3px]` (arbitrary value syntax) rather than `border-l-3` for the coloured approval border. Or verify that Tailwind v4 config includes `3` in border-width scale.
**Warning signs:** Border not rendering or rendering at wrong width.

### Pitfall 5: BatchToolbar Reset Clearing approvedAt in Bulk
**What goes wrong:** Batch reset sets status to 'pending' but the `bulkUpdateStatus` function doesn't clear `approvedAt` for the 'pending' case.
**Why it happens:** The current function only sets `approvedAt` when approving, but doesn't null it out for other states.
**How to avoid:** Add explicit handling: `if (status === 'pending') { updateData.approvedAt = null; }` in `bulkUpdateStatus`.
**Warning signs:** Same as Pitfall 2 but at batch scale.

## Code Examples

### Reset Button in ProposalActions
```typescript
// Pattern for adding Reset to existing ProposalActions component
// Source: mirrors existing handleApprove/handleReject pattern (proposal-actions.tsx)

import { RotateCcw } from 'lucide-react'
import { resetProposal } from '@/app/actions/analysis'

function handleReset() {
  startTransition(async () => {
    await resetProposal(proposalId)
    onStatusChange?.()
  })
}

// In JSX, after Approve and Reject buttons:
{status !== 'pending' && (
  <Button
    size="sm"
    variant="ghost"
    onClick={handleReset}
    disabled={isPending}
    className="gap-1"
  >
    <RotateCcw className="h-4 w-4" />
    Reset
  </Button>
)}
```

### Cancel Button in Final Review
```typescript
// Pattern for adding Cancel to FinalReview dialog footer
// Source: existing DialogFooter pattern from delete-category-dialog.tsx, CreateNewCategoryDialog

// Replace the existing <div className="pt-4 space-y-3"> section with:
<DialogFooter className="pt-4">
  <Button
    variant="outline"
    onClick={() => handleOpenChange(false)}
    disabled={isPending || result?.type === 'success'}
  >
    Cancel
  </Button>
  <Button
    size="lg"
    onClick={handleExecute}
    disabled={approved.length === 0 || isPending || result?.type === 'success'}
  >
    {isPending ? (
      <>
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Executing...
      </>
    ) : result?.type === 'success' ? (
      <>
        <CheckCircle className="h-4 w-4 mr-2" />
        Consolidation saved
      </>
    ) : (
      'Execute consolidation'
    )}
  </Button>
</DialogFooter>
```

### Coloured Left Border for Approval State
```typescript
// Pattern for category row with coloured border indicating approval state
// Source: analysis of current category-list.tsx row rendering

function getStatusBorderClass(status: string): string {
  switch (status) {
    case 'approved':
      return 'border-l-[3px] border-l-green-500'
    case 'rejected':
      return 'border-l-[3px] border-l-red-500'
    default:
      return 'border-l-[3px] border-l-transparent'
  }
}

// In the category row div:
<div
  className={`flex items-start gap-2 rounded-md px-3 py-2.5 transition-colors hover:bg-accent/50 ${
    getStatusBorderClass(proposal.status)
  } ${selectedId === proposal.id ? 'bg-accent' : ''} ${
    isFocused ? 'ring-2 ring-primary' : ''
  }`}
>
  {/* Checkbox for batch selection (no StatusIcon here anymore) */}
  {batchSelection && (
    <div className="pt-0.5">
      <Checkbox ... />
    </div>
  )}
  <button className="flex-1 text-left min-w-0">
    {/* Category name WITHOUT StatusIcon prefix */}
    <span className="font-medium text-sm truncate">
      {proposal.categoryName}
    </span>
    ...
    {/* StatusBadge stays on the right */}
    <StatusBadge status={proposal.status} />
  </button>
</div>
```

### Batch Reset in BatchToolbar
```typescript
// Pattern for adding "Reset selected" to BatchToolbar
// Source: existing BatchToolbar in analysis-dashboard.tsx

<Button
  size="sm"
  variant="ghost"
  onClick={() => handleBatchAction('pending')}
  disabled={isPending}
>
  {isPending ? (
    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
  ) : (
    <RotateCcw className="h-4 w-4 mr-1.5" />
  )}
  Reset
</Button>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| One-way approve/reject | Three-state with explicit reset | This phase | Users can undo approval decisions |
| StatusIcon inline with name | Coloured left border | This phase | Clear separation from checkbox |
| No Cancel button in Final Review | Cancel + Execute in DialogFooter | This phase | Standard dialog affordance |

**Deprecated/outdated:**
- None -- this is a refinement of existing patterns, not a technology change.

## Open Questions

1. **`border-l-[3px]` rendering in Tailwind v4**
   - What we know: Arbitrary values work in Tailwind v4 with bracket syntax. The project uses `@import "tailwindcss"` (v4 style).
   - What's unclear: Whether `border-l-[3px]` combined with `border-l-green-500` works correctly (two border-left utilities may conflict).
   - Recommendation: Use `border-l-[3px] border-l-green-500` and verify visually. If conflicting, fall back to a wrapper `<div>` with the border applied to a separate element, or use inline style for the border.

2. **Toast vs inline feedback for reset**
   - What we know: Phase 10 added sonner toast. The batch toolbar currently uses inline Badge feedback.
   - What's unclear: Whether to use toast for single-item reset or keep the inline badge pattern.
   - Recommendation: Use toast for single-item reset (consistent with Phase 10 direction) and inline feedback for batch operations (matches existing BatchToolbar pattern). This is Claude's discretion territory.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of all modified files:
  - `src/components/analysis/proposal-actions.tsx` (91 lines)
  - `src/components/analysis/category-list.tsx` (685 lines)
  - `src/components/analysis/final-review.tsx` (333 lines)
  - `src/components/analysis/analysis-dashboard.tsx` (947 lines)
  - `src/components/analysis/batch-operations.tsx` (164 lines)
  - `src/app/actions/analysis.ts` (lines 130-168, 634-665)
  - `src/lib/db/schema.ts` (proposalStatusEnum, consolidationProposals)
  - `src/types/analysis.ts` (ProposalStatus type)
  - `src/components/ui/dialog.tsx` (DialogFooter layout)
- Existing dialog patterns: `delete-category-dialog.tsx`, `CreateNewCategoryDialog` in `analysis-dashboard.tsx`
- lucide-react 0.563.0 -- `RotateCcw` already used in `backup-list.tsx`

### Secondary (MEDIUM confidence)
- Tailwind v4 arbitrary value syntax (verified by project's existing use of bracket syntax elsewhere)

### Tertiary (LOW confidence)
- None -- all findings verified directly from codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all dependencies already installed, verified from package.json
- Architecture: HIGH -- patterns directly observed in existing codebase, no new patterns introduced
- Pitfalls: HIGH -- identified from direct code analysis and project MEMORY.md learnings

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (stable -- no external dependency changes expected)
