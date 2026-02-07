import { createYouTubeClient } from '@/lib/youtube/client';
import { callYouTubeAPI } from '@/lib/rate-limiter';
import { trackQuotaUsage, QUOTA_COSTS } from '@/lib/youtube/quota';

/**
 * YouTube API Write Operations
 *
 * Phase 8: Batch Sync Operations - write wrappers for creating playlists,
 * adding videos, and deleting playlists on YouTube.
 *
 * All operations:
 * - Use existing callYouTubeAPI() for rate limiting and quota reservoir tracking
 * - Use existing trackQuotaUsage() for persistent quota logging to the database
 * - Cost 50 quota units each (YouTube write operation standard)
 *
 * New playlists are created as private by default to prevent exposing
 * incomplete sync state to the user's YouTube channel.
 */

/**
 * Create a new YouTube playlist
 *
 * Creates a private playlist with the given title and optional description.
 * Used during the create_playlists sync stage to create one playlist per category.
 *
 * @param accessToken - OAuth 2.0 access token with youtube.force-ssl scope
 * @param title - Playlist title (maps to category name)
 * @param description - Optional playlist description
 * @returns The new YouTube playlist ID
 * @throws If the API call fails or no playlist ID is returned
 */
export async function createYouTubePlaylist(
  accessToken: string,
  title: string,
  description?: string
): Promise<string> {
  const youtube = createYouTubeClient(accessToken);

  const response = await callYouTubeAPI(
    () =>
      youtube.playlists.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title,
            description: description || '',
          },
          status: {
            privacyStatus: 'private',
          },
        },
      }),
    QUOTA_COSTS['playlists.insert'],
    'playlists.insert'
  );

  const playlistId = response.data.id;
  if (!playlistId) {
    throw new Error(`YouTube API returned no playlist ID for title "${title}"`);
  }

  await trackQuotaUsage('playlists.insert', { title, playlistId });

  return playlistId;
}

/**
 * Add a video to a YouTube playlist
 *
 * Inserts a video into a playlist by YouTube video ID.
 * Used during the add_videos sync stage for each video-category assignment.
 *
 * @param accessToken - OAuth 2.0 access token with youtube.force-ssl scope
 * @param playlistId - YouTube playlist ID to add the video to
 * @param videoId - YouTube video ID to add
 * @returns The playlist item ID (YouTube's ID for this video-in-playlist entry)
 * @throws If the API call fails or no playlist item ID is returned
 */
export async function addVideoToPlaylist(
  accessToken: string,
  playlistId: string,
  videoId: string
): Promise<string> {
  const youtube = createYouTubeClient(accessToken);

  const response = await callYouTubeAPI(
    () =>
      youtube.playlistItems.insert({
        part: ['snippet'],
        requestBody: {
          snippet: {
            playlistId,
            resourceId: {
              kind: 'youtube#video',
              videoId,
            },
          },
        },
      }),
    QUOTA_COSTS['playlistItems.insert'],
    'playlistItems.insert'
  );

  const itemId = response.data.id;
  if (!itemId) {
    throw new Error(
      `YouTube API returned no item ID when adding video "${videoId}" to playlist "${playlistId}"`
    );
  }

  await trackQuotaUsage('playlistItems.insert', { playlistId, videoId });

  return itemId;
}

/**
 * Delete a YouTube playlist
 *
 * Permanently deletes a playlist from YouTube by its ID.
 * Used during the delete_playlists sync stage to remove old playlists
 * after their videos have been moved to new category-based playlists.
 *
 * @param accessToken - OAuth 2.0 access token with youtube.force-ssl scope
 * @param playlistId - YouTube playlist ID to delete
 * @throws If the API call fails
 */
export async function deleteYouTubePlaylist(
  accessToken: string,
  playlistId: string
): Promise<void> {
  const youtube = createYouTubeClient(accessToken);

  await callYouTubeAPI(
    () =>
      youtube.playlists.delete({
        id: playlistId,
      }),
    QUOTA_COSTS['playlists.delete'],
    'playlists.delete'
  );

  await trackQuotaUsage('playlists.delete', { playlistId });
}
