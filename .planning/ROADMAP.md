# Roadmap: YouTube Playlist Organizer

## Overview

This roadmap transforms 5,523 videos across 87 fragmented playlists into an organized, findable reference library. The journey begins with YouTube API integration and data caching, progresses through ML-powered categorization of 4,000 Watch Later videos, and culminates in safe, quota-aware syncing back to YouTube. Each phase builds foundational capabilities that enable the next, with safety mechanisms and performance optimizations integrated throughout to handle scale (4,000+ videos) and constraints (10,000 API units/day).

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & API Integration** - YouTube OAuth, data fetching, quota tracking
- [x] **Phase 2: Playlist Analysis & Consolidation** - Analyze 87 playlists, propose ~25-35 categories
- [x] **Phase 3: Category Management** - CRUD operations for category structure
- [x] **Phase 4: Video Display & Organization** - Virtualized UI for browsing/searching videos
- [x] **Phase 5: ML Categorization Engine** - Auto-categorize Watch Later with Transformers.js
- [ ] **Phase 6: Review & Approval Interface** - Batch review ML suggestions with keyboard shortcuts
- [ ] **Phase 7: Safety & Archive System** - Backup mechanism before destructive operations
- [ ] **Phase 8: Batch Sync Operations** - Quota-aware sync to YouTube with checkpoint/resume

## Phase Details

### Phase 1: Foundation & API Integration
**Goal**: Application can authenticate with YouTube, fetch all playlists and videos, cache data locally, and track API quota usage without exhausting daily limits.

**Depends on**: Nothing (first phase)

**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, UI-01

**Success Criteria** (what must be TRUE):
  1. User can authenticate with YouTube OAuth 2.0 and see confirmation
  2. User sees dashboard displaying 87 playlists with video counts and Watch Later count (4,000)
  3. System displays remaining API quota on dashboard (e.g., "8,245 / 10,000 units remaining today")
  4. User can view cached playlist data without triggering new API calls
  5. System maintains valid session across multi-hour operations without re-authentication

**Plans**: 5 plans

Plans:
- [x] 01-01-PLAN.md — Next.js 15 setup, dependencies, and database schema
- [x] 01-02-PLAN.md — NextAuth OAuth with token refresh
- [x] 01-03-PLAN.md — Rate limiter, ETag caching, and quota tracking
- [x] 01-04-PLAN.md — Playlist/video sync with resume capability
- [x] 01-05-PLAN.md — Dashboard UI with authentication flow

---

### Phase 2: Playlist Analysis & Consolidation
**Goal**: System analyzes existing 87 playlists for overlap and duplication, proposes intelligent consolidation to ~25-35 categories, and user can approve or adjust the structure via a comprehensive split-panel analysis interface with keyboard navigation, batch operations, and guided split wizard.

**Depends on**: Phase 1 (requires cached playlist data)

**Requirements**: CAT-05, CAT-06, CAT-07, CAT-08, CAT-09, SAFE-04

**Success Criteria** (what must be TRUE):
  1. User sees proposed category consolidation structure showing merged playlists (e.g., "JavaScript Tutorials + JS Advanced -> JavaScript")
  2. User sees overlap analysis showing how many duplicate videos exist across playlists
  3. User can approve proposed consolidations with single action
  4. User can manually adjust consolidation proposal by merging different playlists
  5. System validates proposed structure has no category exceeding 4,500 videos (YouTube limit safety margin)

**Plans**: 11 plans

Plans:
- [x] 02-01-PLAN.md — Analysis backend (duplicate detection, clustering, validation)
- [x] 02-02-PLAN.md — Server actions for proposal workflow
- [x] 02-03-PLAN.md — Basic consolidation UI with approve/reject
- [x] 02-05-PLAN.md — Backend fixes: fast-dice-coefficient, group(k), confidence scores, algorithm modes, sessions
- [x] 02-06-PLAN.md — Enhanced server actions: split, create, resolve duplicates, batch, staleness
- [x] 02-07-PLAN.md — Resizable split-panel layout, summary card, sortable category list
- [x] 02-08-PLAN.md — Category detail panel with paginated video list, confidence/validation badges
- [x] 02-09-PLAN.md — Duplicate resolver with bulk actions, batch approve/reject toolbar
- [x] 02-10-PLAN.md — Split wizard, manual adjustment buttons, create custom category
- [x] 02-11-PLAN.md — Progress tracking, keyboard navigation, loading states, staleness detection
- [x] 02-12-PLAN.md — Final review screen, full integration, end-to-end verification

---

### Phase 3: Category Management
**Goal**: User has full CRUD control over category structure with ability to create, rename, delete, and manually merge categories.

**Depends on**: Phase 2 (requires approved category structure)

**Requirements**: CAT-01, CAT-02, CAT-03, CAT-04, CAT-10

**Success Criteria** (what must be TRUE):
  1. User can view all categories with video counts
  2. User can create new category and assign videos to it
  3. User can rename existing category
  4. User can delete empty category
  5. User can manually merge two categories and see combined video count

**Plans**: 6 plans

Plans:
- [x] 03-01-PLAN.md — Schema (categories + categoryVideos tables), types, and proposal-to-category migration
- [x] 03-02-PLAN.md — CRUD server actions (list, create, rename, delete, merge, undo, video search/assign)
- [x] 03-03-PLAN.md — Undo stack hook, undo banner, rename dialog, delete dialog
- [x] 03-04-PLAN.md — Merge categories dialog, full-screen video assignment dialog
- [x] 03-05-PLAN.md — Dashboard integration: management mode, category list/detail extensions, wiring
- [x] 03-06-PLAN.md — Final polish, new-category button, end-to-end verification

---

### Phase 4: Video Display & Organization
**Goal**: User can browse, search, filter, and manually organize videos across categories with performant UI handling 4,000+ items without freezing.

**Depends on**: Phase 3 (requires category structure)

**Requirements**: VID-01, VID-02, VID-03, VID-04, VID-05, VID-06, VID-07, UI-02, UI-03, UI-05, UI-06

**Success Criteria** (what must be TRUE):
  1. User can view videos with thumbnails, titles, channel names, and duration
  2. User can scroll through 4,000+ video list smoothly without UI freeze (virtualized rendering)
  3. User can search videos by title or channel name and see results instantly
  4. User can filter videos by category and see only that subset
  5. User can manually move videos between categories via drag-drop or select-and-move
  6. User can select multiple videos for batch operations
  7. User can preview video by clicking through to YouTube

**Plans**: 5 plans

Plans:
- [x] 04-01-PLAN.md — Dependencies, types, and shared utilities (format, colours, thumbnails)
- [x] 04-02-PLAN.md — Server actions (getVideosForCategory) and category sidebar
- [x] 04-03-PLAN.md — Video card, virtualised grid, and toolbar (search/sort/select)
- [x] 04-04-PLAN.md — Page orchestration, move/copy dialog, undo wiring
- [x] 04-05-PLAN.md — End-to-end verification and polish

---

### Phase 5: ML Categorization Engine
**Goal**: System auto-categorizes Watch Later videos using client-side ML (Transformers.js), assigns confidence scores, caches embeddings, and processes in batches for performance.

**Depends on**: Phase 3 (requires target category structure)

**Requirements**: ML-01, ML-02, ML-03, ML-04

**Success Criteria** (what must be TRUE):
  1. User triggers ML categorization and sees progress indicator ("Processing video 247/4000, 6%")
  2. System assigns categories to Watch Later videos with confidence scores (HIGH/MEDIUM/LOW)
  3. System completes categorization of 4,000 videos without browser crash or freeze (Web Worker execution)
  4. User can re-run categorization on newly added Watch Later videos without reprocessing entire library (cached embeddings)

**Plans**: 4 plans

Plans:
- [x] 05-01-PLAN.md — ML foundation (IndexedDB cache, Web Worker, cosine similarity)
- [x] 05-02-PLAN.md — Database schema and batch categorization engine
- [x] 05-03-PLAN.md — Server actions and UI components (trigger + progress)
- [x] 05-04-PLAN.md — Integration, navigation, and end-to-end verification

---

### Phase 6: Review & Approval Interface
**Goal**: User can efficiently review ML categorization suggestions, accept/reject with keyboard shortcuts, manually recategorize, and focus on low-confidence items.

**Depends on**: Phase 5 (requires ML categorizations)

**Requirements**: ML-05, ML-06, ML-07, ML-08, UI-07, UI-08, UI-09

**Success Criteria** (what must be TRUE):
  1. User sees ML-suggested category for each video with confidence indicator
  2. User can accept ML suggestion with single click or keyboard shortcut (a key)
  3. User can reject suggestion and manually select different category (r key)
  4. System highlights low-confidence categorizations for manual review
  5. User can navigate review interface with keyboard (arrow keys, enter) without mouse
  6. User sees visual feedback for all actions (loading states, success confirmations)

**Plans**: 5 plans

Plans:
- [ ] 06-01-PLAN.md — Server actions for review workflow (accept/reject/recategorize)
- [ ] 06-02-PLAN.md — Review grid with confidence badges and progress display
- [ ] 06-03-PLAN.md — Review modal with keyboard shortcuts and auto-advance
- [ ] 06-04-PLAN.md — Basic page orchestration with grid/modal integration and Tab/Enter navigation
- [ ] 06-05-PLAN.md — Optimistic updates, accept/reject handlers, filters, category picker, and navbar link

---

### Phase 7: Safety & Archive System
**Goal**: System automatically archives playlist metadata before any destructive operation, supports undo/restore, and maintains immutable operation log.

**Depends on**: Phase 6 (setup before sync operations)

**Requirements**: SAFE-01, SAFE-02, SAFE-03, SAFE-05, SAFE-06

**Success Criteria** (what must be TRUE):
  1. System exports current playlist structure to JSON backup automatically before any delete operation
  2. User sees archive confirmation with timestamp and file location
  3. User can restore playlists from archive if needed
  4. System maintains immutable log showing all destructive operations (timestamp, playlist ID, action)
  5. User can undo pending changes before syncing to YouTube

**Plans**: TBD

Plans:
- TBD (pending phase planning)

---

### Phase 8: Batch Sync Operations
**Goal**: System syncs approved categorizations to YouTube with quota-aware batching, checkpoint/resume capability, multi-day strategy, and graceful failure handling.

**Depends on**: Phase 7 (requires safety mechanisms)

**Requirements**: SYNC-01, SYNC-02, SYNC-03, SYNC-04, SYNC-05, SYNC-06, SYNC-07, SYNC-08, SYNC-09, SYNC-10, SYNC-11, SYNC-12, UI-04

**Success Criteria** (what must be TRUE):
  1. User sees preview of changes before syncing to YouTube (playlists to create, videos to move, playlists to delete)
  2. User can initiate sync and see real-time progress ("Creating playlist 3/25, adding videos 47/500")
  3. System pauses sync when approaching quota limit (9,000 units used) and schedules resume for next day
  4. System resumes sync from last checkpoint after failure or quota exhaustion
  5. System successfully creates new playlists on YouTube with approved category structure
  6. System handles API errors gracefully with retry logic (exponential backoff)
  7. User sees completion confirmation showing success/failure counts

**Plans**: TBD

Plans:
- TBD (pending phase planning)

---

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & API Integration | 5/5 | Complete | 2026-02-05 |
| 2. Playlist Analysis & Consolidation | 11/11 | Complete | 2026-02-06 |
| 3. Category Management | 6/6 | Complete | 2026-02-06 |
| 4. Video Display & Organization | 5/5 | Complete | 2026-02-06 |
| 5. ML Categorization Engine | 4/4 | Complete | 2026-02-07 |
| 6. Review & Approval Interface | 0/5 | Not started | - |
| 7. Safety & Archive System | 0/TBD | Not started | - |
| 8. Batch Sync Operations | 0/TBD | Not started | - |

---
*Roadmap created: 2026-02-05*
*Last updated: 2026-02-07 (Phase 6 revised: Split plan 04 into 04+05 for better context management)*
