# Phase 10: UI Polish & Code Quality - Context

**Gathered:** 2026-02-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace all alert() calls with toast notifications, replace window.confirm() with styled modal dialogs, fix TypeScript errors in ML worker, and sweep all user-facing strings (plus code comments, variable names, and database schema) for British English consistency.

</domain>

<decisions>
## Implementation Decisions

### Toast notification style
- Position: bottom-right of viewport
- Stacking: unlimited visible toasts (no cap)
- Duration: 3 seconds auto-dismiss for success, persistent (manual dismiss) for errors
- Action buttons: include where applicable (e.g., Undo on destructive actions, View for navigation)
- Colour-coding: green for success, red for error, amber for warning, blue for info
- Library: Claude's discretion (shadcn/ui toast or sonner — pick best fit for existing stack)

### British English scope
- Coverage: everything — UI strings, code comments, AND code identifiers (variables, functions, types)
- Database data: rename protected "Uncategorized" category to "Uncategorised" in DB (requires migration)
- Database schema: rename column/table names to British spelling where applicable (requires migrations)
- Spelling variants: comprehensive — all British forms including:
  - -ise endings (categorise, organise, finalise, summarise, recognise)
  - -our endings (colour, behaviour, favourite)
  - -yse endings (analyse)
  - -ence endings (defence)
  - -re endings (centre)

### Error & feedback presentation
- window.confirm() → replace with styled Radix Dialog modal confirmations (not toasts)
- Server action failures → inline error messages near the triggering component (not toast)
- Success confirmations → inline feedback near the triggering component (not toast)
- Batch operation feedback → Claude's discretion (toast or toolbar banner — depends on context)

### Claude's Discretion
- Toast library choice (shadcn/ui toast vs sonner)
- Batch operation feedback pattern (toast vs toolbar banner)
- Exact inline feedback component design
- ML worker TypeScript fix approach

</decisions>

<specifics>
## Specific Ideas

- Inline feedback pattern preferred over toasts for most interactions — user wants contextual feedback near where the action happened
- Toasts reserved primarily for situations without a clear contextual location (batch operations at Claude's discretion)
- Destructive confirmations (delete, restore) should feel intentional — styled modal dialogs, not native browser prompts

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-ui-polish-code-quality*
*Context gathered: 2026-02-08*
