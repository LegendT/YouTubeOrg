---
phase: 13-watch-later-csv-import-metadata-enrichment
plan: 02
subsystem: api
tags: [youtube-api, drizzle, server-actions, batch-processing, metadata]

# Dependency graph
requires:
  - phase: 13-01
    provides: parseAndInitialiseImport server action and CSV parser
provides:
  - importMetadataBatch server action for batch YouTube API metadata enrichment
  - Unavailable video placeholder record creation
affects: [13-03, 13-04, 13-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client-driven batch loop: server action processes one batch per invocation, client increments startIndex"
    - "Unavailable video placeholders: '[Unavailable Video]' title for deleted/private videos to satisfy FK constraints"

key-files:
  created: []
  modified:
    - src/app/actions/import.ts

key-decisions:
  - "importMetadataBatch takes all video IDs + startIndex rather than pre-sliced batch, matching existing sync page polling pattern"
  - "Existing videos are skipped entirely (no API call) for quota conservation on re-import"
  - "Unavailable videos get placeholder records with onConflictDoNothing to handle race conditions"

patterns-established:
  - "Batch enrichment via client loop: server action processes 50 IDs, returns counts, client drives next batch"

# Metrics
duration: 1min
completed: 2026-02-09
---

# Phase 13 Plan 02: Batch Metadata Enrichment Summary

**importMetadataBatch server action enriching up to 50 video IDs per invocation via fetchVideoBatch, with skip-existing quota conservation and unavailable video placeholder records**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-09T10:00:28Z
- **Completed:** 2026-02-09T10:01:44Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Batch metadata enrichment server action that processes 50 video IDs per invocation
- Quota conservation: videos already in the database are skipped (no redundant API calls on re-import)
- Unavailable/deleted/private video handling: placeholder records with title '[Unavailable Video]' inserted for videos not returned by the YouTube API
- Structured return type with {processed, unavailable, skipped} counts for progress UI

## Task Commits

Each task was committed atomically:

1. **Task 1: Batch metadata enrichment server action with unavailable video handling** - `17a16ce` (feat)

## Files Created/Modified
- `src/app/actions/import.ts` - Added importMetadataBatch server action alongside existing parseAndInitialiseImport

## Decisions Made
- Function signature takes full video ID array + startIndex (client increments by batchSize each iteration), matching the polling pattern used elsewhere in the codebase
- Existing videos detected via DB query before API call, saving quota on re-import scenarios
- Placeholder records use onConflictDoNothing to handle edge case of concurrent inserts

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- importMetadataBatch is ready for Plan 13-03 (playlist-video relationship creation)
- The function returns counts that Plan 13-04 (import UI) will use for progress display
- Unavailable video placeholders ensure FK constraints will be satisfied in 13-03

---
*Phase: 13-watch-later-csv-import-metadata-enrichment*
*Completed: 2026-02-09*
