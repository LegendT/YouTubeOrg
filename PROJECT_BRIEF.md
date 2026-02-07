# YouTube Playlist Organizer - Project Brief

## Project Overview

A desktop/web application that helps organize YouTube playlists by providing an intuitive UI to categorize videos from a large "Watch Later" playlist into curated category playlists, with the ability to re-evaluate and update existing categories.

## Problem Statement

- Multiple existing playlist categories that need re-evaluation and cleanup
- Large "Watch Later" playlist containing uncategorized videos
- Need for manual verification to ensure videos are placed in correct categories
- Requirement to update YouTube playlists with newly organized structure

## Goals and Objectives

### Primary Goals
1. **Categorize** videos from Watch Later playlist into appropriate categories
2. **Re-evaluate** existing playlist categories and their contents
3. **Verify** video categorization through an intuitive UI
4. **Sync** updated playlist structure back to YouTube

### Success Criteria
- All videos from Watch Later playlist are categorized
- Existing playlists are cleaned up and reorganized
- New category structure is uploaded to YouTube
- Old/redundant playlists are removed
- User can easily verify and adjust categorization decisions

## Key Features

### 1. YouTube Data Import
- Connect to YouTube API
- Fetch all existing playlists
- Import Watch Later playlist contents
- Retrieve video metadata (title, thumbnail, description, channel, duration, etc.)

### 2. Category Management
- View existing playlist categories
- Create new categories
- Rename/edit categories
- Delete categories
- Merge categories

### 3. Video Categorization Interface
- Display videos with thumbnails, titles, and metadata
- Drag-and-drop or click-based categorization
- Batch operations (multi-select videos)
- Search and filter videos
- View video details before categorizing
- Preview video playback option

### 4. Smart Suggestions (Optional Enhancement)
- AI/ML-based category suggestions based on:
  - Video title and description
  - Channel name
  - Existing categorization patterns
  - Video tags/keywords

### 5. Verification & Review
- View all categories with their assigned videos
- Review videos in each category
- Move videos between categories
- Mark videos for deletion or "uncategorized"
- Highlight potential duplicates

### 6. YouTube Sync
- Preview changes before upload
- Remove old playlists from YouTube
- Create new playlists with updated structure
- Update playlist descriptions and privacy settings
- Handle API rate limits gracefully
- Rollback capability if sync fails

## Technical Requirements

### Authentication & Authorization
- OAuth 2.0 authentication with YouTube
- Required scopes:
  - `youtube.readonly` - Read playlist data
  - `youtube.force-ssl` - Manage playlists
  - `youtube` - Full access for playlist deletion/creation

### Technology Stack Considerations

#### Backend Options
- **Python**: YouTube API client library well-supported
- **Node.js**: Good async handling for API calls
- **FastAPI/Flask**: For REST API if building web app

#### Frontend Options
- **Electron**: Desktop app with web technologies
- **React/Vue/Svelte**: Modern web frameworks
- **Next.js**: Full-stack option with good DX

#### Database
- **SQLite**: Simple, local storage for development
- **PostgreSQL**: If scaling or multi-user needed
- Store: videos, categories, mappings, sync state

### YouTube API Considerations
- Quota limits: 10,000 units/day (default)
- List operations: 1 unit
- Insert/delete operations: 50 units
- Batch operations where possible
- Cache video data to minimize API calls

## Data Model

### Core Entities

```
Video
- id (YouTube video ID)
- title
- description
- thumbnail_url
- channel_name
- channel_id
- duration
- published_at
- current_playlist_id
- new_category_id
- status (pending, categorized, reviewed)

Category
- id
- name
- description
- color (for UI)
- is_existing (from YouTube)
- playlist_id (YouTube playlist ID)
- video_count

CategoryMapping
- video_id
- category_id
- confidence_score (if using suggestions)
- user_verified (boolean)
- created_at

SyncState
- last_sync_at
- playlists_to_delete
- playlists_to_create
- sync_status
```

## User Flow

### Initial Setup
1. User launches application
2. Authenticates with YouTube
3. App fetches all playlists and Watch Later content
4. App displays current state

### Categorization Workflow
1. View Watch Later videos (paginated/infinite scroll)
2. For each video:
   - View thumbnail and metadata
   - Assign to category (manual or accept suggestion)
   - Option to preview video
3. Review existing playlists:
   - Check if categories still make sense
   - Move videos between categories
   - Merge or split categories

### Review Phase
1. View all categories with assigned videos
2. Verify categorization is correct
3. Make adjustments as needed
4. Mark as ready for sync

### Sync Phase
1. Review planned changes
2. Confirm deletion of old playlists
3. Execute sync to YouTube
4. Monitor progress
5. Handle errors gracefully
6. Confirm completion

## UI/UX Requirements

### Key Screens

1. **Dashboard**
   - Overview of Watch Later count
   - Category summary
   - Progress tracking

2. **Categorization View**
   - Grid/list of videos
   - Category sidebar/panel
   - Quick actions toolbar

3. **Category Management**
   - List of all categories
   - Edit/delete/merge options
   - Video count per category

4. **Review View**
   - Category-by-category review
   - Bulk edit capabilities

5. **Sync View**
   - Preview changes
   - Progress indicator
   - Success/error messages

### UX Principles
- Minimize clicks for common actions
- Keyboard shortcuts for power users
- Undo/redo functionality
- Auto-save progress
- Clear visual feedback
- Responsive design (if web)

## Development Phases

### Phase 1: Foundation (MVP)
- YouTube API integration
- Basic authentication
- Fetch playlists and videos
- Simple categorization UI
- Local data storage
- Manual categorization only

### Phase 2: Enhancement
- Improved UI/UX
- Search and filtering
- Batch operations
- Category management features
- Preview changes before sync

### Phase 3: Sync Implementation
- YouTube playlist deletion
- YouTube playlist creation
- Error handling and rollback
- Progress tracking

### Phase 4: Advanced Features (Optional)
- AI-powered suggestions
- Duplicate detection
- Video analytics/insights
- Export/import configuration
- Multi-user support

## Risks and Challenges

### Technical Risks
1. **YouTube API Quota Limits**
   - Risk: Running out of daily quota
   - Mitigation: Cache data, batch operations, request quota increase

2. **Rate Limiting**
   - Risk: API throttling during sync
   - Mitigation: Implement exponential backoff, show progress

3. **Data Loss**
   - Risk: Accidental deletion of playlists
   - Mitigation: Backup before sync, confirmation dialogs, rollback capability

4. **Large Dataset Performance**
   - Risk: Slow UI with thousands of videos
   - Mitigation: Pagination, virtualization, lazy loading

### User Experience Risks
1. **Complex Categorization**
   - Risk: Too many decisions overwhelming user
   - Mitigation: Smart defaults, suggestions, batch operations

2. **Sync Errors**
   - Risk: Partial sync failures
   - Mitigation: Transaction-like behavior, clear error messages

## Security Considerations

- Store OAuth tokens securely (encrypted)
- Never log or expose access tokens
- Use HTTPS for all API communications
- Implement token refresh logic
- Clear sensitive data on logout
- Follow YouTube API Terms of Service

## Performance Targets

- Initial playlist load: < 5 seconds
- Video categorization action: < 200ms
- Search/filter response: < 500ms
- Sync operation: Show progress, no UI freeze
- Support: 10,000+ videos in Watch Later

## Future Enhancements

1. **Smart Features**
   - ML-based category suggestions
   - Automatic categorization based on history
   - Duplicate video detection
   - Watch time analytics

2. **Collaboration**
   - Share category templates
   - Import/export configurations
   - Community category definitions

3. **Integration**
   - Export to other platforms
   - Backup to cloud storage
   - Integration with note-taking apps

4. **Analytics**
   - Category distribution charts
   - Watch time by category
   - Channel analysis
   - Topic clustering

## Current State Analysis

### Existing Playlists: 87 categories
Location: `data/Playlists/`

**Top Categories by Video Count:**
1. Watch later - 3,932 videos
2. Crofters - 116 videos
3. Bardcore - 94 videos
4. Easton Chop Up - 88 videos
5. Reason - 81 videos
6. recipies - 66 videos
7. Post punk - 60 videos
8. Design Systems - 48 videos
9. FishStock 2023 - 47 videos
10. reneblueprint - 45 videos

**Category Themes Identified:**
- **Technical/Development**: 11ty, AEM, AGILE, AI, Accessibility, Builder.io, CSS, Drupal, Figma, git, html emails, JS, Jekyll, React, Vue, Webpack, Storybook, web components, etc.
- **Music**: Bardcore, Post punk, Music Vids, MUSIC, Music 4 Róisín
- **Food**: recipies, Recipes - Low Carb, Air Fryer, Food
- **Personal Projects**: Crofters, Easton Chop Up, reneblueprint, FishStock 2023, ECU-Vids
- **Business/Career**: AGILE, Product (Owner), Scrum Master, Dropshipping, SEO
- **Content/Media**: twitch, VJ, OBS, Screen Printing
- **Other**: Politics, Religion, NFTs, Crypto, Street, Underbelly

**Data Issues Observed:**
- Inconsistent naming (e.g., "recipies" vs "Recipes - Low Carb")
- Duplicate categories (e.g., "Storybook" and "storybook-videos(1)")
- Very small categories (many with only 1-2 videos)
- Broad overlap potential (e.g., CSS-related spread across multiple lists)

Total videos across all playlists: **5,523** (including duplicates)

## Project Requirements (CONFIRMED)

1. **Current Categories**: 87 playlists located in `data/Playlists/`
2. **Watch Later Size**: 3,932 videos
3. **Deployment**: Web application
4. **Approach**: Complete rebuild with archiving of existing structure
5. **Backup**: Yes - archive existing playlists before changes

## Recommendations

### Category Consolidation Opportunities
Given the 87 existing categories with many small/overlapping ones, consider:
1. **Merge CSS-related**: Combine "css", "css animations", "CSS Animations _ Transitions", "css grid", "css tidbit"
2. **Consolidate Recipes**: Merge "recipies", "Recipes - Low Carb", "Food", "Air Fryer"
3. **Tech Stack Grouping**: Group related technologies (e.g., all CMS platforms, all JS frameworks)
4. **Archive Small Categories**: Categories with <5 videos might be better as tags or merged
5. **Personal vs Public**: Separate personal project playlists from educational/reference content

### Priority Actions
1. Archive existing playlist structure (CSV export already available)
2. Design new category taxonomy based on usage patterns
3. Build web UI for categorization workflow
4. Implement AI suggestions to speed up 3,932 video categorization
5. Review and verify categorization in batches
6. Sync new structure to YouTube

## Next Steps

1. **Setup Phase**
   - Choose technology stack (Python + FastAPI + React recommended)
   - Set up YouTube API credentials (OAuth 2.0)
   - Initialize project structure
   - Set up database (SQLite for MVP)

2. **Development Phase 1 - Data Import**
   - Import existing CSV data
   - Fetch full video metadata from YouTube API
   - Build category management interface
   - Create backup/archive functionality

3. **Development Phase 2 - Categorization UI**
   - Build video grid/list view
   - Implement drag-and-drop categorization
   - Add search and filtering
   - Create batch operations
   - Implement AI-powered category suggestions

4. **Development Phase 3 - Review & Sync**
   - Build review interface
   - Implement YouTube sync functionality
   - Add progress tracking
   - Create rollback mechanism

5. **Testing & Launch**
   - User acceptance testing
   - Fix issues and refine UX
   - Execute full sync to YouTube
   - Archive old structure

---

**Document Version**: 1.1
**Last Updated**: 2026-02-05
**Status**: Requirements Confirmed - Ready for Development
