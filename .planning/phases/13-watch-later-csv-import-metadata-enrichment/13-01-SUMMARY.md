---
phase: 13-watch-later-csv-import-metadata-enrichment
plan: 01
subsystem: import
tags: [csv, google-takeout, drizzle, upsert, server-action, watch-later]

# Dependency graph
requires:
  - phase: 01-data-foundation
    provides: playlists table schema with youtubeId unique constraint
provides:
  - parseWatchLaterCSV function for Google Takeout CSV parsing
  - ensureWatchLaterPlaylist upsert for idempotent playlist creation
  - parseAndInitialiseImport server action orchestrating parse + playlist creation
affects:
  - 13-02 (batch metadata enrichment uses parsed rows and playlistDbId)
  - 13-03 (import UI calls parseAndInitialiseImport server action)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Discriminated union return type for CSV parsing (CSVParseResult)"
    - "Upsert with onConflictDoUpdate for idempotent re-imports"
    - "Server action never-throw pattern with structured error responses"

key-files:
  created:
    - src/lib/import/csv-parser.ts
    - src/lib/import/watch-later.ts
    - src/app/actions/import.ts
  modified: []

key-decisions:
  - "CSV parser silently skips invalid video IDs rather than erroring, enabling partial imports"
  - "ensureWatchLaterPlaylist uses onConflictDoUpdate (not DoNothing) to update itemCount on re-import"
  - "Server action receives CSV text string, not File object -- client reads file via FileReader"

patterns-established:
  - "Import module structure: src/lib/import/ for business logic, src/app/actions/import.ts for server actions"

# Metrics
duration: 3min
completed: 2026-02-09
---

# Phase 13 Plan 01: CSV Parser & Watch Later Playlist Helper Summary

**Google Takeout CSV parser with discriminated union result types and idempotent Watch Later playlist upsert via Drizzle onConflictDoUpdate**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-09T09:55:53Z
- **Completed:** 2026-02-09T09:58:21Z
- **Tasks:** 2
- **Files created:** 3

## Accomplishments

- CSV parser correctly extracts video IDs and timestamps from Google Takeout Watch Later format with full edge-case handling (empty files, wrong headers, trailing newlines, invalid IDs)
- Watch Later playlist upsert is idempotent -- re-import updates itemCount, never creates duplicates
- Server action orchestrates parsing + playlist creation and returns structured data for downstream batch processing, following the established never-throw pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: CSV parser and Watch Later playlist helper** - `9d4bb25` (feat)
2. **Task 2: Server action to parse CSV and initialise import** - `8f5d941` (feat)

## Files Created/Modified

- `src/lib/import/csv-parser.ts` - Pure CSV parser: parseWatchLaterCSV with ParsedCSVRow and CSVParseResult types
- `src/lib/import/watch-later.ts` - ensureWatchLaterPlaylist: upserts WL playlist entry and returns DB ID
- `src/app/actions/import.ts` - parseAndInitialiseImport server action: auth check, CSV parse, playlist upsert, returns rows + playlistDbId

## Decisions Made

- CSV parser silently skips rows with invalid video IDs (regex `/^[\w-]{11}$/`) rather than returning an error, enabling partial imports from slightly malformed exports
- Used `onConflictDoUpdate` (not `DoNothing`) on playlists.youtubeId so that re-imports update the item count to reflect the current CSV
- Server action receives pre-read CSV text string rather than a File object, matching the research recommendation for client-side parsing with instant validation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CSV parser and playlist helper are ready for use by the import UI (Plan 02+)
- parseAndInitialiseImport returns ParsedCSVRow[] and playlistDbId, which are the inputs needed for batch metadata enrichment
- No blockers for downstream plans

---
*Phase: 13-watch-later-csv-import-metadata-enrichment*
*Completed: 2026-02-09*
