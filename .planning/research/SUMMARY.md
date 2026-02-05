# Project Research Summary

**Project:** YouTube Playlist Organizer with ML Categorization
**Domain:** YouTube API Application with ML-based Content Management
**Researched:** 2026-02-05
**Confidence:** HIGH

## Executive Summary

This project is a YouTube playlist management tool designed to organize 5,523 videos (including 4,000+ in Watch Later) across 87 playlists using machine learning categorization. Expert implementations follow a client-reviewed ML workflow: intelligent categorization suggestions backed by Transformers.js (browser-based ML) combined with human approval before syncing to YouTube. This hybrid approach solves the scale problem (manual organization of 4,000 videos is impractical) while maintaining user control over the final structure.

The recommended approach is a Next.js 15 full-stack application with PostgreSQL for caching YouTube data, Transformers.js for client-side ML inference, and aggressive quota management (YouTube's 10,000 units/day limit is the primary constraint). The architecture follows a three-phase workflow: (1) fetch and cache data locally, (2) run ML categorization with user review via virtualized UI, and (3) batch sync approved changes to YouTube with operation journaling. This approach minimizes quota usage through caching while ensuring data safety through local archives before destructive operations.

Critical risks center on YouTube API quota exhaustion, irreversible playlist deletions, and UI performance with 4,000+ items. Mitigation requires mandatory quota tracking from day one, automatic archiving before any delete operation, and react-window virtualization for large lists. The ML component must use proper train/validation/test splits to avoid overfitting, and batch operations need checkpoint/resume capabilities to handle partial failures gracefully. These are not optimizations—they are table stakes for a functional product at this scale.

## Key Findings

### Recommended Stack

The stack prioritizes API quota efficiency, client-side ML inference, and performance at scale (4,000+ videos). Next.js 15 provides the full-stack framework with built-in API routes, eliminating separate backend complexity. PostgreSQL handles concurrent writes and complex queries better than SQLite, which lacks multi-user support. Drizzle ORM offers 7KB bundle size (critical for serverless) with zero cold-start penalty versus Prisma.

**Core technologies:**
- **Next.js 15 (with React 19)**: Full-stack framework with App Router and Server Components—reduces client bundle and provides modern data fetching patterns for handling YouTube API responses
- **PostgreSQL 16 + Drizzle ORM**: Production-ready database for caching 5,523+ videos with complex queries; Drizzle provides 14x faster performance than N+1 patterns and TypeScript-first API
- **Transformers.js 3.2+**: Client-side ML inference for zero-shot classification—runs in browser with no server costs, provides instant feedback during review (4,000 videos × $0 vs OpenAI API = $2-5)
- **googleapis + bottleneck**: Official YouTube Data API v3 client with rate limiting library—critical for staying within 10,000 units/day quota without exhaustion
- **react-window**: List virtualization for 4,000+ video UI—reduces DOM from 4,000 nodes to ~50 visible, prevents UI freeze (100ms first render vs 2-3s freeze)
- **Zustand + TanStack Query**: Client state (3KB, zero boilerplate) and server state caching—reduces redundant API calls and saves quota
- **Tailwind CSS 4 + shadcn/ui**: Modern styling with copy-paste components—no npm dependency bloat, full code ownership

**Critical version requirements:**
- Node.js 22.x LTS (native TypeScript execution, active through April 2027)
- TypeScript 5.7+ (compile-time safety for YouTube API responses)
- React 19 required by Next.js 15 (breaking change from v14)

**Quota management strategy:**
- Initial data fetch: ~220 units (87 playlists, 5,523 videos)
- Watch Later processing: ~160 units (4,000 videos)
- **Syncing 4,000 videos: 400,000 units = 40 days minimum** (write operations cost 50 units each)
- Solution: Aggressive ETag caching (60-80% quota reduction), multi-day sync strategy with progress tracking, request quota increase from Google

### Expected Features

Research reveals two distinct feature categories: table stakes (users assume these exist) and differentiators (competitive advantage through ML). The ML auto-categorization is the core value proposition—without it, organizing 4,000 videos manually is impractical.

**Must have (table stakes):**
- **List all playlists and contents**: Foundation—can't organize without seeing what exists (YouTube Data API `playlists.list` and `playlistItems.list`)
- **Manual video categorization**: Move videos between playlists with drag-drop or select-and-move UI (YouTube removed multi-select—user pain point)
- **Batch video selection**: Select multiple videos at once for bulk operations (missing from native YouTube)
- **Undo/restore capability**: YouTube has NO native undo—must implement locally before sync with explicit confirmation
- **Sync to YouTube**: Changes must persist to YouTube with careful batching to respect 10k units/day quota
- **Duplicate detection**: Identify same video in multiple playlists (match by video ID)
- **Export/backup playlists**: Save current state before changes to prevent data loss

**Should have (competitive advantage):**
- **ML auto-categorization**: Categorize 4,000 videos automatically vs manual (CORE DIFFERENTIATOR—makes tool viable at scale)
- **Category consolidation suggestions**: Propose merging 87→25 playlists intelligently based on overlap analysis
- **Batch review interface**: Review/approve 100s of videos efficiently with confidence scoring (key UX differentiator)
- **Confidence scoring**: Show ML certainty per video to prioritize review time (HIGH = auto-accept, LOW = manual review)
- **Learn from corrections**: Improve ML from user moves/corrections for incremental categorization runs
- **Keyboard shortcuts**: Navigate review interface without mouse (power user feature)

**Defer (v2+):**
- **Visual similarity detection**: Find visually similar videos beyond video ID matching (deep learning, uncertain value)
- **Nested folder structure**: Group playlists by topic client-side (YouTube doesn't support folders)
- **Filter by watched status**: See which videos already watched (requires Watch Later metadata)
- **Playlist analytics**: Show category growth over time (scope creep into different domain)

**Anti-features (avoid):**
- **Real-time sync**: Exhausts API quota—use batch sync with explicit "Sync to YouTube" action
- **Video analytics/watch time**: Scope creep—focus on organization/findability, not analytics
- **Multi-user collaboration**: Authentication complexity—single-user tool is simpler with better UX
- **Automated playlist creation without review**: Low user trust—AI suggests, user approves (hybrid approach)

### Architecture Approach

The architecture follows a layered monolith pattern with quota-aware API client, batch ML inference pipeline, and bidirectional sync orchestration. Next.js handles the full stack (API routes + UI), PostgreSQL caches YouTube data with ETags, and Transformers.js runs ML inference client-side. This avoids microservice complexity while maintaining clear separation between data fetching, ML processing, and sync logic.

**Major components:**
1. **Quota-Aware YouTube API Client** — Wraps googleapis with ETag caching (60-80% quota reduction), conditional requests, and quota tracking; stores API responses in PostgreSQL with timestamps; implements bottleneck rate limiting (max 100 requests/second)
2. **Batch ML Inference Pipeline** — Generates embeddings using Sentence Transformers (all-MiniLM-L6-v2) in batches of 32; caches embeddings to avoid recomputation; computes cosine similarity between video embeddings and category embeddings; assigns categories with confidence scores
3. **Bidirectional Sync Orchestrator** — Three-phase sync: fetch remote state, detect conflicts (timestamp-based), push local changes with retry logic; implements operation journaling for checkpoint/resume; handles partial batch failures with compensating transactions
4. **Virtualized Review UI** — react-window renders only visible items (~30 of 4,000); lazy-loads thumbnails via Intersection Observer; Zustand tracks user edits; TanStack Query manages API data with caching
5. **Archive & Safety Layer** — Exports playlist metadata before any delete operation; implements soft delete with 7-day grace period; tracks all destructive operations in immutable log

**Key patterns:**
- **ETag caching**: Store ETags with cached data, use conditional requests (If-None-Match header) for 304 Not Modified responses
- **Batch processing**: Process videos in batches (32 items) for ML inference—10-100x faster than per-item loops
- **Operation journaling**: Write operation plan to disk before executing, mark pending/complete/failed, resume from checkpoint on failure
- **Virtual scrolling**: Non-negotiable for 4,000+ items—renders only visible rows to prevent UI freeze

### Critical Pitfalls

Research identified six critical pitfalls that will break the product if not addressed from day one. These are not edge cases—they are guaranteed failure modes at this scale.

1. **Quota Exhaustion from Expensive Operations** — YouTube's 10,000 units/day limit can be exhausted in minutes with inefficient patterns. Write operations cost 50 units each, so moving 4,000 videos requires 40 days minimum. **Prevention**: Pre-calculate quota budget before operations, cache aggressively with ETags, design multi-day resumable workflows with quota-aware scheduling, build quota meter into UI showing remaining daily quota.

2. **Irreversible Playlist Deletion Without Archive** — YouTube provides NO recovery mechanism for deleted playlists. **Prevention**: Archive playlist metadata to local JSON before any delete API call (non-negotiable), implement two-factor deletion confirmation (type playlist name), use soft delete pattern with 7-day grace period, maintain immutable operation log for forensics.

3. **OAuth Refresh Token Expiration Mid-Operation** — Long-running batch operations fail midway with `invalid_grant` errors. Access tokens expire after ~1 hour, refresh tokens can be revoked if user changes password or hits token limits. **Prevention**: Proactive token refresh when <10 minutes remaining, checkpoint-based operations that resume after re-authentication, validate token health before multi-hour operations.

4. **UI Freezing with 4,000+ Video Rendering** — Rendering all 4,000 videos as DOM elements causes 10-30s freeze, browser "Page Unresponsive" warnings, 1-2GB memory consumption. **Prevention**: react-window virtualization (mandatory, not optional), lazy-load thumbnails with Intersection Observer, pagination for management operations (100-200 per page), Web Workers for ML processing off main thread.

5. **ML Model Overfitting on Limited Training Data** — Model achieves 95% accuracy on training data but only 60-70% on real playlists due to memorizing specific titles instead of learning semantic meaning. **Prevention**: Stratified train/validation/test split (70/15/15), handle class imbalance with weighting/resampling, leverage pre-trained models (BERT/GPT) with transfer learning, implement cross-validation (k=5), show confidence scores and enable human-in-the-loop feedback.

6. **Partial Batch Operation Failures Without State Recovery** — Batch operation fails at video #247, leaving playlists in inconsistent state with no way to resume. **Prevention**: Operation journaling with pending/complete/failed states, idempotent operations (check if video already in playlist before adding), two-phase commit pattern (plan operations, then execute with checkpoints), exponential backoff with jitter for retries, graceful degradation on quota exhaustion with scheduled resume.

## Implications for Roadmap

Based on research findings, the roadmap should follow a strict dependency order: data infrastructure → ML foundation → review UI → sync operations. Attempting ML categorization before solid data caching or building sync without safety mechanisms invites critical failures.

### Phase 1: Foundation & Data Pipeline
**Rationale:** Every other component depends on reliable YouTube data fetching and local caching. Quota management must be implemented before any write operations to prevent exhaustion. This is the critical path—without it, nothing else functions.

**Delivers:**
- PostgreSQL schema with Drizzle ORM for playlists, videos, sync state
- YouTube API client wrapper with googleapis + bottleneck rate limiting
- ETag-based caching layer reducing quota usage by 60-80%
- Quota tracking and monitoring dashboard
- Initial data fetch: 87 playlists, 5,523 videos (~220 quota units)

**Addresses features:**
- List all playlists and contents (table stakes)
- Video metadata display (table stakes)
- Basic playlist CRUD operations (table stakes)

**Avoids pitfall:**
- Quota exhaustion from expensive operations (Critical Pitfall #1)

**Research flag:** LOW — YouTube Data API v3 is well-documented with official googleapis library (Context7 verified). Standard patterns exist for quota management and ETag caching.

---

### Phase 2: Playlist Analysis & Consolidation
**Rationale:** Before running ML categorization, need to establish target category structure. Analyzing 87 existing playlists to propose consolidation to ~25 categories reduces ambiguity for ML and improves accuracy. This phase requires only read operations (low quota cost).

**Delivers:**
- Playlist overlap analysis (detect duplicate videos across playlists)
- Category consolidation suggestions (propose merging similar playlists)
- Category definition schema and storage
- User approval UI for proposed structure

**Addresses features:**
- Category consolidation suggestions (differentiator)
- Duplicate detection (table stakes)
- Category structure preview (differentiator)

**Avoids pitfall:**
- ML model overfitting on limited training data (Critical Pitfall #5) — cleaner structure with fewer, well-defined categories improves training data quality

**Research flag:** MEDIUM — Playlist overlap analysis is straightforward, but category consolidation logic may need domain-specific heuristics. May require `/gsd:research-phase` for semantic similarity algorithms if simple overlap detection insufficient.

---

### Phase 3: ML Categorization Engine
**Rationale:** With target categories defined (Phase 2) and data cached locally (Phase 1), can now build ML inference pipeline. Client-side inference with Transformers.js keeps costs at $0 vs server-side OpenAI API. Must implement batch processing and embedding caching for performance.

**Delivers:**
- Transformers.js integration (all-MiniLM-L6-v2 model)
- Batch embedding generation with caching (process 32 videos at a time)
- Category assignment with confidence scoring
- Zero-shot classification without training data
- Embedding storage in PostgreSQL BLOB

**Uses stack:**
- @huggingface/transformers.js 3.2+ for browser-based ML
- PostgreSQL BLOB columns for embedding storage
- Web Workers for off-main-thread processing

**Addresses features:**
- ML auto-categorization (CORE DIFFERENTIATOR)
- Confidence scoring (differentiator)

**Avoids pitfall:**
- UI freezing with 4,000+ video rendering (Critical Pitfall #4) — ML runs in Web Worker, doesn't block main thread
- ML model overfitting (Critical Pitfall #5) — using pre-trained model (transfer learning) vs training from scratch

**Research flag:** MEDIUM — Transformers.js is well-documented (Context7 verified), but optimal model selection (all-MiniLM-L6-v2 vs alternatives) and batch size tuning may need experimentation. Consider `/gsd:research-phase` for model evaluation if zero-shot accuracy insufficient.

---

### Phase 4: Review & Approval UI
**Rationale:** ML categorization produces suggestions, but user must review and approve before sync. This is the critical UX differentiator—efficient review of 4,000 videos requires virtual scrolling, keyboard shortcuts, and batch operations. Without this UI, manual correction becomes impractical.

**Delivers:**
- react-window virtualized list rendering only visible items
- Video card components with thumbnail, title, metadata, category assignment
- Keyboard shortcuts for rapid navigation (arrow keys, accept/reject)
- Batch operations (select multiple, move all to category)
- Search and filter within categories
- Manual category reassignment (drag-drop or select-and-move)

**Uses stack:**
- react-window for virtualization (mandatory for 4,000+ items)
- Zustand for client state (tracking user edits)
- TanStack Query for server state (YouTube data caching)
- Tailwind CSS 4 + shadcn/ui for styling

**Addresses features:**
- Basic review interface (table stakes for MVP)
- Manual corrections (table stakes)
- Batch review interface (differentiator)
- Keyboard shortcuts (differentiator)
- Video preview capability (table stakes — external link to YouTube)

**Avoids pitfall:**
- UI freezing with 4,000+ video rendering (Critical Pitfall #4) — react-window virtualization is non-negotiable

**Research flag:** LOW — react-window is well-documented (Context7 verified), virtualization patterns are standard. No additional research needed unless custom scrolling behaviors required.

---

### Phase 5: Safety & Archive System
**Rationale:** Before implementing any destructive operations (delete playlists, remove videos), must have safety mechanisms. YouTube has NO undo—archives and soft deletes are mandatory, not optional. This phase blocks Phase 6 (sync operations).

**Delivers:**
- Export playlist metadata to JSON (complete backup)
- Automatic archive before any delete operation
- Soft delete with 7-day grace period
- Two-factor deletion confirmation (type playlist name)
- Immutable operation log (timestamp, playlist ID, video count, archive location)
- Undo/restore from archive functionality

**Addresses features:**
- Undo/restore capability (table stakes)
- Export/backup playlists (table stakes)

**Avoids pitfall:**
- Irreversible playlist deletion without archive (Critical Pitfall #2) — archives are created automatically before delete API calls

**Research flag:** LOW — Standard file export/import patterns. Archive format is straightforward JSON with playlist metadata.

---

### Phase 6: Batch Sync Operations
**Rationale:** With safety mechanisms in place (Phase 5) and approved categorizations from UI (Phase 4), can now sync changes to YouTube. Must implement operation journaling for checkpoint/resume and handle partial failures gracefully. Quota-aware batching is critical—syncing 4,000 videos requires 40 days minimum.

**Delivers:**
- Operation journaling (write plan to disk, mark pending/complete/failed)
- Checkpoint-based batch execution (resume from last successful operation)
- Idempotent operations (check current state before API calls)
- Exponential backoff with jitter for retries (429 rate limits)
- Multi-day sync strategy with progress tracking
- Quota-aware scheduling (pause at 9,000 units, resume after midnight PT)
- Real-time progress UI ("Processing video 247/500, 49%")

**Uses stack:**
- googleapis for YouTube API write operations (50 units each)
- bottleneck for rate limiting (prevent 429 errors)
- PostgreSQL for operation log and sync state

**Addresses features:**
- Sync to YouTube (table stakes)
- Batch video selection (table stakes)

**Avoids pitfalls:**
- Quota exhaustion (Critical Pitfall #1) — quota-aware batching with multi-day strategy
- OAuth refresh token expiration (Critical Pitfall #3) — proactive token refresh, checkpoint system allows resume after re-auth
- Partial batch operation failures (Critical Pitfall #6) — operation journaling enables resume from checkpoint

**Research flag:** MEDIUM-HIGH — Bidirectional sync with conflict resolution is complex. YouTube API has no transaction support, so handling partial failures requires careful design. Consider `/gsd:research-phase` for conflict resolution strategies (last-write-wins vs user prompt) and rollback/compensating transaction patterns.

---

### Phase 7: Learning System (v1.x)
**Rationale:** After first categorization run completes, user corrections provide training data for improving ML accuracy. This enables incremental categorization (monthly runs on new Watch Later additions) with learned patterns. Defer to v1.x—not required for initial launch.

**Delivers:**
- Feedback loop tracking user corrections (video ID, predicted category, corrected category)
- Retraining pipeline using correction data
- Incremental categorization (run on new videos only, not entire library)
- Category structure persistence (reuse approved categories from first run)

**Addresses features:**
- Learn from corrections (differentiator)
- Incremental categorization (differentiator)

**Avoids pitfall:**
- ML model overfitting (Critical Pitfall #5) — user corrections provide real-world training data, improving generalization

**Research flag:** HIGH — Transfer learning and active learning patterns are complex. Retraining pipeline needs proper train/validation/test split, class balancing, and regularization. Strongly recommend `/gsd:research-phase` during Phase 7 planning to research fine-tuning strategies for sentence transformers.

---

### Phase Ordering Rationale

**Dependency-driven sequencing:**
- Phase 1 (Foundation) blocks everything—no API client = no data
- Phase 2 (Analysis) must precede Phase 3 (ML)—can't categorize without target structure
- Phase 3 (ML) produces suggestions for Phase 4 (Review UI)—workflow is ML → review → approve
- Phase 5 (Safety) must precede Phase 6 (Sync)—archives required before destructive operations
- Phase 6 (Sync) depends on Phase 4 completion—need approved categorizations to sync
- Phase 7 (Learning) depends on Phase 6 completion—need user corrections from first run

**Pitfall mitigation order:**
- Quota tracking in Phase 1 prevents exhaustion before write operations introduced
- Archives in Phase 5 prevent data loss before destructive operations in Phase 6
- Virtualization in Phase 4 prevents UI freeze before showing large datasets
- Operation journaling in Phase 6 handles partial failures when syncing at scale

**Architecture alignment:**
- Phases 1-2 build data layer (API client, caching, analysis)
- Phases 3-4 build ML + UI layer (inference, review workflow)
- Phases 5-6 build sync layer (safety mechanisms, bidirectional sync)
- Phase 7 builds learning layer (feedback loop, retraining)

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 6 (Batch Sync Operations):** Complex bidirectional sync with conflict resolution, rollback/compensating transactions, and multi-day resumable workflows. YouTube API has no transaction support, so handling partial failures requires careful design. Recommend `/gsd:research-phase` for conflict resolution strategies.
- **Phase 7 (Learning System):** Transfer learning, fine-tuning sentence transformers, active learning patterns are complex. Retraining pipeline needs proper data science practices. Strongly recommend `/gsd:research-phase` during Phase 7 planning.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Foundation):** YouTube Data API v3 is well-documented with official googleapis library. Standard patterns for quota management and ETag caching are established.
- **Phase 4 (Review UI):** react-window virtualization is well-documented. Virtual scrolling patterns for large lists are standard.
- **Phase 5 (Safety):** Standard file export/import patterns. Archive format is straightforward JSON.

**When to trigger deeper research:**
- If zero-shot classification accuracy <70% during Phase 3, research fine-tuning strategies
- If conflict resolution becomes common during Phase 6 testing, research three-way merge algorithms
- If quota limits persist even with caching, research YouTube API quota extension process

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Next.js 15, React 19, Drizzle ORM verified with Context7 and official docs. Transformers.js verified as production-ready. Versions are current (2025-2026) and compatibility matrix confirmed. |
| Features | HIGH | Table stakes identified from YouTube community pain points and competitor analysis. Differentiators validated against TubeBuddy, PocketTube, Playlist Cleaner feature sets. MVP scope is well-defined with clear v1/v2 split. |
| Architecture | HIGH | Patterns verified against official YouTube API documentation, FastAPI best practices, and ML pipeline architecture guides. Quota-aware client pattern is proven in production. Batch ML inference is standard practice. |
| Pitfalls | HIGH | Critical pitfalls sourced from official YouTube API error reference, quota documentation, and OAuth 2.0 implementation guide. Performance traps verified with react-window benchmarks and Web.dev articles. |

**Overall confidence:** HIGH

All four research areas have strong backing from official documentation (YouTube Data API v3, Next.js, React, Transformers.js) and Context7-verified sources. The domain is well-understood with production implementations available for reference (TubeBuddy, PocketTube). Critical constraints (10,000 units/day quota, no undo on YouTube) are documented facts, not assumptions.

### Gaps to Address

While overall confidence is high, some areas need validation during implementation:

- **ML model selection (Transformers.js):** Research recommends all-MiniLM-L6-v2 based on size/speed trade-offs, but actual accuracy on YouTube video titles/descriptions needs validation. If zero-shot classification accuracy <70%, may need to research alternative models or fine-tuning strategies during Phase 3. **Mitigation**: Build model-swapping abstraction in Phase 3 to easily test alternatives (all-mpnet-base-v2, distilbert-base-nli-stsb-mean-tokens).

- **Category consolidation heuristics (Phase 2):** Simple overlap detection (same video in multiple playlists) is straightforward, but intelligent consolidation (merge "JavaScript Tutorials" + "JS Advanced" → "JavaScript") may require semantic similarity beyond exact title matching. **Mitigation**: Start with overlap-based consolidation (LOW complexity), defer semantic clustering to v1.x if users request it. Document as known limitation in Phase 2.

- **Conflict resolution strategy (Phase 6):** Research identified timestamp-based conflict detection, but didn't specify resolution strategy. Last-write-wins vs user prompt depends on actual conflict frequency in testing. **Mitigation**: Implement last-write-wins initially (simpler), add conflict resolution UI only if users report issues during beta testing. Log all conflicts for analysis.

- **Quota extension approval timeline:** Research notes Google approves quota increases for legitimate apps, but didn't specify approval SLA (1-2 weeks estimate). If 4,000-video sync requires 40 days at 10k quota, users may need faster resolution. **Mitigation**: Submit quota increase request during Phase 1 (before sync), targeting 100k units/day. Include use case description in request. Document fallback multi-day sync strategy if increase denied.

- **Playlist size limits:** YouTube has 5,000 item limit per playlist (documented), but research didn't specify how to handle overflow when consolidating. If consolidation creates category with >5,000 videos, need automatic overflow playlist creation. **Mitigation**: Add playlist size validation in Phase 2 analysis. If any proposed category exceeds 4,500 videos (safety margin), prompt user to split category or create "Part 2" playlist automatically during sync.

## Sources

### Primary (HIGH confidence)
- **/websites/googleapis_dev_nodejs_googleapis** (Context7) — YouTube Data API v3 client
- **/vercel/next.js** (Context7) — Next.js 15 App Router, Server Components
- **/bvaughn/react-window** (Context7) — React virtualization for large lists
- **/huggingface/transformers.js** (Context7) — Browser-based ML inference
- **/colinhacks/zod** (Context7) — TypeScript schema validation
- https://developers.google.com/youtube/v3/getting-started — YouTube Data API v3 quota (official)
- https://developers.google.com/youtube/v3/guides/implementation — YouTube API Implementation Guide (official)
- https://developers.google.com/youtube/v3/determine_quota_cost — YouTube API Quota Calculator (official)
- https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-7.html — TypeScript 5.7 (official)
- https://nodejs.org/en/about/previous-releases — Node.js 22 LTS (official)
- https://tailwindcss.com/blog/tailwindcss-v4 — Tailwind CSS v4 release (official)

### Secondary (MEDIUM confidence)
- https://www.bytebase.com/blog/drizzle-vs-prisma/ (Jan 2025) — Drizzle vs Prisma performance comparison
- https://pockettube.io/playlists.html — PocketTube feature list (competitor analysis)
- https://www.tubebuddy.com/tools/playlist-actions — TubeBuddy Playlist Actions (competitor analysis)
- https://getlate.dev/blog/youtube-api-limits-how-to-calculate-api-usage-cost-and-fix-exceeded-api-quota (2025) — YouTube API quota management strategies
- https://web.dev/articles/virtualize-long-lists-react-window — React Window virtualization (Web.dev)
- https://neptune.ai/blog/ml-pipeline-architecture-design-patterns — ML Pipeline Architecture
- https://betterstack.com/community/guides/monitoring/exponential-backoff/ (2025) — Exponential backoff best practices
- https://www.analyticsvidhya.com/blog/2020/07/10-techniques-to-deal-with-class-imbalance-in-machine-learning/ — Class imbalance techniques
- https://www.v7labs.com/blog/train-validation-test-set — Train/validation/test splits

### Tertiary (LOW confidence, needs validation)
- OpenAI API pricing ($0.15/$0.60 per million tokens for GPT-4o Mini) — verify on https://openai.com/api/pricing/
- bottleneck library for YouTube API rate limiting — community recommendation, not officially documented by Google
- GitHub recovery tools for YouTube playlists — third-party tools, varying quality/maintenance

---
*Research completed: 2026-02-05*
*Ready for roadmap: yes*
