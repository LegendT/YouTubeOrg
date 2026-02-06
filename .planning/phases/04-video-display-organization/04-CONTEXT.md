# Phase 4: Video Display & Organisation - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Browse, search, filter, and manually organise 4,000+ videos across categories with performant virtualised rendering. This is the primary video browsing interface. ML categorisation (Phase 5), review interface (Phase 6), and YouTube sync (Phase 8) are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Video card design
- Grid of cards layout (YouTube-style), 3-4 per row
- Full detail per card: thumbnail, title, channel name, duration, publish date, category badge, view count (if available)
- Duration overlay on thumbnail
- Coloured pill badge showing category name on each card
- Click opens video on YouTube in a new tab (simple, direct)

### Navigation & filtering
- Persistent left sidebar with category list
- Video counts always visible next to each category name
- "All Videos" entry at top of sidebar showing total count
- One category selected at a time, plus the "All Videos" view for cross-category browsing
- No multi-select of categories

### Sort options
- Claude's Discretion: pick sensible sort options based on available data (date added, publish date, title, channel, duration are candidates)

### Moving videos between categories
- Select + "Move to..." button as primary interaction (no drag-and-drop)
- Checkbox per card with "Select All" in toolbar
- Move is default behaviour (removes from source category)
- "Copy to..." option available to place video in multiple categories
- Confirmation dialog for bulk moves (5+ videos)
- Undo toast for single/small moves (Gmail-style, few seconds to undo)

### Search behaviour
- Default searches within current category; toggle to search all categories
- Filter grid in-place with result count banner ("23 results for 'react hooks'" with clear button)
- Searchable fields: title, channel name, and description
- Instant search with debounce (300ms) as user types

</decisions>

<specifics>
## Specific Ideas

- Grid layout should feel like YouTube's video grid — familiar card proportions with thumbnails
- Category badges as coloured pills (each category gets a distinct colour)
- Undo pattern matches Phase 3's existing undo toast pattern for consistency
- "All Videos" serves as the cross-category browsing view rather than multi-select

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-video-display-organization*
*Context gathered: 2026-02-06*
