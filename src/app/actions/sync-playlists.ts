'use server';

import { getServerSession } from '@/lib/auth/session';
import { syncPlaylistsToDatabase } from '@/lib/youtube/playlists';
import { fetchPlaylistItems } from '@/lib/youtube/videos';
import { db } from '@/lib/db';
import { playlists } from '@/lib/db/schema';

/**
 * Server Action: Sync all YouTube data (playlists + videos)
 *
 * Orchestrates full data synchronization from YouTube to PostgreSQL.
 * This is a long-running operation that may hit quota limits during initial sync.
 *
 * Flow:
 * 1. Verify user authentication (requires session with access_token)
 * 2. Sync all playlists from YouTube to database
 * 3. For each playlist, sync all videos with resume capability
 * 4. Handle quota exhaustion gracefully with partial success indicator
 *
 * Resume capability: If quota is exhausted mid-sync, the syncState table
 * preserves progress. Calling this function again will resume where it left off.
 *
 * Quota considerations:
 * - Initial sync of 40 playlists + 4,000 videos ≈ 120 quota units
 * - With 10,000 daily quota, can sync ~333 playlists or ~33,000 videos per day
 * - For most users, sync completes in one call
 * - Heavy users may need multiple days (handled automatically by resume)
 *
 * @returns Success/failure status with sync statistics or error details
 *
 * Example usage from dashboard:
 * ```typescript
 * const result = await syncAllData();
 * if (result.success) {
 *   toast.success(`Synced ${result.playlistCount} playlists`);
 * } else if (result.partialSuccess) {
 *   toast.warning(result.error); // Quota exceeded, will resume tomorrow
 * } else {
 *   toast.error('Sync failed');
 * }
 * ```
 */
export async function syncAllData() {
  // Step 1: Verify authentication
  const session = await getServerSession();

  if (!session?.access_token) {
    return {
      success: false,
      error: 'Not authenticated. Please sign in to sync your YouTube data.',
      partialSuccess: false,
    };
  }

  try {
    console.log('[Sync] Starting full data sync...');

    // Step 2: Sync playlists
    const playlistCount = await syncPlaylistsToDatabase(session.access_token);
    console.log(`[Sync] Synced ${playlistCount} playlists`);

    // Step 3: Get all playlists from database
    const allPlaylists = await db.select().from(playlists);

    if (allPlaylists.length === 0) {
      console.log('[Sync] No playlists found. Nothing to sync.');
      return {
        success: true,
        playlistCount: 0,
        videoSyncCount: 0,
      };
    }

    // Step 4: Sync videos for each playlist (with resume support)
    let syncedPlaylists = 0;
    for (const playlist of allPlaylists) {
      try {
        await fetchPlaylistItems(session.access_token, playlist.youtubeId);
        syncedPlaylists++;
        console.log(`[Sync] Progress: ${syncedPlaylists}/${allPlaylists.length} playlists synced`);
      } catch (error: any) {
        // If quota exceeded on a specific playlist, re-throw to handle at top level
        if (error.message?.includes('quotaExceeded') || error.message?.includes('Quota exceeded')) {
          throw error;
        }
        // For other errors, log and continue to next playlist
        console.error(`[Sync] Error syncing playlist ${playlist.youtubeId}:`, error);
      }
    }

    console.log(`[Sync] Full sync complete: ${playlistCount} playlists, ${syncedPlaylists} video syncs`);

    return {
      success: true,
      playlistCount,
      videoSyncCount: syncedPlaylists,
    };
  } catch (error: any) {
    // Handle quota exhaustion gracefully
    if (
      error?.response?.status === 403 &&
      error?.response?.data?.error?.errors?.[0]?.reason === 'quotaExceeded'
    ) {
      console.warn('[Sync] Quota exceeded. Sync will resume automatically on next attempt.');
      return {
        success: false,
        error: 'Quota exceeded. Sync progress has been saved and will resume tomorrow automatically.',
        partialSuccess: true,
      };
    }

    // Handle other quota-related errors (from our error messages)
    if (error.message?.includes('quotaExceeded') || error.message?.includes('Quota exceeded')) {
      console.warn('[Sync] Quota exceeded:', error.message);
      return {
        success: false,
        error: 'Quota exceeded. Sync progress has been saved and will resume tomorrow automatically.',
        partialSuccess: true,
      };
    }

    // For all other errors, log and return failure
    console.error('[Sync] Sync failed:', error);
    return {
      success: false,
      error: `Sync failed: ${error.message || 'Unknown error'}`,
      partialSuccess: false,
    };
  }
}
