# Roadmap: v1.1 Watch Later Import

## Milestone Goal

Import 3,932 Watch Later videos from Google Takeout CSV into the database so they can be categorised by the existing ML pipeline.

## Phase Overview

| Phase | Name | Plans | Requirements | Status |
|-------|------|-------|-------------|--------|
| 13 | Watch Later CSV Import & Metadata Enrichment | 5 plans | WL-01 through WL-09 | Complete |

## Phase 13: Watch Later CSV Import & Metadata Enrichment

**Goal:** Build a complete Watch Later import flow — from CSV upload through metadata enrichment to ML pipeline readiness.

**Plans:** 5 plans

**Success criteria:**
- User can upload a Google Takeout CSV and see imported videos in the categorisation pipeline
- 3,932 Watch Later videos have metadata (title, channel, thumbnail, duration)
- Re-import adds only new videos without duplicating existing ones
- Unavailable/deleted videos are handled gracefully

Plans:
- [x] 13-01-PLAN.md — CSV parsing utility and Watch Later playlist creation
- [x] 13-02-PLAN.md — Video metadata batch enrichment via YouTube API
- [x] 13-03-PLAN.md — Playlist-video relationship creation with re-import deduplication
- [x] 13-04-PLAN.md — Import page UI with file upload and progress tracking
- [x] 13-05-PLAN.md — ML pipeline integration verification

### Plan Breakdown

| Plan | Name | Requirements | Dependencies | Wave |
|------|------|-------------|-------------|------|
| 13-01 | CSV parsing and Watch Later playlist creation | WL-02, WL-03 | None | 1 |
| 13-02 | Video metadata batch enrichment via YouTube API | WL-04, WL-05 | 13-01 | 2 |
| 13-03 | Playlist-video relationship creation and re-import logic | WL-06, WL-09 | 13-01, 13-02 | 3 |
| 13-04 | Import page UI with file upload and progress tracking | WL-01, WL-07 | 13-01, 13-02, 13-03 | 4 |
| 13-05 | ML pipeline integration verification | WL-08 | 13-02, 13-03 | 5 |

### Plan Details

#### 13-01: CSV parsing and Watch Later playlist creation
- CSV parser utility (parseWatchLaterCSV) with validation and edge case handling
- Watch Later playlist upsert (ensureWatchLaterPlaylist) with ON CONFLICT DO UPDATE
- Server action (parseAndInitialiseImport) orchestrating parse + playlist creation
- **Requirements:** WL-02, WL-03

#### 13-02: Video metadata batch enrichment via YouTube API
- Server action (importMetadataBatch) processes one batch of 50 per invocation
- Reuses existing fetchVideoBatch() — no hand-rolled API calls
- Skips videos already in DB with valid metadata (quota conservation for re-import)
- Inserts placeholder records for unavailable/deleted videos (title: '[Unavailable Video]')
- **Requirements:** WL-04, WL-05

#### 13-03: Playlist-video relationship creation and re-import logic
- Server action (createPlaylistRelationships) creates playlistVideos junction records
- Application-level deduplication (table has NO unique constraint on playlist_id + video_id)
- Preserves CSV ordering as position, uses CSV timestamps as addedAt
- Batch inserts in chunks of 500
- **Requirements:** WL-06, WL-09

#### 13-04: Import page UI with file upload and progress tracking
- New page at /import with server/client component split
- CSVUpload component with client-side FileReader parsing and instant validation
- ImportProgress component with three-stage pipeline and batch-level progress
- ImportSummary component with detailed completion stats
- Navigation bar updated with Import link (FileCsv icon)
- **Requirements:** WL-01, WL-07

#### 13-05: ML pipeline integration verification
- Verify getDataForCategorisation() includes Watch Later videos (no playlist filter)
- Confirm all required ML fields present (title, channelTitle, thumbnailUrl)
- Document unavailable video behaviour (LOW confidence -> manual review)
- No ML code changes expected
- **Requirements:** WL-08

### Execution Strategy

Plans 13-01 through 13-03 are the backend foundation (server actions). Plan 13-04 is the UI layer. Plan 13-05 is verification.

**Wave 1:** 13-01 (CSV parsing + playlist creation) — no dependencies
**Wave 2:** 13-02 (metadata enrichment) — depends on 13-01
**Wave 3:** 13-03 (relationships + re-import) — depends on 13-01, 13-02
**Wave 4:** 13-04 (UI) — depends on all backend plans
**Wave 5:** 13-05 (ML verification) — depends on 13-02, 13-03

---

## Requirement Coverage Matrix

| Requirement | Plan(s) | Status |
|-------------|---------|--------|
| WL-01: CSV File Upload | 13-04 | Complete |
| WL-02: CSV Parsing | 13-01 | Complete |
| WL-03: Watch Later Playlist Creation | 13-01 | Complete |
| WL-04: Video Metadata Enrichment | 13-02 | Complete |
| WL-05: Deleted/Private Video Handling | 13-02 | Complete |
| WL-06: Playlist-Video Relationships | 13-03 | Complete |
| WL-07: Import Progress UI | 13-04 | Complete |
| WL-08: ML Pipeline Integration | 13-05 | Complete |
| WL-09: Re-import Support | 13-03 | Complete |

All 9 requirements covered. No gaps.

---
*Created: 2026-02-08 for v1.1 Watch Later Import milestone*
*Plans created: 2026-02-09 by /gsd:plan-phase*
