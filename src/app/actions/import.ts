'use server';

/**
 * Import Server Actions
 *
 * Orchestrates CSV parsing and Watch Later playlist creation for the
 * Google Takeout import flow. Receives CSV text (already read client-side
 * via FileReader), validates it, creates the playlist entry, and returns
 * parsed data for downstream batch processing.
 *
 * Follows the established server action pattern: never throws, always
 * returns structured { success, error? } responses.
 */

import { auth } from '@/lib/auth/config';
import { parseWatchLaterCSV } from '@/lib/import/csv-parser';
import type { ParsedCSVRow } from '@/lib/import/csv-parser';
import { ensureWatchLaterPlaylist } from '@/lib/import/watch-later';
import { db } from '@/lib/db';
import { videos, playlistVideos } from '@/lib/db/schema';
import { fetchVideoBatch } from '@/lib/youtube/videos';
import { eq, inArray } from 'drizzle-orm';

/**
 * Parse a Watch Later CSV export and initialise the import.
 *
 * Steps:
 * 1. Verify the user is authenticated
 * 2. Parse the CSV text and validate its format
 * 3. Upsert the Watch Later playlist in the database
 * 4. Return parsed rows + playlist DB ID for batch metadata enrichment
 *
 * @param csvText - Raw CSV content read by the client via FileReader.readAsText()
 * @returns Structured result with parsed rows and playlist ID, or error message
 */
export async function parseAndInitialiseImport(csvText: string): Promise<{
  success: boolean;
  error?: string;
  playlistDbId?: number;
  rows?: ParsedCSVRow[];
  totalCount?: number;
}> {
  // Step 1: Authentication check
  const session = await auth();
  if (!session?.access_token) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    // Step 2: Parse and validate CSV
    const result = parseWatchLaterCSV(csvText);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Step 3: Create or update the Watch Later playlist entry
    const playlistDbId = await ensureWatchLaterPlaylist(result.totalCount);

    // Step 4: Return parsed data for downstream batch processing
    return {
      success: true,
      playlistDbId,
      rows: result.rows,
      totalCount: result.totalCount,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Import failed: ${message}` };
  }
}

/**
 * Enrich a batch of video IDs with metadata from the YouTube API.
 *
 * Designed to be called in a client-driven loop: the client passes ALL video
 * IDs from the parsed CSV and increments `startIndex` by `batchSize` on each
 * iteration. This keeps each server action invocation short (~1 API call for
 * 50 videos) and lets the client update progress between batches.
 *
 * Behaviour:
 * - Videos already in the database are skipped (quota conservation for re-import)
 * - New videos are fetched via the existing fetchVideoBatch function (which
 *   handles API call, DB upsert, and quota tracking internally)
 * - Deleted/private videos not returned by the API get placeholder records
 *   with title '[Unavailable Video]' so foreign key constraints are satisfied
 *   when creating playlist-video relationships (13-03)
 *
 * @param videoIds - Full array of video IDs from the parsed CSV
 * @param startIndex - Index into videoIds to start this batch from
 * @param batchSize - Number of IDs to process in this batch (default 50)
 * @returns Structured counts of processed, unavailable, and skipped videos
 */
export async function importMetadataBatch(
  videoIds: string[],
  startIndex: number,
  batchSize: number = 50
): Promise<{
  success: boolean;
  processed: number;
  unavailable: number;
  skipped: number;
  error?: string;
}> {
  // Step 1: Authentication check
  const session = await auth();
  if (!session?.access_token) {
    return {
      success: false,
      processed: 0,
      unavailable: 0,
      skipped: 0,
      error: 'Not authenticated',
    };
  }

  try {
    // Step 2: Slice the batch from the full video IDs array
    const batch = videoIds.slice(startIndex, startIndex + batchSize);

    if (batch.length === 0) {
      return { success: true, processed: 0, unavailable: 0, skipped: 0 };
    }

    // Step 3: Check which videos already exist (re-import quota conservation)
    const existing = await db
      .select({ youtubeId: videos.youtubeId })
      .from(videos)
      .where(inArray(videos.youtubeId, batch));
    const existingIds = new Set(existing.map((v) => v.youtubeId));
    const newIds = batch.filter((id) => !existingIds.has(id));
    const skipped = batch.length - newIds.length;

    let unavailable = 0;

    // Step 4: Fetch metadata for new videos via YouTube API
    if (newIds.length > 0) {
      const returned = await fetchVideoBatch(session.access_token, newIds);
      const returnedIds = new Set(
        returned.map((v) => v.id).filter((id): id is string => !!id)
      );

      // Detect unavailable/deleted/private videos not returned by the API
      const missingIds = newIds.filter((id) => !returnedIds.has(id));

      // Insert placeholder records for unavailable videos so FK constraints
      // are satisfied when creating playlist-video relationships
      for (const id of missingIds) {
        await db
          .insert(videos)
          .values({
            youtubeId: id,
            title: '[Unavailable Video]',
            lastFetched: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .onConflictDoNothing();
      }

      unavailable = missingIds.length;
    }

    // Step 5: Return structured counts for progress UI
    return {
      success: true,
      processed: newIds.length - unavailable,
      unavailable,
      skipped,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      processed: 0,
      unavailable: 0,
      skipped: 0,
      error: `Metadata enrichment failed: ${message}`,
    };
  }
}

/**
 * Create playlist-video relationship records linking imported videos to the
 * Watch Later playlist, with application-level deduplication.
 *
 * CRITICAL: The playlistVideos table has NO unique constraint on
 * (playlist_id, video_id) — only a serial primary key. Re-import safety
 * relies entirely on querying existing relationships first and skipping
 * duplicates in application code.
 *
 * Called ONCE after all metadata batches complete (not per-batch). The entire
 * relationship creation runs in a single invocation because it is purely DB
 * work (no API calls) and completes in seconds even for ~4,000 rows.
 *
 * @param playlistDbId - Database ID of the Watch Later playlist
 * @param rows - Parsed CSV rows (order preserved for position field)
 * @returns Counts of created and skipped relationships
 */
export async function createPlaylistRelationships(
  playlistDbId: number,
  rows: ParsedCSVRow[]
): Promise<{
  success: boolean;
  created: number;
  skipped: number;
  error?: string;
}> {
  // Step 1: Authentication check
  const session = await auth();
  if (!session?.access_token) {
    return { success: false, created: 0, skipped: 0, error: 'Not authenticated' };
  }

  try {
    // Step 2: Resolve YouTube IDs to database IDs (batch in chunks of 500)
    const youtubeIds = rows.map((r) => r.videoId);
    const videoRecords: { id: number; youtubeId: string }[] = [];
    for (let i = 0; i < youtubeIds.length; i += 500) {
      const chunk = youtubeIds.slice(i, i + 500);
      const records = await db
        .select({ id: videos.id, youtubeId: videos.youtubeId })
        .from(videos)
        .where(inArray(videos.youtubeId, chunk));
      videoRecords.push(...records);
    }
    const youtubeToDbId = new Map(videoRecords.map((v) => [v.youtubeId, v.id]));

    // Step 3: Application-level deduplication — query ALL existing relationships
    // for this playlist, build a Set, and skip any video already linked.
    // This is necessary because playlistVideos has no unique constraint on
    // (playlistId, videoId).
    const existingRelations = await db
      .select({ videoId: playlistVideos.videoId })
      .from(playlistVideos)
      .where(eq(playlistVideos.playlistId, playlistDbId));
    const existingVideoIds = new Set(existingRelations.map((r) => r.videoId));

    // Step 4: Build insert list, filtering out duplicates and preserving CSV order
    const toInsert: {
      playlistId: number;
      videoId: number;
      position: number;
      addedAt: Date;
    }[] = [];
    let skipped = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const dbId = youtubeToDbId.get(row.videoId);
      if (!dbId) continue; // Video record not found (should not happen if 13-02 completed)

      if (existingVideoIds.has(dbId)) {
        skipped++;
        continue;
      }

      toInsert.push({
        playlistId: playlistDbId,
        videoId: dbId,
        position: i, // CSV order preserved: first row = position 0
        addedAt: new Date(row.addedAt),
      });
    }

    // Step 5: Batch insert in chunks of 500 for performance
    for (let i = 0; i < toInsert.length; i += 500) {
      const chunk = toInsert.slice(i, i + 500);
      await db.insert(playlistVideos).values(chunk);
    }

    // Step 6: Return structured counts for the UI summary
    return { success: true, created: toInsert.length, skipped };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      created: 0,
      skipped: 0,
      error: `Relationship creation failed: ${message}`,
    };
  }
}
