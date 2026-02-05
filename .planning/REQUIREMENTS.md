# Requirements: YouTube Playlist Organizer

**Defined:** 2026-02-05
**Core Value:** Videos must be findable when needed.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication & API Integration

- [ ] **AUTH-01**: User can authenticate with YouTube via OAuth 2.0
- [ ] **AUTH-02**: System maintains valid OAuth tokens throughout long operations
- [ ] **AUTH-03**: System refreshes access tokens proactively before expiration
- [ ] **AUTH-04**: User can re-authenticate if tokens are revoked

### Data Management & Caching

- [ ] **DATA-01**: System fetches all existing playlists from YouTube (87 playlists)
- [ ] **DATA-02**: System fetches Watch Later playlist contents (4,000 videos)
- [ ] **DATA-03**: System retrieves video metadata (title, thumbnail, description, channel, duration)
- [ ] **DATA-04**: System caches YouTube data locally with ETag-based conditional requests
- [ ] **DATA-05**: System tracks API quota usage (displays remaining daily quota)
- [ ] **DATA-06**: System handles YouTube API rate limits gracefully (exponential backoff)

### Category Management

- [ ] **CAT-01**: User can view all existing playlist categories with video counts
- [ ] **CAT-02**: User can create new categories
- [ ] **CAT-03**: User can rename existing categories
- [ ] **CAT-04**: User can delete categories
- [ ] **CAT-05**: System analyzes 87 playlists and proposes consolidation to ~25-35 categories
- [ ] **CAT-06**: System shows overlap analysis (duplicate videos across playlists)
- [ ] **CAT-07**: User can approve proposed category consolidations
- [ ] **CAT-08**: User can reject proposed consolidations
- [ ] **CAT-09**: User can manually adjust proposed consolidations (merge different playlists)
- [ ] **CAT-10**: User can manually merge two categories

### Video Organization

- [ ] **VID-01**: User can view videos with thumbnails, titles, and metadata
- [ ] **VID-02**: User can manually move videos between categories
- [ ] **VID-03**: User can select multiple videos for batch operations
- [ ] **VID-04**: User can search videos by title or channel name
- [ ] **VID-05**: User can filter videos by category
- [ ] **VID-06**: User can preview video by clicking through to YouTube
- [ ] **VID-07**: User can view video description and additional metadata

### ML Categorization

- [ ] **ML-01**: System auto-categorizes Watch Later videos using ML (Transformers.js)
- [ ] **ML-02**: System assigns confidence scores to ML categorizations (HIGH/MEDIUM/LOW)
- [ ] **ML-03**: System processes videos in batches for performance (32 videos at a time)
- [ ] **ML-04**: System caches video embeddings to avoid recomputation
- [ ] **ML-05**: User can review ML-suggested categories before accepting
- [ ] **ML-06**: System highlights low-confidence categorizations for manual review
- [ ] **ML-07**: User can accept ML suggestion with single click
- [ ] **ML-08**: User can reject ML suggestion and manually categorize

### Safety & Archives

- [ ] **SAFE-01**: System exports playlist metadata to JSON backup
- [ ] **SAFE-02**: System automatically archives playlists before any delete operation
- [ ] **SAFE-03**: User can restore playlists from archive
- [ ] **SAFE-04**: System detects duplicate videos across playlists
- [ ] **SAFE-05**: System maintains immutable operation log (timestamps, playlist IDs, actions)
- [ ] **SAFE-06**: User can undo changes before syncing to YouTube

### YouTube Sync

- [ ] **SYNC-01**: User can preview changes before syncing to YouTube
- [ ] **SYNC-02**: System creates new playlists on YouTube with approved structure
- [ ] **SYNC-03**: System adds videos to playlists in batches
- [ ] **SYNC-04**: System removes videos from old playlists
- [ ] **SYNC-05**: System deletes old playlists after archiving
- [ ] **SYNC-06**: System implements multi-day sync strategy (quota-aware scheduling)
- [ ] **SYNC-07**: System tracks sync progress with checkpoint/resume capability
- [ ] **SYNC-08**: System journals all operations before execution (pending/complete/failed states)
- [ ] **SYNC-09**: System resumes sync from last checkpoint after failure
- [ ] **SYNC-10**: System displays real-time progress (videos processed, percentage complete)
- [ ] **SYNC-11**: System handles quota exhaustion gracefully (pauses until next day)
- [ ] **SYNC-12**: System retries failed operations with exponential backoff

### User Interface & Performance

- [ ] **UI-01**: User sees dashboard with Watch Later count and categorization progress
- [ ] **UI-02**: User can navigate category management interface
- [ ] **UI-03**: User can navigate review interface (category-by-category view)
- [ ] **UI-04**: User can navigate sync progress view
- [ ] **UI-05**: System renders 4,000+ video list without UI freeze (react-window virtualization)
- [ ] **UI-06**: System lazy-loads thumbnails as user scrolls
- [ ] **UI-07**: User can navigate review interface with keyboard shortcuts (arrow keys, enter)
- [ ] **UI-08**: User can accept/reject suggestions with keyboard (a/r keys)
- [ ] **UI-09**: System provides visual feedback for all actions (loading states, success/error)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Learning System

- **LEARN-01**: System tracks user corrections (predicted category vs actual category)
- **LEARN-02**: System improves ML accuracy from user feedback
- **LEARN-03**: System runs incremental categorization on new Watch Later additions only
- **LEARN-04**: System reuses approved category structure from previous runs

### Enhanced Safety

- **SAFE-07**: System implements soft delete with 7-day grace period
- **SAFE-08**: System requires two-factor confirmation for playlist deletion (type name)

### Enhanced UI

- **UI-10**: System displays real-time quota meter showing remaining daily units
- **UI-11**: User can customize keyboard shortcuts
- **UI-12**: System provides undo/redo for review actions

### Advanced Features

- **ADV-01**: System detects visually similar videos (beyond duplicate detection)
- **ADV-02**: User can organize playlists into nested folders client-side
- **ADV-03**: User can filter by watched status
- **ADV-04**: System shows category growth analytics over time

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Real-time sync | Exhausts API quota; batch operations required for 10,000 units/day limit |
| Video analytics/watch time tracking | Scope creep into different domain; focus is organization, not analytics |
| Multi-user collaboration | Authentication complexity; single-user tool simpler with better UX |
| Automated playlist creation without review | Low user trust; hybrid approach (AI suggests, user approves) required |
| Video downloading | Legal/ToS concerns; YouTube content stays on YouTube |
| AI-generated summaries | Adds complexity and rate limits; title/description sufficient for categorization |
| Cross-platform sync (non-YouTube) | YouTube is source of truth; no other platforms needed |
| Native mobile app | Web-first; desktop workflow is primary use case |
| Social features (sharing, collaboration) | Personal tool; no social component needed |
| Video editing/trimming | Out of domain; use YouTube Studio for editing |
| Scheduled/automated categorization | Explicit user-initiated runs better for trust and control |
| Playlist recommendations | Focus on organization, not discovery |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TBD | TBD | Pending |

**Coverage:**
- v1 requirements: 51 total
- Mapped to phases: 0
- Unmapped: 51 ⚠️

---
*Requirements defined: 2026-02-05*
*Last updated: 2026-02-05 after initial definition*
