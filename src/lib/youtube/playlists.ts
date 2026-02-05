import { youtube_v3 } from 'googleapis';
import { callYouTubeAPI } from '@/lib/rate-limiter';
import { createYouTubeClient, fetchWithETagCache } from '@/lib/youtube/client';
import { trackQuotaUsage } from '@/lib/youtube/quota';
import { db } from '@/lib/db';
import { playlists } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * YouTube Playlist Synchronization
 *
 * Implements Pattern: Fetching All Playlists with Pagination and ETag Caching
 * From 01-RESEARCH.md code examples.
 *
 * Key features:
 * - Paginated fetching of all user playlists
 * - ETag caching to minimize quota usage on re-syncs
 * - Database persistence with upsert logic
 * - Quota tracking for monitoring and analytics
 * - Graceful handling of quota exhaustion
 *
 * Critical for Phase 1: Populates playlists table as foundation for video sync.
 */

/**
 * Fetch all user playlists from YouTube with pagination
 *
 * Retrieves complete list of user's playlists by following pagination tokens
 * until all pages are fetched. Uses ETag caching to avoid redundant fetches.
 *
 * @param accessToken - OAuth 2.0 access token from session
 * @returns Array of all user playlists with metadata
 *
 * Quota cost: 1 unit per page (typically 1-2 pages for most users)
 *
 * Example:
 * ```typescript
 * const allPlaylists = await fetchAllPlaylists(session.access_token);
 * console.log(`Found ${allPlaylists.length} playlists`);
 * ```
 */
export async function fetchAllPlaylists(
  accessToken: string
): Promise<youtube_v3.Schema$Playlist[]> {
  const youtube = createYouTubeClient(accessToken);
  const allPlaylists: youtube_v3.Schema$Playlist[] = [];
  let pageToken: string | undefined;

  try {
    do {
      // Fetch playlists page with ETag caching and rate limiting
      const response = await callYouTubeAPI(
        async () => {
          return await fetchWithETagCache(
            youtube,
            'playlists',
            async () => {
              return await youtube.playlists.list({
                part: ['snippet', 'contentDetails'],
                mine: true,
                maxResults: 50,
                pageToken,
              });
            },
            { mine: true, maxResults: 50, pageToken }
          );
        },
        1, // 1 quota unit per playlists.list call
        'playlists.list'
      );

      const items = response.items || [];
      allPlaylists.push(...items);

      console.log(
        `[Playlists] Fetched ${items.length} playlists (page token: ${pageToken || 'first'})`
      );

      // Get next page token for pagination
      pageToken = response.nextPageToken || undefined;
    } while (pageToken);

    console.log(`[Playlists] Completed fetch: ${allPlaylists.length} total playlists`);
    return allPlaylists;
  } catch (error: any) {
    // Handle quota exhaustion gracefully
    if (error?.response?.status === 403 && error?.response?.data?.error?.errors?.[0]?.reason === 'quotaExceeded') {
      console.error(
        `[Playlists] Quota exceeded after fetching ${allPlaylists.length} playlists. Resume will start from next page.`
      );
      throw new Error(`Quota exceeded. Fetched ${allPlaylists.length} playlists before limit.`);
    }

    console.error('[Playlists] Error fetching playlists:', error);
    throw error;
  }
}

/**
 * Sync playlists to database with upsert logic
 *
 * Takes playlist data from YouTube API and persists to PostgreSQL.
 * Uses conflict resolution to update existing playlists or insert new ones.
 *
 * @param accessToken - OAuth 2.0 access token from session
 * @returns Count of playlists synced to database
 *
 * Database operations:
 * - INSERT new playlists
 * - UPDATE existing playlists (by youtubeId)
 * - Store ETag and lastFetched for cache invalidation
 *
 * Example:
 * ```typescript
 * const count = await syncPlaylistsToDatabase(session.access_token);
 * console.log(`Synced ${count} playlists to database`);
 * ```
 */
export async function syncPlaylistsToDatabase(accessToken: string): Promise<number> {
  try {
    // Step 1: Fetch all playlists from YouTube
    const playlistsData = await fetchAllPlaylists(accessToken);

    if (playlistsData.length === 0) {
      console.log('[Playlists] No playlists to sync');
      return 0;
    }

    // Step 2: Upsert each playlist to database
    for (const playlist of playlistsData) {
      if (!playlist.id) {
        console.warn('[Playlists] Skipping playlist without ID:', playlist);
        continue;
      }

      await db
        .insert(playlists)
        .values({
          youtubeId: playlist.id,
          title: playlist.snippet?.title || 'Untitled Playlist',
          description: playlist.snippet?.description || null,
          thumbnailUrl: playlist.snippet?.thumbnails?.default?.url || null,
          itemCount: playlist.contentDetails?.itemCount || 0,
          etag: playlist.etag || null,
          lastFetched: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: playlists.youtubeId,
          set: {
            title: playlist.snippet?.title || 'Untitled Playlist',
            description: playlist.snippet?.description || null,
            thumbnailUrl: playlist.snippet?.thumbnails?.default?.url || null,
            itemCount: playlist.contentDetails?.itemCount || 0,
            etag: playlist.etag || null,
            lastFetched: new Date(),
            updatedAt: new Date(),
          },
        });
    }

    // Step 3: Track quota usage for monitoring
    await trackQuotaUsage('playlists.list', {
      count: playlistsData.length,
      operation: 'sync',
    });

    console.log(`[Playlists] Successfully synced ${playlistsData.length} playlists to database`);
    return playlistsData.length;
  } catch (error: any) {
    // Re-throw with context about partial progress
    if (error.message?.includes('Quota exceeded')) {
      throw new Error(`Playlist sync incomplete due to quota limit: ${error.message}`);
    }
    throw error;
  }
}
