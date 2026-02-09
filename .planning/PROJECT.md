# YouTube Playlist Organiser

## What This Is

A web application that analyses YouTube playlists, proposes consolidated category structures via ML-powered clustering, auto-categorises videos using client-side Transformers.js, and syncs cleaned-up playlists back to YouTube with quota-aware multi-day batching. Designed for ongoing maintenance as Watch Later grows.

## Core Value

Videos must be findable when needed. If you can't locate a video when you need it, the collection is worthless.

## Requirements

### Validated

- ✓ System analyses existing 87 playlists and proposes consolidated structure (~25-35 categories) — v1.0
- ✓ User can approve, reject, or adjust proposed category consolidations — v1.0
- ✓ System auto-categorises 4,000 Watch Later videos into consolidated categories using ML — v1.0
- ✓ User can review videos by category with thumbnail, title, and metadata — v1.0
- ✓ User can preview videos during review (click through to watch) — v1.0
- ✓ User can move videos between categories during review — v1.0
- ✓ User can accept/reject ML suggestions with keyboard shortcuts — v1.0
- ✓ System syncs new playlist structure to YouTube (create playlists, add videos) — v1.0
- ✓ System archives old playlist structure before making changes — v1.0
- ✓ System handles YouTube API quota limits gracefully — v1.0
- ✓ User can run categorisation again on new Watch Later additions — v1.0
- ✓ Full auth hardening with middleware + selective guards — v1.0
- ✓ Toast notifications replacing all alert() calls — v1.0
- ✓ British English throughout all user-facing text — v1.0
- ✓ Dark mode with system preference detection — v1.0
- ✓ WCAG 2.2 accessibility compliance (92/100 audit score) — v1.0

### Active

- [ ] System imports Watch Later videos from Google Takeout CSV export
- [ ] System fetches video metadata from YouTube API for imported video IDs
- [ ] Watch Later videos appear in the existing ML categorisation and review pipeline

### Out of Scope

- Real-time sync (batch operations only) — API quota limits make continuous sync impractical
- Mobile app — Web-first, focus on desktop workflow (PWA-friendly responsive design shipped in v1.0)
- Multi-user collaboration — Single-user tool for personal library
- Video analytics/watch time tracking — Focus is organisation, not analytics
- Export to other platforms — YouTube is the source of truth
- Desktop application (Electron) — Web app is simpler to maintain
- System remembers category structure and patterns for future runs — Deferred to v2 (LEARN-01 through LEARN-04)
- Mark videos for deletion during review — Not implemented; deletion happens at playlist level via sync
- Skip videos (leave uncategorised) — Videos default to Uncategorised category as safety net

## Context

**Current State:**
- v1.0 shipped 2026-02-08
- 21,659 lines of TypeScript across 519 files
- Tech stack: Next.js 15, NextAuth v5, Drizzle ORM, PostgreSQL, Tailwind CSS v4, shadcn/ui, Transformers.js, @tanstack/react-virtual, Phosphor Icons
- 12 phases, 65 plans, 283 commits in 4 days
- 61/62 v1 requirements satisfied (SYNC-04 partial: YouTube deprecated Watch Later write API in 2020)

**Architecture:**
- Server Components for data fetching, Client Components for interactivity
- Client-side ML via Web Worker (Xenova/all-MiniLM-L6-v2, 384-dim embeddings)
- IndexedDB embeddings cache for re-run efficiency
- Quota-aware sync engine with stage-based state machine and checkpoint/resume
- Pre-operation JSON backups with SHA-256 checksums and immutable operation log

**Known Issues:**
- YouTube API does not return Watch Later via `playlists.list({ mine: true })` and `playlistItems.list({ playlistId: 'WL' })` returns empty/404 — must import from Google Takeout CSV
- SYNC-04: YouTube deprecated Watch Later write access in 2020 — cannot programmatically remove videos from Watch Later
- Google Cloud OAuth in "Testing" mode — needs verification for >100 users
- Bottleneck reservoir timezone may need adjustment for non-local deployments

## Constraints

- **YouTube API Quota**: 10,000 units/day default — must batch operations and cache data
- **Tech Stack**: Next.js 15 web application
- **Data Ownership**: YouTube remains source of truth — tool is reorganisation assistant only
- **Performance**: Must handle 4,000+ videos without UI freezing (virtualised rendering)
- **Backup Required**: Must archive existing structure before any YouTube changes
- **Accessibility**: WCAG 2.2 AA compliance for all interactive elements

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| AI-first categorisation, not manual | 4,000 videos makes manual categorisation impractical | ✓ Good — ML processes 4,000 videos in ~2 minutes |
| Consolidate categories before Watch Later | Cleaner target structure improves auto-categorisation accuracy | ✓ Good — AGNES clustering produces coherent categories |
| System proposes consolidation, user approves | Balance automation with user control over taxonomy | ✓ Good — split wizard and manual adjustments provide full control |
| Web app, not desktop (Electron) | Simpler deployment and maintenance | ✓ Good — responsive design works on all devices |
| YouTube as source of truth | Tool assists reorganisation but YouTube is primary interface | ✓ Good — sync engine creates real YouTube playlists |
| Preview capability during review | User needs to watch snippets to remember old videos | ✓ Good — YouTube embed in review modal |
| Client-side ML (Web Worker) | Browser APIs (Worker, IndexedDB) required for ML execution | ✓ Good — no server-side GPU needed, embeddings cached |
| Transformers.js with all-MiniLM-L6-v2 | Lightweight (50MB), runs in browser, sufficient for title similarity | ⚠️ Revisit — accuracy depends on calibrated thresholds (HIGH ≥50%, MEDIUM ≥35%) |
| Pre-operation backups with SHA-256 | Safety-first approach for destructive YouTube operations | ✓ Good — immutable audit trail |
| Middleware-first auth (NextAuth v5) | Single file protects all routes vs per-page guards | ✓ Good — eliminated auth gaps |
| Sonner for toast notifications | Lightweight, rich colours, accessible | ✓ Good — replaced all alert() calls |
| Dark mode with ThemeProvider | System preference detection + manual toggle | ✓ Good — oklch colour tokens with semantic names |
| Phosphor Icons over Lucide | Better icon set, consistent weight/style, SSR support | ✓ Good — unified icon language across all pages |

## Current Milestone: v1.1 Watch Later Import

**Goal:** Import 3,932 Watch Later videos from Google Takeout CSV into the database so they can be categorised by the existing ML pipeline.

**Target features:**
- CSV import with YouTube API metadata enrichment
- Watch Later playlist entry creation in database
- Integration with existing ML categorisation flow

---
*Last updated: 2026-02-08 after v1.1 milestone start*
