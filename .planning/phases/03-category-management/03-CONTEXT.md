# Phase 3: Category Management - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Full CRUD control over the approved category structure from Phase 2. Users can create, rename, delete, and manually merge categories. This extends the existing analysis dashboard — no new pages. Video browsing/search (Phase 4) and ML categorization (Phase 5) are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Management UI structure
- Extend the existing analysis dashboard — no dedicated management page
- Category list shows: name, video count, source playlists, and status indicators (synced/unsynced, recently modified)
- Reuse Phase 2's existing sort/filter for the category list
- Management actions (rename, delete, merge) via inline action buttons (small icons visible on hover)
- Rename uses a dialog/modal, not inline editing
- Detail panel same as Phase 2 (video list, source playlists, confidence info) with management actions layered on top
- 'New Category' button in the category list toolbar only — single entry point for creation
- No visual distinction between consolidated (Phase 2) and manually created categories — all equal once approved

### Merge workflow
- Multi-select categories via checkboxes, then hit 'Merge' button in toolbar
- Always prompt user to type/confirm the merged category name
- Auto-deduplicate shared videos silently — no notification about removed duplicates
- Show confirmation preview dialog before executing: "Merge X, Y, Z into [name] — 142 videos total" with confirm/cancel

### Video assignment
- Two ways to find videos: text search by title/channel AND browse by source category
- Move vs copy: ask the user each time whether to move (remove from source) or copy (keep in both)
- Batch selection supported: checkboxes on each video, select multiple, assign all at once
- Assignment interface is a full-screen dialog — modal that takes over for focused video selection

### Delete & safety guardrails
- Allow deleting non-empty categories with explicit confirmation
- When deleting a non-empty category: videos are removed from this category; if they exist in other categories they remain there; truly orphaned ones go to Uncategorized
- Undo capability within session — keep an undo stack for recent deletes and merges
- Confirmation dialogs for all destructive operations (delete, merge)

### Claude's Discretion
- Maximum video count enforcement approach (hard block vs warning at YouTube 5,000 limit, given Phase 2 validation already exists)
- Exact undo stack implementation (in-memory vs persisted)
- Loading states and error handling patterns
- How the full-screen video assignment dialog is laid out internally

</decisions>

<specifics>
## Specific Ideas

- Extend existing split-panel analysis dashboard rather than building new views — leverage Phase 2's CategoryList, CategoryDetail, batch toolbar, and keyboard navigation
- "Uncategorized" bucket for truly orphaned videos when a category is deleted
- Phase 2 already has CreateCategoryDialog in dashboard toolbar — reuse/adapt for Phase 3's category list toolbar placement

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-category-management*
*Context gathered: 2026-02-06*
