# Roadmap: v1.1 Watch Later Import

## Milestone Goal

Import 3,932 Watch Later videos from Google Takeout CSV into the database so they can be categorised by the existing ML pipeline.

## Phase Overview

| Phase | Name | Plans | Requirements | Status |
|-------|------|-------|-------------|--------|
| 13 | Watch Later CSV Import & Metadata Enrichment | 13-01 through 13-05 | WL-01 through WL-09 | Not started |

## Phase 13: Watch Later CSV Import & Metadata Enrichment

**Goal:** Build a complete Watch Later import flow — from CSV upload through metadata enrichment to ML pipeline readiness.

**Success criteria:**
- User can upload a Google Takeout CSV and see imported videos in the categorisation pipeline
- 3,932 Watch Later videos have metadata (title, channel, thumbnail, duration)
- Re-import adds only new videos without duplicating existing ones
- Unavailable/deleted videos are handled gracefully

### Plan Breakdown

| Plan | Name | Requirements | Dependencies |
|------|------|-------------|-------------|
| 13-01 | Server-side CSV parsing and Watch Later playlist creation | WL-02, WL-03 | None |
| 13-02 | Video metadata batch enrichment via YouTube API | WL-04, WL-05 | 13-01 |
| 13-03 | Playlist-video relationship creation and re-import logic | WL-06, WL-09 | 13-01, 13-02 |
| 13-04 | Import page UI with file upload and progress tracking | WL-01, WL-07 | 13-01, 13-02, 13-03 |
| 13-05 | ML pipeline integration verification | WL-08 | 13-02, 13-03 |

### Plan Details

#### 13-01: Server-side CSV parsing and Watch Later playlist creation
- Server action to accept CSV content, validate headers, extract video IDs and timestamps
- Create/upsert Watch Later playlist in `playlists` table (`youtubeId: 'WL'`)
- Return parsed video IDs with timestamps for downstream processing
- **Requirements:** WL-02, WL-03

#### 13-02: Video metadata batch enrichment via YouTube API
- Batch video IDs into groups of 50, call `youtube.videos.list()` for each batch
- Upsert video records in `videos` table using existing `fetchVideoBatch()` pattern
- Handle unavailable/deleted videos: store with placeholder metadata
- Skip videos already in DB (quota conservation for re-import)
- Track quota usage via `quotaUsage` table
- **Requirements:** WL-04, WL-05

#### 13-03: Playlist-video relationship creation and re-import logic
- Create `playlistVideos` entries linking videos to Watch Later playlist
- Preserve CSV ordering as position, use CSV timestamps as `addedAt`
- Idempotent: ON CONFLICT DO NOTHING for re-import scenarios
- Return counts: new, existing, unavailable
- **Requirements:** WL-06, WL-09

#### 13-04: Import page UI with file upload and progress tracking
- New page at `/import` (or `/watch-later-import`) with file upload component
- CSV validation feedback (file name, video count, error messages)
- Real-time progress: parsing → fetching metadata (X/Y) → creating relationships
- Completion summary: imported, skipped, unavailable counts
- Toast notifications for errors
- Follows existing design system: dark mode, Phosphor Icons, accessible
- **Requirements:** WL-01, WL-07

#### 13-05: ML pipeline integration verification
- Verify `getDataForCategorisation()` includes Watch Later videos
- Confirm all required fields present (title, channelTitle, thumbnailUrl)
- Test categorisation workflow end-to-end with imported videos
- No ML code changes expected — this plan validates the integration
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
| WL-01: CSV File Upload | 13-04 | Not started |
| WL-02: CSV Parsing | 13-01 | Not started |
| WL-03: Watch Later Playlist Creation | 13-01 | Not started |
| WL-04: Video Metadata Enrichment | 13-02 | Not started |
| WL-05: Deleted/Private Video Handling | 13-02 | Not started |
| WL-06: Playlist-Video Relationships | 13-03 | Not started |
| WL-07: Import Progress UI | 13-04 | Not started |
| WL-08: ML Pipeline Integration | 13-05 | Not started |
| WL-09: Re-import Support | 13-03 | Not started |

All 9 requirements covered. No gaps.

---
*Created: 2026-02-08 for v1.1 Watch Later Import milestone*
