import { pgTable, pgEnum, serial, text, integer, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';

// Playlists table - stores YouTube playlist metadata with ETag support
export const playlists = pgTable('playlists', {
  id: serial('id').primaryKey(),
  youtubeId: text('youtube_id').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  thumbnailUrl: text('thumbnail_url'),
  itemCount: integer('item_count').default(0),
  etag: text('etag'),
  lastFetched: timestamp('last_fetched').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Videos table - stores YouTube video metadata with ETag support
export const videos = pgTable('videos', {
  id: serial('id').primaryKey(),
  youtubeId: text('youtube_id').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  thumbnailUrl: text('thumbnail_url'),
  channelTitle: text('channel_title'),
  duration: text('duration'), // ISO 8601 duration format (e.g., "PT15M33S")
  publishedAt: timestamp('published_at'),
  etag: text('etag'),
  lastFetched: timestamp('last_fetched').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Playlist-Video join table - many-to-many relationship with position tracking
export const playlistVideos = pgTable('playlist_videos', {
  id: serial('id').primaryKey(),
  playlistId: integer('playlist_id').references(() => playlists.id).notNull(),
  videoId: integer('video_id').references(() => videos.id).notNull(),
  position: integer('position').notNull(),
  addedAt: timestamp('added_at').notNull().defaultNow(),
});

// Cache metadata table - stores full API responses with ETags for conditional requests
export const cacheMetadata = pgTable('cache_metadata', {
  id: serial('id').primaryKey(),
  cacheKey: text('cache_key').notNull().unique(),
  etag: text('etag'),
  data: jsonb('data'), // Store full API response for 304 Not Modified handling
  timestamp: timestamp('timestamp').notNull().defaultNow(),
});

// Quota usage tracking table - monitor daily YouTube API quota consumption
export const quotaUsage = pgTable('quota_usage', {
  id: serial('id').primaryKey(),
  date: timestamp('date').notNull().defaultNow(),
  unitsUsed: integer('units_used').notNull(),
  operation: text('operation').notNull(), // e.g., "playlists.list", "videos.list"
  details: jsonb('details'), // Request params, response summary
});

// Sync state tracking table - stores pagination progress for resumable syncs
export const syncState = pgTable('sync_state', {
  id: serial('id').primaryKey(),
  playlistYoutubeId: text('playlist_youtube_id').notNull().unique(),
  nextPageToken: text('next_page_token'),
  itemsFetched: integer('items_fetched').default(0),
  lastSyncAt: timestamp('last_sync_at').notNull().defaultNow(),
});

// --- Phase 2: Playlist Analysis & Consolidation ---

// Enum for consolidation proposal status
export const proposalStatusEnum = pgEnum('proposal_status', ['pending', 'approved', 'rejected']);

// Enum for algorithm mode presets
export const algorithmModeEnum = pgEnum('algorithm_mode', ['conservative', 'aggressive']);

// Analysis sessions table - tracks multi-session staleness detection
export const analysisSessions = pgTable('analysis_sessions', {
  id: serial('id').primaryKey(),
  mode: algorithmModeEnum('mode').notNull().default('aggressive'),
  playlistCount: integer('playlist_count').notNull(),
  proposalCount: integer('proposal_count').notNull().default(0),
  duplicateCount: integer('duplicate_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  playlistDataTimestamp: timestamp('playlist_data_timestamp').notNull(), // When playlist data was last synced - used for staleness detection
  finalizedAt: timestamp('finalized_at'), // Set when user executes consolidation, marks session as target for future phases
});

// Consolidation proposals table - stores proposed category merges for user review
export const consolidationProposals = pgTable('consolidation_proposals', {
  id: serial('id').primaryKey(),
  categoryName: text('category_name').notNull(),
  sourcePlaylistIds: jsonb('source_playlist_ids').$type<number[]>().notNull(),
  totalVideos: integer('total_videos').notNull(),
  status: proposalStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  approvedAt: timestamp('approved_at'),
  notes: text('notes'), // User comments on this proposal
  sessionId: integer('session_id').references(() => analysisSessions.id), // Nullable for backward compat with Plan 02-01
  confidenceScore: integer('confidence_score'), // 0-100 confidence in the proposed merge
  confidenceReason: text('confidence_reason'), // Human-readable explanation of confidence
  uniqueVideoCount: integer('unique_video_count'), // Deduplicated video count across merged playlists
  duplicateVideoCount: integer('duplicate_video_count'), // How many dupes found within this proposal's playlists
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Duplicate videos table - tracks videos appearing in multiple playlists
export const duplicateVideos = pgTable('duplicate_videos', {
  id: serial('id').primaryKey(),
  videoId: integer('video_id').references(() => videos.id).notNull(),
  playlistIds: jsonb('playlist_ids').$type<number[]>().notNull(),
  occurrenceCount: integer('occurrence_count').notNull(),
  analyzedAt: timestamp('analyzed_at').notNull().defaultNow(),
  resolvedPlaylistId: integer('resolved_playlist_id'), // Which playlist "wins" for this duplicate
  sessionId: integer('session_id').references(() => analysisSessions.id), // Nullable for backward compat
});

// --- Phase 3: Category Management ---

// Categories table - proper category entities created from finalized Phase 2 proposals
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  sourceProposalId: integer('source_proposal_id').references(() => consolidationProposals.id), // Tracks origin for traceability
  videoCount: integer('video_count').notNull().default(0), // Denormalized for fast list rendering -- avoids COUNT joins
  isProtected: boolean('is_protected').notNull().default(false), // true for "Uncategorized" -- prevents rename/delete
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Category-Video join table - many-to-many relationship between categories and individual videos
export const categoryVideos = pgTable('category_videos', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id').references(() => categories.id, { onDelete: 'cascade' }).notNull(),
  videoId: integer('video_id').references(() => videos.id).notNull(),
  addedAt: timestamp('added_at').notNull().defaultNow(),
  source: text('source').default('consolidation'), // Values: 'consolidation', 'manual', 'merge', 'orphan', 'undo'
});

// --- Phase 5: ML Categorization Engine ---

// Confidence level enum for ML categorization results
export const confidenceLevelEnum = pgEnum('confidence_level', ['HIGH', 'MEDIUM', 'LOW']);

// ML Categorizations table - stores auto-categorization results from Transformers.js
export const mlCategorizations = pgTable('ml_categorizations', {
  id: serial('id').primaryKey(),
  videoId: integer('video_id').references(() => videos.id, { onDelete: 'cascade' }).notNull(),
  suggestedCategoryId: integer('suggested_category_id').references(() => categories.id, { onDelete: 'cascade' }).notNull(),
  confidence: confidenceLevelEnum('confidence').notNull(),
  similarityScore: integer('similarity_score').notNull(), // Store as 0-100 integer (score * 100) for easier display
  modelVersion: text('model_version').notNull().default('all-MiniLM-L6-v2'), // Track model for future upgrades
  createdAt: timestamp('created_at').notNull().defaultNow(),
  acceptedAt: timestamp('accepted_at'), // Set when user accepts the suggestion
  rejectedAt: timestamp('rejected_at'), // Set when user explicitly rejects
  manualCategoryId: integer('manual_category_id').references(() => categories.id), // If user picks different category
});

// Index for efficient querying by video (review interface)
// CREATE INDEX idx_ml_cat_video ON ml_categorizations(video_id);

// Index for filtering by confidence level (low-confidence review workflow)
// CREATE INDEX idx_ml_cat_confidence ON ml_categorizations(confidence, created_at);

// --- Phase 7: Safety & Archive System ---

// Backup snapshots table - metadata for JSON backup files stored on the filesystem
export const backupSnapshots = pgTable('backup_snapshots', {
  id: serial('id').primaryKey(),
  filename: text('filename').notNull().unique(),
  trigger: text('trigger').notNull(),
  scope: text('scope').notNull(),
  entityCount: integer('entity_count').notNull(),
  fileSizeBytes: integer('file_size_bytes').notNull(),
  checksum: text('checksum').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Operation log table - append-only audit trail for all destructive/important operations
export const operationLog = pgTable('operation_log', {
  id: serial('id').primaryKey(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityIds: jsonb('entity_ids').$type<number[]>().notNull(),
  metadata: jsonb('metadata'),
  backupSnapshotId: integer('backup_snapshot_id').references(() => backupSnapshots.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
