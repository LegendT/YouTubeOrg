import { pgTable, serial, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';

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
