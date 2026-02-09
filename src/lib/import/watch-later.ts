/**
 * Watch Later Playlist Helper
 *
 * Ensures a Watch Later playlist entry exists in the database for linking
 * imported videos to. Uses upsert (ON CONFLICT DO UPDATE) so that re-imports
 * update the item count rather than creating duplicate entries.
 */

import { db } from '@/lib/db';
import { playlists } from '@/lib/db/schema';

/**
 * Ensure the Watch Later playlist exists in the database.
 *
 * Creates the playlist with youtubeId 'WL' if it does not exist, or updates
 * the item count and updatedAt timestamp if it already exists. This makes
 * re-imports idempotent -- the playlist row is never duplicated.
 *
 * @param videoCount - Total number of valid videos parsed from the CSV
 * @returns The numeric database ID of the Watch Later playlist
 */
export async function ensureWatchLaterPlaylist(videoCount: number): Promise<number> {
  const result = await db
    .insert(playlists)
    .values({
      youtubeId: 'WL',
      title: 'Watch Later',
      description: 'Imported from Google Takeout',
      itemCount: videoCount,
      lastFetched: new Date(),
    })
    .onConflictDoUpdate({
      target: playlists.youtubeId,
      set: {
        itemCount: videoCount,
        updatedAt: new Date(),
      },
    })
    .returning({ id: playlists.id });

  return result[0].id;
}
