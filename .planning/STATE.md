# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-05)

**Core value:** Videos must be findable when needed. If you can't locate a video when you need it, the collection is worthless.

**Current focus:** Phase 5 - ML Categorization Engine

## Current Position

Phase: 5 of 8 (ML Categorization Engine)
Plan: 4 of 4
Status: Phase complete
Last activity: 2026-02-07 — Completed 05-04-PLAN.md

Progress: [█████████████████████████████████] 31/31 plans (100%)

## Performance Metrics

**Velocity:**
- Total plans completed: 31
- Average duration: 3.7 min
- Total execution time: 2.04 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 - Foundation & API Integration | 5/5 | 23.5 min | 4.7 min |
| 2 - Playlist Analysis & Consolidation | 11/11 | 45 min | 4.1 min |
| 3 - Category Management | 6/6 | 24 min | 4.0 min |
| 4 - Video Display & Organization | 5/5 | 15.5 min | 3.1 min |
| 5 - ML Categorization Engine | 4/4 | 18.3 min | 4.58 min |

**Recent Trend:**
- Last 5 plans: 04-05 (2min), 05-01 (5min), 05-02 (4.5min), 05-03 (4.8min), 05-04 (4min)
- Trend: Phase 5 complete with consistent 4-5 min velocity per plan

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- AI-first categorization: 4,000 videos makes manual categorization impractical
- Consolidate categories before Watch Later: Cleaner target structure improves ML accuracy
- System proposes consolidation, user approves: Balance automation with user control
- Web app deployment: Simpler maintenance vs desktop application
- YouTube as source of truth: Tool assists reorganization, YouTube is primary interface
- Preview capability during review: User needs to watch snippets to remember old videos

**From 01-01 execution (2026-02-05):**
- Use serial() for primary keys instead of generatedAlwaysAsIdentity() for simplicity
- Use Drizzle push command for rapid development (switch to migrations for production)
- PostgreSQL via Docker (youtube-org-db container) with max: 1 connection pooling
- Store full API responses in jsonb for 304 Not Modified handling

**From 01-03 execution (2026-02-05):**
- Separate concerns: Bottleneck handles real-time rate limiting, database tracks persistent quota history
- 304 Not Modified responses return cached data from database (0 quota cost vs 1 for fresh fetch)
- Retry on 429 Rate Limit with exponential backoff, no retry on 403 quotaExceeded
- Cache key generation from resource type + JSON.stringify(params) for unique identification

**From 01-02 execution (2026-02-05):**
- Force consent screen (prompt: "consent") to guarantee refresh_token on every login
- Store access_token in JWT session (encrypted) rather than database for serverless compatibility
- Implement token refresh in JWT callback using oauth2.googleapis.com/token endpoint
- Handle revoked tokens (invalid_grant) by setting error flag to trigger re-authentication
- Preserve refresh_token during rotation (newTokens.refresh_token ?? token.refresh_token)

**From 01-04 execution (2026-02-05):**
- Use dedicated syncState table for tracking pagination progress (enables resume after quota exhaustion)
- Batch video IDs in groups of 50 for single videos.list call (1 unit per 50 videos vs 50 individual calls)
- Separate playlist sync and video sync into distinct functions (clearer separation of concerns)
- Delete syncState entry on sync completion, preserve on quota exhaustion (clean transient state)

**From 01-05 execution (2026-02-05):**
- Use Server Components for all data fetching, Client Components only for interactivity (eliminates quota waste on page refresh)
- Dashboard always loads from database, never triggers YouTube API (0 quota cost for page refresh)
- User-triggered sync button with loading state and success/error/partial-success messages (clear user control)
- Explicit authentication checks with redirect patterns (secure by default)

**From 02-01 execution (2026-02-06):**
- Used fast-dice-coefficient instead of unmaintained string-similarity (O(n) vs O(n^2), actively maintained)
- Used ml-hclust built-in group(k) instead of custom cutDendrogram (eliminates error-prone tree traversal)
- Category naming picks most descriptive title from cluster (most non-stopword words, then longest)
- Aggressive/conservative presets via targetClusters parameter (25 vs 35)
- Analysis functions are pure server-side, operating on cached PostgreSQL data (no YouTube API calls)

**From 02-05 execution (2026-02-06):**
- Combined distance metric: nameWeight * (1 - nameSim) + overlapWeight * (1 - videoOverlap) per algorithm mode
- Confidence scoring: 60% name similarity + 40% video overlap, scaled 0-100, with HIGH/MEDIUM/LOW levels
- Aggressive preset: 25 clusters, 0.6 name / 0.4 overlap weight; Conservative: 35 clusters, 0.8/0.2
- analysisSessions table tracks staleness via playlistDataTimestamp, finalizedAt marks approved structure
- All new columns nullable for backward compat with 02-01 data
- Watch Later excluded from clustering by both youtubeId='WL' and title check

**From 02-02 execution (2026-02-06):**
- Return proposals even on validation failure (success: false with proposals + errors) so UI can show issues
- Create analysisSessions record per generateConsolidationProposal call for multi-run tracking
- Explicit return type annotations from shared types for server action type safety

**From 02-06 execution (2026-02-06):**
- runAnalysis calls clusterPlaylists directly (not createConsolidationProposals) for finer control over proposal enrichment
- splitProposal inherits sessionId from original proposal for session continuity
- createCustomCategory creates new session if none exists for guaranteed session tracking
- checkStaleness compares max(playlists.lastFetched) against session.playlistDataTimestamp
- bulkUpdateStatus uses inArray for efficient single-query batch updates
- Manual proposals (split/custom) get confidenceScore: 100 with descriptive origin reason

**From 02-07 execution (2026-02-06):**
- react-resizable-panels v4 uses `orientation` instead of `direction` prop — added compatibility wrapper in resizable.tsx
- RunAnalysisButton replaces GenerateProposalButton with mode selector and staleness-aware label
- Review needed section filters by rejected status OR (low confidence + pending status)
- CategoryList uses client-side sort/filter with useMemo for performance

**From 02-09 execution (2026-02-06):**
- Specificity heuristic: longest playlist title first, fewest videos as tiebreaker (per CONTEXT.md)
- Added getDuplicateVideos server action to fetch enriched records from duplicateVideos table with DB IDs
- DuplicateRecord type bridges duplicateVideos table ID to DuplicateResolution.duplicateRecordId
- Preview-before-apply pattern: Dialog groups resolutions by target playlist for clarity
- useBatchSelection hook: reusable selection state (toggle, selectAll, clearAll, isSelected)

**From 02-11 execution (2026-02-06):**
- Timer-based stage progression (2s/stage) for loading feedback since server actions don't stream progress
- AnalysisRunner coexists with RunAnalysisButton: Runner adds staged loading, Button stays simple for inline use
- useCategoryKeyboardNav includes resetFocus callback for list filter/sort changes

**From 02-08 execution (2026-02-06):**
- On-demand detail fetching via getCategoryDetail server action to avoid loading all video data for 87 proposals upfront
- ISO 8601 duration parsing for YouTube PT format (PT1H2M3S) to human-readable MM:SS or H:MM:SS
- Relative date formatting for publishedAt ("2 months ago") instead of absolute dates
- Deduplication in getCategoryDetail: keep first occurrence of each video across source playlists

**From 02-10 execution (2026-02-06):**
- Native HTML inputs with Tailwind styling instead of adding shadcn Input component (reduces dependency churn)
- Radio-button assignment in split wizard: each playlist assigned to exactly one category via Map<playlistId, categoryIndex>
- ManualAdjustments only visible for pending proposals (approved/rejected not editable)
- CreateCategoryDialog in dashboard toolbar (accessible without selecting a category)
- updateProposalPlaylists recalculates confidence using calculateConfidence with updated playlist names

**From 02-12 execution (2026-02-06):**
- Inline BatchToolbar in dashboard rather than wrapping with BatchOperations component (avoids prop threading)
- Tabs for right panel (Category Detail / Duplicates) rather than separate view toggle
- Lazy-load duplicates on first tab switch to avoid upfront fetch of all duplicate records
- AnalysisRunner for empty state (staged loading), RunAnalysisButton in header (simple re-analyze)

**From 03-01 execution (2026-02-06):**
- Direct Pool creation in migration scripts (dotenv must run before Pool reads DATABASE_URL)
- Orphaned videos assigned to protected Uncategorized category as safety net
- categoryVideos.source tracks provenance: consolidation, manual, merge, orphan, undo
- Denormalized videoCount on categories for fast list rendering without COUNT joins

**From 03-02 execution (2026-02-06):**
- Raw SQL template for ILIKE queries (Drizzle ORM doesn't support ILIKE natively)
- Recalculate videoCount via COUNT query in undo operations for accuracy over arithmetic
- Warning at 4500 videos (success: true with error message), block at 5000
- N+1 subquery pattern for category names per video (acceptable for search result sizes of 50)

**From 03-03 execution (2026-02-06):**
- CSS transition for banner visibility instead of conditional rendering (preserves smooth animate in/out)
- Keyboard shortcut suppressed when dialog is open via DOM query for [role="dialog"]
- DeleteCategoryDialog passes undo data to parent via callback (parent owns undo stack)
- useRef to sync stack state for async undo function (avoids stale closure reading empty array)

**From 03-04 execution (2026-02-06):**
- Button-based source category tabs instead of Radix Tabs for flex-wrap support with many categories
- Move mode only shown when browsing specific source category (not global search)
- ISO 8601 duration parsing inline in VideoAssignmentDialog (self-contained, no coupling to Phase 2 code)

**From 03-05 execution (2026-02-06):**
- Early return pattern for management mode keeps analysis mode code completely untouched
- ManagementBatchToolbar separate from BatchToolbar (different operations: merge vs approve/reject)
- VideoSearchResult mapped to VideoDetail for VideoListPaginated reuse
- FolderOpen icon replaces status icons in management mode category list
- prompt() for new category name (simple, adequate for MVP)

**From 04-01 execution (2026-02-06):**
- Extract format utilities from Phase 2 components to /lib/videos/ for reuse across video display
- Use mqdefault (320x180) thumbnail quality as standard - available for all videos, good balance of size/quality
- SortOption includes both dateAdded variants (newest/oldest) for flexible default sorting
- VideoCardData includes categoryNames array for multi-category badge display
- getCategoryColour uses HSL with fixed saturation/lightness for consistent visual appearance

**From 04-02 execution (2026-02-06):**
- Batch enrichment pattern: 2 DB queries max (1 join + 1 batch) instead of N+1 for category names
- All Videos mode uses natural title sort, specific category uses dateAdded DESC
- CategorySidebar uses button elements for accessibility (keyboard nav, screen readers)
- Added revalidatePath('/videos') to assignVideosToCategory for cache invalidation

**From 04-03 execution (2026-02-06):**
- Row-based virtualization with CSS grid columns (not per-card virtualization) for simpler responsive logic
- ResizeObserver for dynamic column count calculation based on container width (1-4 columns)
- Checkbox overlay uses group-hover pattern (visible on hover or when selected)
- Empty cells rendered in last row to maintain grid alignment
- Scroll reset on videos array change via useEffect watching videos.length

**From 04-04 execution (2026-02-06):**
- Extended UndoEntry type to support 'move' | 'copy' alongside existing 'delete' | 'merge'
- Move undo reverses by moving videos back to source category
- Copy undo removes copied videos from target via removeVideosFromCategory
- Search scope toggle: 'category' filters current category, 'all' loads all videos
- Optimistic UI: remove moved videos immediately, refresh counts after server success
- Single orchestrator pattern: VideoBrowsePage manages all page state, wires child components
- Debounced search: 300ms setTimeout cleanup pattern in useEffect
- Client-side filtering + sorting via useMemo chains: raw → filtered → sorted
- Bulk operation warning: show amber alert for 5+ videos in move mode

**From 04-05 checkpoint (2026-02-06):**
- ROW_HEIGHT increased to 380px for card content (from 340px)
- VideoCard layout: flex gap-1.5 instead of space-y utilities (fixes overlapping)
- All category badges shown (map over categoryNames array, no "+N" indicator)
- Inline styles for grid spacing (24px gap, 48px padding) for cache-busting
- Bulk warning fixed by passing currentCategoryName directly (not conditional null)

**From 05-01 execution (2026-02-06):**
- Use IndexedDB for embeddings cache (50-100MB browser limit sufficient for 4,000 videos at 6MB total)
- Compound key [videoId, modelVersion] for model upgrade support
- PipelineSingleton pattern ensures one-time model load per worker lifetime
- Xenova/all-MiniLM-L6-v2 model (384-dim embeddings, ~50MB, cached in browser)
- Mean pooling + normalization for cosine similarity optimization (dot product only)
- Empirical confidence thresholds (HIGH≥0.75, MEDIUM≥0.60, LOW<0.60) subject to calibration
- Type assertion for Transformers.js pipeline (complex overload types)

**From 05-02 execution (2026-02-06):**
- Store similarity scores as 0-100 integers in mlCategorizations table (multiply cosine * 100 for UI display)
- Batch processing with BATCH_SIZE=32 per RESEARCH.md browser performance recommendation
- Cache-first strategy: check IndexedDB getBatch before generateEmbeddings to avoid recomputation
- Pre-computed category embeddings reused across all video comparisons (compute once per batch run)
- Lazy worker initialization defers model loading until categorizeVideos called
- 60-second timeout per embeddings request to prevent indefinite hangs from worker errors
- Null safety despite pre-computed categories guarantee (defensive programming with warning log)

**From 05-03 execution (2026-02-06):**
- Server actions can't stream progress (Next.js limitation) — documented in code, progress callbacks invoke only at start/complete
- Delete+insert pattern for ML categorization re-runs ensures clean slate with no duplicate records
- Always call engine.terminate() after categorization to prevent Web Worker memory leaks
- Conditional Drizzle queries use ternary pattern (not mutable let reassignment) for type safety
- Filter categories by isProtected=false to exclude Uncategorized from ML suggestion targets

**From 05-04 execution (2026-02-07):**
- Client-side ML execution pattern: MLCategorizationEngine runs in browser (Worker/IndexedDB accessible), server actions only handle DB operations
- Split server actions: getDataForCategorization (fetch videos/categories) + saveCategorizationResults (persist to DB) for clean separation of concerns
- Real progress callbacks work client-side (vs server action limitations from 05-03)
- CategorizationResult type bridges ML engine output with database persistence layer (pre-DB format)
- Blocker fix pattern: moved browser-only APIs from server context to client context to avoid "Worker is not defined" error

### Pending Todos

- UX: Add Cancel button to Final Review & Execute dialog (src/components/analysis/final-review.tsx) — only action is "Execute consolidation", no obvious way to back out besides the X close button
- UX: Approval should be a toggle (approved → click again → pending), not one-way. Reject should be a separate intentional action, distinct from un-approving.
- UX: Checkboxes should be for batch selection only (merge, bulk approve/reject), not conflated with approval state
- i18n: All user-facing text must use British English (e.g., "Uncategorised" not "Uncategorized", "Organise" not "Organize", "Finalise" not "Finalize"). Sweep all UI strings across the codebase.

### Blockers/Concerns

**Identified during roadmap creation:**

- **Phase 5 (ML Engine):** Model selection (all-MiniLM-L6-v2) assumed but needs validation during planning — accuracy on YouTube titles/descriptions unknown
- **Phase 8 (Sync):** Conflict resolution strategy not specified in research — last-write-wins vs user prompt depends on actual conflict frequency
- **Phase 8 (Sync):** YouTube API quota increase request timeline unclear — may need to submit early in Phase 1 if 10k units/day insufficient for testing

**From 01-03 execution (2026-02-05):**

- **Bottleneck reservoir timezone:** 24-hour refresh uses JavaScript Date, YouTube quota resets at midnight Pacific Time. May need timezone adjustment if running in different timezone.

**From 01-02 execution (2026-02-05):**

- **Google Cloud OAuth testing mode:** OAuth consent screen currently in "Testing" mode with limited test users. Will need Google verification process for production deployment with >100 users.
- **Refresh token rotation edge case:** Google may stop providing refresh_token in some refresh responses. Mitigated by preserving old refresh_token, but may need monitoring in production.

## Session Continuity

Last session: 2026-02-07T09:48:23Z
Stopped at: Completed 05-04-PLAN.md (ML Categorization Integration)
Resume file: None

---

**Phase 1 Complete!** All 5 Phase 1 Success Criteria validated.

**Phase 2 Complete!** All 11 plans executed. Full analysis workflow at /analysis with: clustering engine (aggressive/conservative modes), 18+ server actions, resizable split-panel dashboard, category detail with video list, batch operations, keyboard navigation, duplicate resolver, split wizard, manual adjustments, staleness detection, progress tracking, staged loading, and final review with finalizeConsolidation. Approved category structure persisted via finalizedAt timestamp.

**Phase 3 Complete!** All 6 plans executed. Management mode fully functional with: categories/categoryVideos tables, 10 server actions, undo stack with Cmd/Ctrl+Z, rename/delete/merge/assign dialogs, management dashboard with hover CRUD actions, batch merge toolbar, video assignment dialog, and complete end-to-end verification. All 5 Phase 3 success criteria validated.

**Phase 4 Complete!** All 5 plans executed. Full video browsing at /videos with: category sidebar navigation, virtualized grid (@tanstack/react-virtual with ROW_HEIGHT 380px), debounced search (300ms) with scope toggle, 4-way sort (dateAdded/publishedAt/title/duration), multi-select with toolbar controls, move/copy dialog with bulk warning (5+ videos), optimistic UI updates, undo support (Cmd/Ctrl+Z), and all category badges displayed. All 7 Phase 4 success criteria verified. Ready for Phase 5 (ML Categorization Engine).

**Phase 5 Plan 01 Complete!** ML foundation implemented: IndexedDB embeddings cache (EmbeddingsCache class with get/set/getBatch/setBatch), Web Worker with Transformers.js singleton (Xenova/all-MiniLM-L6-v2, 384-dim), cosine similarity functions (dot product for normalized vectors), and confidence scoring (HIGH≥0.75, MEDIUM≥0.60, LOW<0.60). 4 files created (605 lines total), @huggingface/transformers dependency installed.

**Phase 5 Plan 02 Complete!** Database schema extended with mlCategorizations table (10 fields: videoId, suggestedCategoryId, confidence enum, similarityScore 0-100, modelVersion, timestamps for acceptance/rejection, manualCategoryId). MLCategorizationEngine orchestrator implemented (227 lines): batch processing (32 videos/batch), cache-first embeddings (getBatch before generateEmbeddings), pre-computed category embeddings, progress callbacks, worker lifecycle (lazy init, terminate), 60s timeout handling.

**Phase 5 Plan 03 Complete!** Server actions bridge ML engine to database: runMLCategorization (full pipeline: fetch videos → fetch categories → run engine → delete+insert persistence → stats), getMLCategorizationForVideo (single video query), getMLCategorizationResults (filtered query with confidence level). React components ready for Plan 04: CategorizationTrigger (button with loading state, error display, callbacks), ProgressDisplay (status text, animated progress bar). 4 files created (277 lines total). Ready for Phase 5 Plan 04 (ML Review Interface).

**Phase 5 Complete!** All 4 plans executed. Client-side ML categorization with browser-native APIs: IndexedDB embeddings cache (EmbeddingsCache), Web Worker with Transformers.js (Xenova/all-MiniLM-L6-v2), cosine similarity scoring, confidence levels (HIGH≥0.75, MEDIUM≥0.60, LOW<0.60), mlCategorizations database table, batch processing (32 videos), cache-first strategy, MLCategorizationEngine orchestrator, split server actions (getDataForCategorization/saveCategorizationResults), full-page UI at /ml-categorization with navigation link, real-time progress callbacks, and end-to-end verified workflow. Blocker resolved: moved ML engine from server-side to client-side to access Worker/IndexedDB APIs. All 4 Phase 5 success criteria verified. Ready for Phase 6 (Watch Later Processing).
