# Phase 11: UX Refinements - Context

**Gathered:** 2026-02-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix three specific UX issues in the analysis workflow (Phase 2 UI): approval toggle behaviour, checkbox/approval visual conflation, and missing cancel button in the Final Review dialog. These are scoped fixes to existing components, not new features.

</domain>

<decisions>
## Implementation Decisions

### Approval toggle behaviour
- Approve button stays as no-op when already approved (does NOT toggle back to pending)
- Reject button stays as no-op when already rejected
- New explicit "Reset" button appears alongside Approve/Reject to return an approved or rejected proposal to pending
- Direct switch is allowed: clicking Reject on an approved proposal goes straight to rejected (and vice versa) without needing to reset first
- Reset button should appear contextually (only when proposal is in approved or rejected state)

### Checkbox vs approval separation
- Checkboxes are for batch selection only — must be visually distinct from approval state indicators
- New "Reset selected" batch operation added alongside existing "Approve selected" / "Reject selected" in the batch toolbar
- Claude's Discretion: whether checkboxes are always visible or toggled via a button
- Claude's Discretion: how approval state is displayed (coloured border, icons, badges) — the key requirement is clear visual separation from batch-selection checkboxes
- Claude's Discretion: whether to keep or remove the status badge on the right side of each category row

### Cancel button in Final Review dialog
- Explicit Cancel button placed to the left of the Execute button
- No double confirmation — the Final Review dialog itself serves as the confirmation step
- Cancel closes the dialog (same as the X button, but more discoverable)

### Claude's Discretion
- Checkbox visibility mode (always visible vs toggle-to-show)
- Approval state visual treatment (icons, borders, badges — whatever creates clearest separation)
- Information density balance in category list rows
- Reset button styling and icon choice

</decisions>

<specifics>
## Specific Ideas

- The user wants the overall UX to feel "best in class" — while Phase 11 is scoped to these three fixes, quality of implementation matters
- Standard dialog pattern: Cancel left, Execute right (destructive action on the right)

</specifics>

<deferred>
## Deferred Ideas

- Broader UX audit of the full application (user mentioned wanting to "verify that the UX of the app is best in class") — this goes beyond the three scoped fixes and would be its own phase

</deferred>

---

*Phase: 11-ux-refinements*
*Context gathered: 2026-02-08*
