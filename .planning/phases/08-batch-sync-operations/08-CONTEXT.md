# Phase 8: Batch Sync Operations - Context

**Gathered:** 2026-02-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Sync approved local category structure to YouTube with quota-aware batching, checkpoint/resume across multiple days, and graceful failure handling. This includes: creating new YouTube playlists from categories, adding videos to them, removing synced videos from Watch Later, and deleting the original 87 playlists. Does NOT include re-syncing after initial completion or ongoing sync scheduling.

</domain>

<decisions>
## Implementation Decisions

### Sync scope & operations
- **Create new playlists** from approved categories on YouTube
- **Delete old playlists** — the original 87 playlists are removed after new structure is in place
- **Remove from Watch Later** — videos are removed from Watch Later after being added to their category playlists
- **Multi-category videos** go into all relevant playlists (duplicates across playlists are acceptable)
- **All-or-nothing sync** — no selective category syncing; one operation covers the full scope
- **Operation order**: Claude's discretion (safest order — likely: create playlists → add videos → remove from WL → delete old)

### Progress & multi-day UX
- **High-level stage progress** — shows current stage and counts (e.g., "Creating playlists 3/25"), not individual operation log
- **Status on page** — no external notifications; user visits the app to check sync status ("Paused — quota resets in 14h")
- **Manual resume** — user clicks "Resume sync" button when ready; no auto-resume
- **Page placement**: Claude's discretion (dedicated /sync page or dashboard section)

### Change preview
- **Quota estimate shown** — preview displays estimated API units needed and approximate days ("~15,000 units, ~2 days")
- **Grouping**: Claude's discretion (by operation type or by category — whichever is clearest)
- **Standard confirmation button** — "Start sync" button alongside the preview; no type-to-confirm friction
- **All-or-nothing** — no category-level checkboxes in preview

### Failure & conflict handling
- **Batch failures at end of stage** — don't pause per video; collect all failures during a stage, then present them together for user decision (skip all / abort)
- **Stage-level resume** — on quota exhaustion or failure, resume from the stage level (may retry already-completed items idempotently), not granular per-video checkpoint
- **Detailed completion report** — persistent summary page showing every operation: successes, failures, skipped items; not just a toast

### Claude's Discretion
- Sync operation order (safest sequence)
- Page placement (dedicated page vs dashboard section)
- Change preview grouping (by operation type vs by category)
- Retry strategy and exponential backoff parameters
- Quota threshold for pausing (e.g., 9,000 of 10,000 units)
- Idempotency approach for stage-level resume

</decisions>

<specifics>
## Specific Ideas

No specific references — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 08-batch-sync-operations*
*Context gathered: 2026-02-07*
