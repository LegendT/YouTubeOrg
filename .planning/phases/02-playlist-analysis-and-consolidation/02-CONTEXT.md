# Phase 2: Playlist Analysis & Consolidation - Context

**Gathered:** 2026-02-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Analyze 87 existing playlists for overlaps and duplicates, propose intelligent consolidation into ~25-35 categories, and enable user to review analysis, approve proposals, or manually adjust the structure. This phase establishes the target category structure that will guide ML categorization of Watch Later videos in Phase 5.

</domain>

<decisions>
## Implementation Decisions

### Analysis Visualization - Primary View

- **Category-centric view**: Display proposed categories with merge information (not playlist-centric or duplicate-centric)
- **Side-by-side panels**: Categories list on left, detail panel on right when selected
- **User can toggle layout**: Switch between horizontal and vertical split based on preference
- **Analysis summary**: Overview card at top showing key stats ("87 playlists → 28 proposed categories, 234 duplicates found, 15 validation warnings")
- **Alphabetical default sort**: Categories sorted A-Z by default
- **Sort options available**: Sort by video count, source playlist count, or confidence score (no filtering capabilities)
- **Separate "Review needed" section**: Unmatched playlists grouped separately for manual decision

### Analysis Visualization - Category Details

- **Comprehensive metrics per category**:
  - Total unique videos after deduplication
  - Source playlist breakdown with individual contributions
  - Overlap insights (duplicate counts)
  - Example: "JavaScript: 247 unique videos from 3 playlists (JS Basics: 87, JS Advanced: 120, Web Dev: 42), 15 duplicates removed"
- **Extended metadata in video lists**: Thumbnail, title, duration, channel name, publish date
- **Pagination with options**: 50, 100, 250, or all videos per page (default: 50)
- **Search and filter within details**: Filter video list by title search and by source playlist
- **Video preview**: YouTube link (click to open in new tab)

### Analysis Visualization - Duplicates & Conflicts

- **Detailed conflict view**: Show each duplicate with all source playlists listed, let user choose which version to keep
- **Smart default with override**: Apply "keep from most specific playlist" rule by default (longer, more descriptive playlist names preferred), allow manual override per video
- **Bulk duplicate resolution**: Multi-select duplicate conflicts (checkboxes), apply resolution rule to selection
- **Preview before applying**: Show preview ("This will keep 15 videos from 'JavaScript Advanced', remove 15 from 'JS Basics'") before bulk resolution

### Analysis Visualization - Confidence & Reasoning

- **Both score and reasoning displayed**:
  - Color-coded confidence badge: HIGH (green), MEDIUM (yellow), LOW (red)
  - Reasoning text with moderate detail: "Name similarity: 85%, Video overlap: 45% (120/267 videos), Common themes detected"
- **Expandable duplicate list**: "15 duplicates (click to view)" expands to show specific videos

### Analysis Visualization - Validation & Warnings

- **Category size indicators**: Color-coded badge (Green <3000, Yellow 3000-4500, Red >4500) + progress bar showing "2,450 / 5,000 videos"
- **Inline validation messages**: Warnings appear in detail panel when category selected (not banner at top)
- **Pre-approval check only**: Validate limits when user tries to finalize all changes (not real-time)

### Analysis Visualization - Progress & Status

- **All progress indicators**:
  - Counter: "Reviewed: 12/25 categories"
  - Status badges: Approved (✓), Rejected (✗), Pending (○) on each category in list
  - Progress bar: Visual completion percentage
- **Auto-save state**: All approvals/rejections saved automatically, resume anytime
- **Multi-session staleness detection**: Auto-detect if new videos added to Watch Later; any new videos trigger re-analysis prompt

### Analysis Visualization - Interaction & Navigation

- **Both click and keyboard navigation**: Full keyboard navigation (arrow keys, Enter) with mouse as alternative
- **Keyboard shortcuts documented elsewhere**: No in-app shortcut reference overlay needed
- **Contextual hints**: Small hints appear near features explaining what they do (no tooltip tour)
- **Batch operations**: Checkbox selection with approve/reject actions on multiple categories
- **No color coding**: Plain text with icons and badges only (no auto-assigned or user-assigned colors)

### Analysis Execution & Configuration

- **Preset algorithm modes**: Conservative (fewer merges, high confidence) vs Aggressive (more merges, lower threshold)
- **Aggressive as default**: Start with aggressive mode to maximize automation, user can switch if needed
- **Manual refresh button**: "Re-analyze" button to recalculate proposals after manual adjustments
- **Loading state with stages**: "Detecting duplicates... (1/3)" → "Clustering playlists... (2/3)" → "Generating proposals... (3/3)"
- **Error handling**: Error message with retry button on analysis failure
- **Empty analysis fallback**: If no merges found, prompt "No automatic merges found. Would you like to manually consolidate?"

### Analysis Data Management

- **No export capability**: Analysis lives only in the app (no JSON or HTML export)
- **Category name editing**: Accept proposal first, rename in Category Management (Phase 3) - not during analysis

### Consolidation Proposal Presentation

- **Natural language summary + structured sections**:
  - Summary: "This category combines 'JavaScript Basics', 'JS Advanced', and 'Web Dev' into 'JavaScript' because of similar naming and 45% video overlap"
  - Structured sections: Source Playlists, Proposed Name, Reasoning (moderate detail), Impact
- **Source playlist display**: Name and video count ("JavaScript Basics (87 videos)")
- **Comprehensive impact preview**:
  - Video count change: "87 + 120 + 60 = 267 unique videos (15 duplicates removed)"
  - Before/after comparison
  - Action summary: "Will create 'JavaScript' playlist, move 267 videos, delete 3 source playlists"
- **Action buttons at bottom**: Approve/reject buttons placed at bottom of detail panel (after review)

### Manual Adjustment Mechanics

- **All adjustment methods available**:
  - Edit in place (add/remove source playlists)
  - Reject and recreate (build from scratch)
  - Split/merge actions (specific operations)
- **Add playlists to proposal**: "Add playlist" button opens selector to choose additional playlists
- **Remove playlists from proposal**: "X" button on each source playlist in proposal view
- **Create new category during analysis**: Add button to create category and multi-select playlists to assign
- **Split proposal capability**: Both "Split this proposal" button and reject/recreate options available
- **Split workflow**: Guided wizard (How many categories? → Name each → Assign playlists to each)
- **Real-time metric updates**: After manual changes, all metrics recalculate (counts, confidence, reasoning, validation status)
- **Rejected proposals handling**: Move to "Review needed" section for manual decision later

### Approval and Execution Flow

- **Flexible approval workflow**: Support both individual category approval and batch approval (checkbox selection)
- **Final review screen**: Before execution, show comprehensive review:
  - Summary statistics: "25 categories to create, 82 playlists to merge, 234 duplicates to remove"
  - Detailed change list: Every individual change listed
  - Impact visualization: Before/after structure comparison
- **Execution confirmation**: Single "Execute consolidation" button to proceed (no type-to-confirm or checkboxes needed)

### Claude's Discretion

- Exact algorithm parameters for detecting overlaps and clustering playlists
- UI animation and transition timing
- Error message copy and tone
- Icon selection for status badges
- Hover state and focus indicator styling

</decisions>

<specifics>
## Specific Ideas

- Keep from most specific playlist: When resolving duplicates, prefer videos from playlists with longer, more descriptive names (e.g., "Advanced JavaScript Patterns" over "JS")
- Aggressive mode default: Start with more aggressive consolidation to maximize automation and reduce manual work, since user can always reject or adjust proposals
- 50 videos per page: Default pagination keeps load times fast while showing enough content to be useful

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-playlist-analysis-and-consolidation*
*Context gathered: 2026-02-06*
