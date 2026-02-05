# YouTube Playlist Organizer

## What This Is

A web application that analyzes your YouTube playlists, proposes consolidated category structures, auto-categorizes videos using ML, and syncs cleaned-up playlists back to YouTube. Designed for ongoing maintenance as Watch Later grows.

## Core Value

Videos must be findable when needed. If you can't locate a video when you need it, the collection is worthless.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] System analyzes existing 87 playlists and proposes consolidated structure (~25-35 categories)
- [ ] User can approve, reject, or adjust proposed category consolidations
- [ ] System auto-categorizes 4,000 Watch Later videos into consolidated categories using ML
- [ ] User can review videos by category with thumbnail, title, and metadata
- [ ] User can preview videos during review (click through to watch)
- [ ] User can move videos between categories during review
- [ ] User can mark videos for deletion during review
- [ ] User can skip videos (leave uncategorized) during review
- [ ] System syncs new playlist structure to YouTube (create playlists, add videos)
- [ ] System archives old playlist structure before making changes
- [ ] System handles YouTube API quota limits gracefully
- [ ] System remembers category structure and patterns for future runs
- [ ] User can run categorization again on new Watch Later additions

### Out of Scope

- Real-time sync (batch operations only) — API quota limits make continuous sync impractical
- Mobile app — Web-first, focus on desktop workflow
- Multi-user collaboration — Single-user tool for personal library
- Video analytics/watch time tracking — Focus on organization, not analytics
- Export to other platforms — YouTube is the source of truth
- Desktop application (Electron) — Web app is simpler to maintain

## Context

**Current State:**
- 87 existing YouTube playlists with significant overlap and duplication
- 3,932 videos in Watch Later playlist (essentially lost/unfindable)
- Total 5,523 videos across all playlists
- Existing data exported to `data/Playlists/` directory
- Categories span technical topics (11ty, CSS, React), music (Bardcore, Post punk), food (recipes), and personal projects

**Problem:**
Watch Later has become a black hole. Videos are saved but never found again because there's no organization. Existing 87 categories are too fragmented and have duplicates/overlap.

**Goal:**
Transform Watch Later into a curated reference library organized into ~25-35 well-structured playlists that can be browsed on YouTube.

**Ongoing Tool:**
Not a one-time cleanup. User will return monthly/quarterly to categorize new Watch Later additions using learned patterns.

## Constraints

- **YouTube API Quota**: 10,000 units/day default — must batch operations and cache data
- **Tech Stack**: Web application (deployment target confirmed by user)
- **Data Ownership**: YouTube remains source of truth — tool is reorganization assistant only
- **Performance**: Must handle 4,000+ videos without UI freezing
- **Backup Required**: Must archive existing structure before any YouTube changes

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| AI-first categorization, not manual | 4,000 videos makes manual categorization impractical | — Pending |
| Consolidate categories before Watch Later | Cleaner target structure improves auto-categorization accuracy | — Pending |
| System proposes consolidation, user approves | Balance automation with user control over taxonomy | — Pending |
| Web app, not desktop (Electron) | Simpler deployment and maintenance | — Pending |
| YouTube as source of truth | Tool assists reorganization but YouTube is primary interface | — Pending |
| Preview capability during review | User needs to watch snippets to remember old videos | — Pending |

---
*Last updated: 2026-02-05 after initialization*
