# Requirements: v1.1 Watch Later Import

## Milestone Goal

Import 3,932 Watch Later videos from Google Takeout CSV into the database so they can be categorised by the existing ML pipeline.

## Background

YouTube's API does not return Watch Later via `playlists.list({ mine: true })` and `playlistItems.list({ playlistId: 'WL' })` returns empty/404 since ~2016. The only viable data source is Google Takeout, which exports a CSV with video IDs and timestamps.

## Requirements

### WL-01: CSV File Upload
**Priority:** Must-have
**Description:** User can upload a Google Takeout Watch Later CSV file through the web UI.
**Acceptance criteria:**
- Upload button on a dedicated Watch Later import page
- Accepts CSV files matching Google Takeout format: `Video ID,Playlist Video Creation Timestamp`
- Validates CSV structure before processing (correct headers, non-empty)
- Shows file name and video count after parsing
- Rejects invalid files with clear error message

### WL-02: CSV Parsing
**Priority:** Must-have
**Description:** System parses the uploaded CSV and extracts video IDs and timestamps.
**Acceptance criteria:**
- Extracts YouTube video IDs (11-character alphanumeric strings)
- Extracts playlist addition timestamps (ISO 8601 format)
- Skips header row
- Handles edge cases: empty lines, trailing newlines
- Reports total count of parsed video IDs

### WL-03: Watch Later Playlist Creation
**Priority:** Must-have
**Description:** System creates a Watch Later playlist entry in the `playlists` table if it doesn't already exist.
**Acceptance criteria:**
- Creates playlist with `youtubeId: 'WL'`, `title: 'Watch Later'`
- Idempotent — re-running import doesn't create duplicate playlist entries
- Uses ON CONFLICT DO NOTHING or equivalent

### WL-04: Video Metadata Enrichment
**Priority:** Must-have
**Description:** System fetches video metadata from YouTube API for all imported video IDs using `videos.list` in batches of 50.
**Acceptance criteria:**
- Calls `youtube.videos.list({ part: ['snippet', 'contentDetails'], id: batch })` for batches of up to 50 IDs
- Stores title, description, thumbnailUrl, channelTitle, duration, publishedAt, etag in `videos` table
- Uses existing `fetchVideoBatch()` pattern (ON CONFLICT DO UPDATE)
- Skips videos that already exist in DB with valid metadata (avoids redundant API calls on re-import)
- Tracks quota usage via existing `quotaUsage` table (~79 API calls = ~79 quota units)

### WL-05: Deleted/Private Video Handling
**Priority:** Must-have
**Description:** System gracefully handles videos that have been deleted or made private on YouTube.
**Acceptance criteria:**
- Videos not returned by `videos.list` are recorded with a placeholder title (e.g., "[Unavailable Video]")
- Unavailable videos are still stored in DB so the user sees them in the count
- Does not block import of remaining videos
- Reports count of unavailable videos to user

### WL-06: Playlist-Video Relationships
**Priority:** Must-have
**Description:** System creates `playlistVideos` entries linking each imported video to the Watch Later playlist.
**Acceptance criteria:**
- Creates junction records with correct `playlistId` (Watch Later) and `videoId` (from videos table)
- Preserves position ordering from CSV (first row = position 0)
- Uses `addedAt` from the CSV timestamp column
- Idempotent — re-import doesn't create duplicate relationships

### WL-07: Import Progress UI
**Priority:** Must-have
**Description:** User sees real-time progress during the import process.
**Acceptance criteria:**
- Shows current stage: parsing CSV → fetching metadata → creating relationships
- Shows progress within metadata fetch stage (e.g., "Fetching 150/3,932 videos...")
- Shows count of successful, unavailable, and skipped (already in DB) videos
- Handles errors gracefully with toast notification
- Shows completion summary when done

### WL-08: ML Pipeline Integration
**Priority:** Must-have
**Description:** Imported Watch Later videos appear in the existing ML categorisation pipeline without any changes to the ML code.
**Acceptance criteria:**
- `getDataForCategorisation()` returns Watch Later videos alongside other videos
- Videos have all required fields for ML: title, channelTitle, thumbnailUrl
- User can run categorisation on imported videos using existing workflow
- No changes needed to ML categorisation actions or Web Worker

### WL-09: Re-import Support
**Priority:** Should-have
**Description:** User can re-import a newer CSV export to add newly saved Watch Later videos.
**Acceptance criteria:**
- New videos are added without duplicating existing ones
- Existing video metadata is not re-fetched from API (quota conservation)
- New videos get metadata enrichment
- Shows count of new vs already-imported videos
- Works correctly if categories have already been assigned to previous imports

---

## Requirement Dependencies

```
WL-01 (Upload) → WL-02 (Parse) → WL-03 (Playlist) ─┐
                                                       ├→ WL-06 (Relationships) → WL-08 (ML Integration)
                                  WL-04 (Metadata) ───┤
                                  WL-05 (Unavailable) ─┘
WL-07 (Progress UI) spans all stages
WL-09 (Re-import) builds on WL-01 through WL-06
```

## Constraints

- **Quota budget:** ~79 units for initial import (3,932 ÷ 50 = 79 batches at 1 unit each). Well within 10,000/day limit.
- **No API access to Watch Later playlist:** Must use Google Takeout CSV as sole data source.
- **Existing schema:** Must use existing `playlists`, `videos`, `playlistVideos` tables — no schema changes needed.
- **British English:** All user-facing text must use British English spellings.

---
*Created: 2026-02-08 for v1.1 Watch Later Import milestone*
