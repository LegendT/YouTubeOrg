---
phase: 08-batch-sync-operations
plan: 03
subsystem: api, ui
tags: [server-actions, sync, preview, quota, next-js, tailwind, lucide-react]

# Dependency graph
requires:
  - phase: 08-batch-sync-operations
    provides: computeSyncPreview, sync engine (createSyncJob, processSyncBatch, pauseSyncJob, resumeSyncJob, getCurrentSyncJob), SyncPreview/SyncJobRecord types
  - phase: 07-safety-archive-system
    provides: Safety nav item pattern, card-based UI conventions
  - phase: 01-foundation
    provides: auth config, getServerSession, navigation component
provides:
  - 6 server actions for complete sync lifecycle control (preview, start, resume, pause, progress, batch)
  - /sync page with auth-gated server component and client wrapper
  - SyncPreview component showing operation breakdown with quota estimates
  - Sync navigation link in app navbar
affects: [08-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server actions with structured {success, data, error} responses -- no throwing"
    - "Auth helper extracted to getAccessToken() for DRY auth checks"
    - "Server component fetches data, client component manages transitions via useTransition"

key-files:
  created:
    - src/app/actions/sync.ts
    - src/app/sync/page.tsx
    - src/app/sync/sync-page-client.tsx
    - src/components/sync/sync-preview.tsx
  modified:
    - src/components/navigation.tsx

key-decisions:
  - "Server actions return structured responses (never throw) for consistent client-side error handling"
  - "SyncPageClient manages view transitions (preview -> progress) via router.refresh after startSync"
  - "Per-category video breakdown shown in add_videos card, sorted by count descending, top 10 visible"
  - "British English throughout: Synchronise, categorised, Organiser"

patterns-established:
  - "Sync UI pattern: Server Component page -> Client wrapper with useTransition -> Presentational components"
  - "CollapsibleList: show first 5 items with 'and N more' toggle for long lists"
  - "Quota warning: amber styling when estimatedDays > 7"

# Metrics
duration: 4.1min
completed: 2026-02-07
---

# Phase 8 Plan 03: Sync Server Actions & Preview UI Summary

**6 server actions for sync lifecycle control and /sync preview page showing operation breakdown with quota cost estimates and multi-day timeline**

## Performance

- **Duration:** 4.1 min
- **Started:** 2026-02-07T22:30:59Z
- **Completed:** 2026-02-07T22:35:03Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- 6 server actions provide complete sync control API: getSyncPreview, startSync, resumeSync, pauseSync, getSyncProgress, runSyncBatch -- all with auth checks and structured responses
- SyncPreview component displays three stage cards (Create Playlists, Add Videos, Delete Old Playlists) with quota costs, per-category video breakdown, and collapsible playlist name lists
- Quota summary card shows total API units, estimated days, and daily limit with amber warning styling for multi-week syncs
- Watch Later deprecation notice informs users about manual cleanup (API deprecated since 2020)
- /sync page added to navigation bar with RefreshCw icon

## Task Commits

Each task was committed atomically:

1. **Task 1: Sync server actions** - `d0a7c5f` (feat)
2. **Task 2: Sync page and preview component** - `191edc0` (feat)

**Plan metadata:** (pending)

## Files Created/Modified
- `src/app/actions/sync.ts` - 6 server actions for sync lifecycle (preview, start, resume, pause, progress, batch)
- `src/app/sync/page.tsx` - Server component with auth check and parallel data fetching
- `src/app/sync/sync-page-client.tsx` - Client wrapper managing preview/progress view transitions
- `src/components/sync/sync-preview.tsx` - Preview component with 3 stage cards, quota summary, Watch Later notice, Start Sync button
- `src/components/navigation.tsx` - Added Sync nav item with RefreshCw icon

## Decisions Made
- Server actions return structured `{success, data, error}` responses (consistent with backup.ts pattern but adds auth gating)
- SyncPageClient uses `router.refresh()` after startSync to transition from preview to progress view without full page navigation
- Per-category video breakdown in the add_videos card sorted by count descending, top 10 visible with "and N more categories" for the rest
- Quota summary uses amber warning styling when estimated duration exceeds 7 days to set honest expectations about multi-week timeline
- Progress placeholder for active jobs shows stage label, progress bar, and pause reason -- full progress UI deferred to 08-04

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Server actions are ready for 08-04 (Progress UI and Completion Report)
- SyncPageClient already handles active job state with a progress placeholder -- 08-04 replaces it with full progress component
- runSyncBatch action ready for client-side polling implementation
- No blockers for next plan

---
*Phase: 08-batch-sync-operations*
*Completed: 2026-02-07*
