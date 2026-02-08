import { pgTable, unique, serial, text, jsonb, timestamp, foreignKey, integer, boolean, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const algorithmMode = pgEnum("algorithm_mode", ['conservative', 'aggressive'])
export const confidenceLevel = pgEnum("confidence_level", ['HIGH', 'MEDIUM', 'LOW'])
export const proposalStatus = pgEnum("proposal_status", ['pending', 'approved', 'rejected'])


export const cacheMetadata = pgTable("cache_metadata", {
	id: serial().primaryKey().notNull(),
	cacheKey: text("cache_key").notNull(),
	etag: text(),
	data: jsonb(),
	timestamp: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("cache_metadata_cache_key_unique").on(table.cacheKey),
]);

export const mlCategorisations = pgTable("ml_categorisations", {
	id: serial().primaryKey().notNull(),
	videoId: integer("video_id").notNull(),
	suggestedCategoryId: integer("suggested_category_id").notNull(),
	confidence: confidenceLevel().notNull(),
	similarityScore: integer("similarity_score").notNull(),
	modelVersion: text("model_version").default('all-MiniLM-L6-v2').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	acceptedAt: timestamp("accepted_at", { mode: 'string' }),
	rejectedAt: timestamp("rejected_at", { mode: 'string' }),
	manualCategoryId: integer("manual_category_id"),
}, (table) => [
	foreignKey({
			columns: [table.videoId],
			foreignColumns: [videos.id],
			name: "ml_categorisations_video_id_videos_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.suggestedCategoryId],
			foreignColumns: [categories.id],
			name: "ml_categorisations_suggested_category_id_categories_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.manualCategoryId],
			foreignColumns: [categories.id],
			name: "ml_categorisations_manual_category_id_categories_id_fk"
		}),
]);

export const quotaUsage = pgTable("quota_usage", {
	id: serial().primaryKey().notNull(),
	date: timestamp({ mode: 'string' }).defaultNow().notNull(),
	unitsUsed: integer("units_used").notNull(),
	operation: text().notNull(),
	details: jsonb(),
});

export const videos = pgTable("videos", {
	id: serial().primaryKey().notNull(),
	youtubeId: text("youtube_id").notNull(),
	title: text().notNull(),
	description: text(),
	thumbnailUrl: text("thumbnail_url"),
	channelTitle: text("channel_title"),
	duration: text(),
	publishedAt: timestamp("published_at", { mode: 'string' }),
	etag: text(),
	lastFetched: timestamp("last_fetched", { mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	deletedFromYoutubeAt: timestamp("deleted_from_youtube_at", { mode: 'string' }),
}, (table) => [
	unique("videos_youtube_id_unique").on(table.youtubeId),
]);

export const playlists = pgTable("playlists", {
	id: serial().primaryKey().notNull(),
	youtubeId: text("youtube_id").notNull(),
	title: text().notNull(),
	description: text(),
	thumbnailUrl: text("thumbnail_url"),
	itemCount: integer("item_count").default(0),
	etag: text(),
	lastFetched: timestamp("last_fetched", { mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("playlists_youtube_id_unique").on(table.youtubeId),
]);

export const playlistVideos = pgTable("playlist_videos", {
	id: serial().primaryKey().notNull(),
	playlistId: integer("playlist_id").notNull(),
	videoId: integer("video_id").notNull(),
	position: integer().notNull(),
	addedAt: timestamp("added_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.playlistId],
			foreignColumns: [playlists.id],
			name: "playlist_videos_playlist_id_playlists_id_fk"
		}),
	foreignKey({
			columns: [table.videoId],
			foreignColumns: [videos.id],
			name: "playlist_videos_video_id_videos_id_fk"
		}),
]);

export const syncState = pgTable("sync_state", {
	id: serial().primaryKey().notNull(),
	playlistYoutubeId: text("playlist_youtube_id").notNull(),
	nextPageToken: text("next_page_token"),
	itemsFetched: integer("items_fetched").default(0),
	lastSyncAt: timestamp("last_sync_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("sync_state_playlist_youtube_id_unique").on(table.playlistYoutubeId),
]);

export const consolidationProposals = pgTable("consolidation_proposals", {
	id: serial().primaryKey().notNull(),
	categoryName: text("category_name").notNull(),
	sourcePlaylistIds: jsonb("source_playlist_ids").notNull(),
	totalVideos: integer("total_videos").notNull(),
	status: proposalStatus().default('pending').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	approvedAt: timestamp("approved_at", { mode: 'string' }),
	notes: text(),
	sessionId: integer("session_id"),
	confidenceScore: integer("confidence_score"),
	confidenceReason: text("confidence_reason"),
	uniqueVideoCount: integer("unique_video_count"),
	duplicateVideoCount: integer("duplicate_video_count"),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [analysisSessions.id],
			name: "consolidation_proposals_session_id_analysis_sessions_id_fk"
		}),
]);

export const duplicateVideos = pgTable("duplicate_videos", {
	id: serial().primaryKey().notNull(),
	videoId: integer("video_id").notNull(),
	playlistIds: jsonb("playlist_ids").notNull(),
	occurrenceCount: integer("occurrence_count").notNull(),
	analyzedAt: timestamp("analyzed_at", { mode: 'string' }).defaultNow().notNull(),
	resolvedPlaylistId: integer("resolved_playlist_id"),
	sessionId: integer("session_id"),
}, (table) => [
	foreignKey({
			columns: [table.videoId],
			foreignColumns: [videos.id],
			name: "duplicate_videos_video_id_videos_id_fk"
		}),
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [analysisSessions.id],
			name: "duplicate_videos_session_id_analysis_sessions_id_fk"
		}),
]);

export const backupSnapshots = pgTable("backup_snapshots", {
	id: serial().primaryKey().notNull(),
	filename: text().notNull(),
	trigger: text().notNull(),
	scope: text().notNull(),
	entityCount: integer("entity_count").notNull(),
	fileSizeBytes: integer("file_size_bytes").notNull(),
	checksum: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("backup_snapshots_filename_unique").on(table.filename),
]);

export const operationLog = pgTable("operation_log", {
	id: serial().primaryKey().notNull(),
	action: text().notNull(),
	entityType: text("entity_type").notNull(),
	entityIds: jsonb("entity_ids").notNull(),
	metadata: jsonb(),
	backupSnapshotId: integer("backup_snapshot_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.backupSnapshotId],
			foreignColumns: [backupSnapshots.id],
			name: "operation_log_backup_snapshot_id_backup_snapshots_id_fk"
		}),
]);

export const analysisSessions = pgTable("analysis_sessions", {
	id: serial().primaryKey().notNull(),
	mode: algorithmMode().default('aggressive').notNull(),
	playlistCount: integer("playlist_count").notNull(),
	proposalCount: integer("proposal_count").default(0).notNull(),
	duplicateCount: integer("duplicate_count").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	playlistDataTimestamp: timestamp("playlist_data_timestamp", { mode: 'string' }).notNull(),
	finalizedAt: timestamp("finalized_at", { mode: 'string' }),
});

export const syncJobs = pgTable("sync_jobs", {
	id: serial().primaryKey().notNull(),
	stage: text().default('pending').notNull(),
	currentStageProgress: integer("current_stage_progress").default(0).notNull(),
	currentStageTotal: integer("current_stage_total").default(0).notNull(),
	stageResults: jsonb("stage_results").default({}).notNull(),
	errors: jsonb().default([]).notNull(),
	quotaUsedThisSync: integer("quota_used_this_sync").default(0).notNull(),
	pauseReason: text("pause_reason"),
	previewData: jsonb("preview_data"),
	startedAt: timestamp("started_at", { mode: 'string' }).defaultNow().notNull(),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	lastResumedAt: timestamp("last_resumed_at", { mode: 'string' }),
	backupSnapshotId: integer("backup_snapshot_id"),
}, (table) => [
	foreignKey({
			columns: [table.backupSnapshotId],
			foreignColumns: [backupSnapshots.id],
			name: "sync_jobs_backup_snapshot_id_backup_snapshots_id_fk"
		}),
]);

export const syncVideoOperations = pgTable("sync_video_operations", {
	id: serial().primaryKey().notNull(),
	syncJobId: integer("sync_job_id").notNull(),
	categoryId: integer("category_id").notNull(),
	videoId: integer("video_id").notNull(),
	youtubeVideoId: text("youtube_video_id").notNull(),
	status: text().default('pending').notNull(),
	errorMessage: text("error_message"),
	completedAt: timestamp("completed_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.syncJobId],
			foreignColumns: [syncJobs.id],
			name: "sync_video_operations_sync_job_id_sync_jobs_id_fk"
		}),
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [categories.id],
			name: "sync_video_operations_category_id_categories_id_fk"
		}),
	foreignKey({
			columns: [table.videoId],
			foreignColumns: [videos.id],
			name: "sync_video_operations_video_id_videos_id_fk"
		}),
]);

export const categoryVideos = pgTable("category_videos", {
	id: serial().primaryKey().notNull(),
	categoryId: integer("category_id").notNull(),
	videoId: integer("video_id").notNull(),
	addedAt: timestamp("added_at", { mode: 'string' }).defaultNow().notNull(),
	source: text().default('consolidation'),
}, (table) => [
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [categories.id],
			name: "category_videos_category_id_categories_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.videoId],
			foreignColumns: [videos.id],
			name: "category_videos_video_id_videos_id_fk"
		}),
]);

export const categories = pgTable("categories", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	sourceProposalId: integer("source_proposal_id"),
	videoCount: integer("video_count").default(0).notNull(),
	isProtected: boolean("is_protected").default(false).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	youtubePlaylistId: text("youtube_playlist_id"),
}, (table) => [
	foreignKey({
			columns: [table.sourceProposalId],
			foreignColumns: [consolidationProposals.id],
			name: "categories_source_proposal_id_consolidation_proposals_id_fk"
		}),
]);
