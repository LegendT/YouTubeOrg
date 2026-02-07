# Phase 6: Review & Approval Interface - Context

**Gathered:** 2026-02-07
**Status:** Ready for planning

<domain>
## Phase Boundary

User reviews ML categorization suggestions for Watch Later videos (4,000 items), accepts or rejects with keyboard shortcuts, manually recategorizes rejected items, and focuses on low-confidence suggestions. This phase handles the review workflow after Phase 5's ML categorization engine runs.

</domain>

<decisions>
## Implementation Decisions

### Review layout & navigation
- Grid with preview pattern (not single-focus or vertical list)
- Spacious grid layout - larger cards with thumbnail, title, channel, duration all visible without clicking
- Modal overlay on selection - centers over grid with darkened background for full focus
- Auto-advance after action - after A (accept) or R (reject), modal automatically loads next video
- User can manually navigate with arrow keys (Left/Right) in modal without accepting/rejecting

### Keyboard workflow design
- A key = Accept ML suggestion (mnemonic)
- R key = Reject ML suggestion (mnemonic)
- Tab/Shift+Tab = Navigate grid when modal closed (forward/back through cards)
- Enter = Open selected video in modal
- Escape = Close modal
- Arrow keys (Left/Right) = Navigate between videos while modal is open (without making decision)

### Manual recategorization flow
- R key marks as rejected and advances to next video (doesn't force immediate recategorization)
- User recategorizes rejected items in a separate pass (not inline during review)
- Rejected videos accumulate for later manual category assignment

### Claude's Discretion
Areas where implementation details are left to Claude:

- **Low-confidence prioritization:**
  - Initial queue strategy (show all, low-confidence first, pending only, or prompt user)
  - Confidence badge styling in grid (color-coded borders, badge overlays, icons, or none)
  - Filter/sort controls (both, filter only, sort only, or none)
  - Progress tracking display (percentage, count by confidence, remaining count, or progress bar)

- **Manual recategorization:**
  - How to access rejected items (separate tab, filter option, post-review prompt, or manual search)
  - Category picker UI (dropdown, searchable modal, grid of cards, or autocomplete)
  - Post-recategorization behavior (auto-advance to next rejected, return to grid, or confirmation)

- **Visual feedback & state:**
  - Review state indicators in grid (opacity/fade, checkmark/X overlay, border color, or remove from view)
  - Loading states (inline spinner, optimistic update, modal overlay, or disabled state)
  - Undo capability (Cmd/Ctrl+Z with banner, undo button per action, review history view, or no undo)
  - Modal content display (suggested category prominently, video metadata, category alternatives, all of above, or custom layout)

- **Batch operations:**
  - Multi-select capability (checkboxes, keyboard-based, none, or high-confidence only)
  - Bulk accept high-confidence (accept all HIGH button, review required, configurable threshold, or none)
  - Select all shortcuts (select all visible, select by confidence level, keyboard shortcut, or none)
  - Batch confirmation (always confirm, confirm for large batches, no confirmation, or custom)

</decisions>

<specifics>
## Specific Ideas

- Modal auto-advance creates flow similar to reviewing flashcards - accept/reject immediately shows next item
- Keyboard-first design priority - user should be able to complete entire review without touching mouse
- Two-pass workflow: quick accept/reject pass first, then recategorize rejected items separately (not forced inline)

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope

</deferred>

---

*Phase: 06-review-and-approval-interface*
*Context gathered: 2026-02-07*
