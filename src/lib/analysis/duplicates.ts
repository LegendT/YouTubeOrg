import { db } from '@/lib/db';
import { playlistVideos, videos, playlists } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

export interface DuplicateVideo {
  videoId: number;
  videoYoutubeId: string;
  title: string;
  playlistCount: number;
  playlists: Array<{ playlistId: number; playlistTitle: string }>;
}

export interface OverlapStats {
  totalUniqueVideos: number;
  duplicateVideoCount: number;
  duplicationPercentage: number;
}

/**
 * Find all videos that appear in more than one playlist.
 * Uses SQL GROUP BY with HAVING to efficiently detect duplicates
 * without loading all videos into memory.
 */
export async function findDuplicateVideos(): Promise<DuplicateVideo[]> {
  // Step 1: Find videos appearing in multiple playlists
  const duplicates = await db
    .select({
      videoId: playlistVideos.videoId,
      playlistCount: sql<number>`count(distinct ${playlistVideos.playlistId})`.as('playlist_count'),
    })
    .from(playlistVideos)
    .groupBy(playlistVideos.videoId)
    .having(sql`count(distinct ${playlistVideos.playlistId}) > 1`);

  // Step 2: For each duplicate, get full video details and containing playlists
  const detailed = await Promise.all(
    duplicates.map(async (dup) => {
      const [video] = await db
        .select({
          youtubeId: videos.youtubeId,
          title: videos.title,
        })
        .from(videos)
        .where(eq(videos.id, dup.videoId))
        .limit(1);

      const containingPlaylists = await db
        .select({
          playlistId: playlists.id,
          playlistTitle: playlists.title,
        })
        .from(playlistVideos)
        .innerJoin(playlists, eq(playlistVideos.playlistId, playlists.id))
        .where(eq(playlistVideos.videoId, dup.videoId));

      return {
        videoId: dup.videoId,
        videoYoutubeId: video?.youtubeId ?? '',
        title: video?.title ?? '',
        playlistCount: dup.playlistCount,
        playlists: containingPlaylists,
      };
    })
  );

  return detailed;
}

/**
 * Calculate overall duplication statistics across all playlists.
 * Returns total unique videos, count of duplicated videos,
 * and duplication percentage.
 */
export async function calculateOverlapStats(): Promise<OverlapStats> {
  // Count total unique videos across all playlists
  const [totalResult] = await db
    .select({
      count: sql<number>`count(distinct ${playlistVideos.videoId})`,
    })
    .from(playlistVideos);

  const totalUniqueVideos = Number(totalResult?.count ?? 0);

  // Count videos appearing in more than one playlist
  const duplicateResult = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(
      db
        .select({
          videoId: playlistVideos.videoId,
        })
        .from(playlistVideos)
        .groupBy(playlistVideos.videoId)
        .having(sql`count(distinct ${playlistVideos.playlistId}) > 1`)
        .as('duplicates')
    );

  const duplicateVideoCount = Number(duplicateResult[0]?.count ?? 0);

  const duplicationPercentage =
    totalUniqueVideos > 0
      ? Math.round((duplicateVideoCount / totalUniqueVideos) * 10000) / 100
      : 0;

  return {
    totalUniqueVideos,
    duplicateVideoCount,
    duplicationPercentage,
  };
}
