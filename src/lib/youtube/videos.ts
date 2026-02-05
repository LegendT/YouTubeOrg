import { youtube_v3 } from 'googleapis';
import { callYouTubeAPI } from '@/lib/rate-limiter';
import { createYouTubeClient, fetchWithETagCache } from '@/lib/youtube/client';
import { trackQuotaUsage } from '@/lib/youtube/quota';
import { db } from '@/lib/db';
import { videos, playlistVideos, syncState, playlists } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * YouTube Video Synchronization with Resume Capability
 *
 * Implements Pattern: Fetching Playlist Items with Resume Capability
 * From 01-RESEARCH.md code examples.
 *
 * Key features:
 * - Resume capability using syncState table for pagination progress
 * - Batch video fetching (50 videos per API call) for quota optimization
 * - Database persistence of video metadata and playlist relationships
 * - Graceful quota exhaustion handling with progress preservation
 *
 * Critical for Phase 1: Enables multi-day sync of 4,000 videos without data loss.
 */

/**
 * Fetch playlist items (videos) with resume capability
 *
 * Retrieves all videos in a playlist with support for resuming after quota exhaustion.
 * Progress is tracked in syncState table using nextPageToken and itemsFetched.
 *
 * Resume flow:
 * 1. Check syncState for existing progress (nextPageToken, itemsFetched)
 * 2. Start pagination from saved token (or beginning if no progress)
 * 3. For each page: fetch items, get video details, store in database
 * 4. Update syncState after each page
 * 5. On completion: delete syncState entry
 * 6. On quota error: preserve syncState for later resume
 *
 * @param accessToken - OAuth 2.0 access token from session
 * @param playlistYoutubeId - YouTube playlist ID to fetch items from
 *
 * Quota cost: 1 unit per playlistItems page + 1 unit per 50 videos
 *
 * Example:
 * ```typescript
 * try {
 *   await fetchPlaylistItems(session.access_token, 'PLxxx...');
 *   console.log('Playlist sync complete');
 * } catch (error) {
 *   if (error.message.includes('quotaExceeded')) {
 *     console.log('Sync paused - will resume tomorrow');
 *   }
 * }
 * ```
 */
export async function fetchPlaylistItems(
  accessToken: string,
  playlistYoutubeId: string
): Promise<void> {
  const youtube = createYouTubeClient(accessToken);

  try {
    // Step 1: Check for existing sync progress (resume capability)
    const existingProgress = await db
      .select()
      .from(syncState)
      .where(eq(syncState.playlistYoutubeId, playlistYoutubeId))
      .limit(1);

    let pageToken: string | undefined = existingProgress[0]?.nextPageToken || undefined;
    let itemsFetched = existingProgress[0]?.itemsFetched || 0;

    if (existingProgress.length > 0) {
      console.log(
        `[Videos] Resuming playlist ${playlistYoutubeId} from token: ${pageToken}, items fetched: ${itemsFetched}`
      );
    } else {
      console.log(`[Videos] Starting fresh sync for playlist ${playlistYoutubeId}`);
    }

    // Get playlist database ID for join table
    const playlistRecord = await db
      .select()
      .from(playlists)
      .where(eq(playlists.youtubeId, playlistYoutubeId))
      .limit(1);

    if (playlistRecord.length === 0) {
      throw new Error(`Playlist ${playlistYoutubeId} not found in database. Sync playlists first.`);
    }

    const playlistDbId = playlistRecord[0].id;

    // Step 2: Paginate through playlist items
    do {
      // Fetch playlist items page
      const response = await callYouTubeAPI(
        async () => {
          return await fetchWithETagCache(
            youtube,
            'playlistItems',
            async () => {
              return await youtube.playlistItems.list({
                part: ['snippet', 'contentDetails'],
                playlistId: playlistYoutubeId,
                maxResults: 50,
                pageToken,
              });
            },
            { playlistId: playlistYoutubeId, maxResults: 50, pageToken }
          );
        },
        1,
        'playlistItems.list'
      );

      const items = response.items || [];
      console.log(
        `[Videos] Fetched ${items.length} playlist items from ${playlistYoutubeId} (page: ${pageToken || 'first'})`
      );

      // Step 3: Extract video IDs and fetch full video details in batch
      const videoIds = items
        .map((item) => item.contentDetails?.videoId)
        .filter((id): id is string => !!id);

      if (videoIds.length > 0) {
        const videoDetails = await fetchVideoBatch(accessToken, videoIds);

        // Step 4: Store playlist-video relationships with position
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const videoId = item.contentDetails?.videoId;

          if (!videoId) continue;

          // Find video database ID
          const videoRecord = await db
            .select()
            .from(videos)
            .where(eq(videos.youtubeId, videoId))
            .limit(1);

          if (videoRecord.length === 0) {
            console.warn(`[Videos] Video ${videoId} not found in database after batch fetch`);
            continue;
          }

          // Insert playlist-video relationship
          await db
            .insert(playlistVideos)
            .values({
              playlistId: playlistDbId,
              videoId: videoRecord[0].id,
              position: itemsFetched + i,
              addedAt: new Date(),
            })
            .onConflictDoNothing(); // Avoid duplicate entries if re-syncing
        }

        itemsFetched += items.length;
      }

      // Step 5: Update sync progress in database
      pageToken = response.nextPageToken || undefined;

      await db
        .insert(syncState)
        .values({
          playlistYoutubeId,
          nextPageToken: pageToken || null,
          itemsFetched,
          lastSyncAt: new Date(),
        })
        .onConflictDoUpdate({
          target: syncState.playlistYoutubeId,
          set: {
            nextPageToken: pageToken || null,
            itemsFetched,
            lastSyncAt: new Date(),
          },
        });

      console.log(
        `[Videos] Progress: ${itemsFetched} items from playlist ${playlistYoutubeId}`
      );
    } while (pageToken);

    // Step 6: Sync complete - delete sync state entry
    await db.delete(syncState).where(eq(syncState.playlistYoutubeId, playlistYoutubeId));

    await trackQuotaUsage('playlistItems.list', {
      playlistId: playlistYoutubeId,
      itemsFetched,
    });

    console.log(
      `[Videos] Completed sync for playlist ${playlistYoutubeId}: ${itemsFetched} total items`
    );
  } catch (error: any) {
    // Handle quota exhaustion - preserve syncState for resume
    if (
      error?.response?.status === 403 &&
      error?.response?.data?.error?.errors?.[0]?.reason === 'quotaExceeded'
    ) {
      console.error(
        `[Videos] Quota exceeded while syncing playlist ${playlistYoutubeId}. Progress saved for resume.`
      );
      throw new Error(
        `Quota exceeded. Playlist ${playlistYoutubeId} sync will resume from saved progress.`
      );
    }

    console.error(`[Videos] Error syncing playlist ${playlistYoutubeId}:`, error);
    throw error;
  }
}

/**
 * Fetch video details in batch (up to 50 videos per call)
 *
 * YouTube API allows fetching up to 50 videos in a single videos.list call.
 * This function batches video IDs to minimize quota consumption.
 *
 * @param accessToken - OAuth 2.0 access token from session
 * @param videoIds - Array of YouTube video IDs to fetch
 * @returns Array of video metadata from YouTube API
 *
 * Quota cost: 1 unit per batch of 50 videos
 *
 * Database operations:
 * - INSERT new videos
 * - UPDATE existing videos (by youtubeId)
 * - Store ETag and lastFetched for cache invalidation
 *
 * Example:
 * ```typescript
 * const videoIds = ['abc123', 'def456', 'ghi789'];
 * const videos = await fetchVideoBatch(session.access_token, videoIds);
 * ```
 */
export async function fetchVideoBatch(
  accessToken: string,
  videoIds: string[]
): Promise<youtube_v3.Schema$Video[]> {
  const youtube = createYouTubeClient(accessToken);
  const allVideos: youtube_v3.Schema$Video[] = [];

  // Batch video IDs in groups of 50 (YouTube API limit)
  const batchSize = 50;
  for (let i = 0; i < videoIds.length; i += batchSize) {
    const batch = videoIds.slice(i, i + batchSize);

    const response = await callYouTubeAPI(
      async () => {
        return await fetchWithETagCache(
          youtube,
          'videos',
          async () => {
            return await youtube.videos.list({
              part: ['snippet', 'contentDetails'],
              id: batch,
            });
          },
          { id: batch.join(',') }
        );
      },
      1,
      'videos.list'
    );

    const items = response.items || [];
    allVideos.push(...items);

    console.log(`[Videos] Fetched batch of ${items.length} videos (${i + 1}-${i + batch.length})`);

    // Store videos in database
    for (const video of items) {
      if (!video.id) {
        console.warn('[Videos] Skipping video without ID:', video);
        continue;
      }

      await db
        .insert(videos)
        .values({
          youtubeId: video.id,
          title: video.snippet?.title || 'Untitled Video',
          description: video.snippet?.description || null,
          thumbnailUrl: video.snippet?.thumbnails?.default?.url || null,
          channelTitle: video.snippet?.channelTitle || null,
          duration: video.contentDetails?.duration || null,
          publishedAt: video.snippet?.publishedAt
            ? new Date(video.snippet.publishedAt)
            : null,
          etag: video.etag || null,
          lastFetched: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: videos.youtubeId,
          set: {
            title: video.snippet?.title || 'Untitled Video',
            description: video.snippet?.description || null,
            thumbnailUrl: video.snippet?.thumbnails?.default?.url || null,
            channelTitle: video.snippet?.channelTitle || null,
            duration: video.contentDetails?.duration || null,
            publishedAt: video.snippet?.publishedAt
              ? new Date(video.snippet.publishedAt)
              : null,
            etag: video.etag || null,
            lastFetched: new Date(),
            updatedAt: new Date(),
          },
        });
    }

    await trackQuotaUsage('videos.list', {
      count: items.length,
      batchSize: batch.length,
    });
  }

  return allVideos;
}
