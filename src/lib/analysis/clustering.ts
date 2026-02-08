import { agnes } from 'ml-hclust';
import { db } from '@/lib/db';
import { playlists } from '@/lib/db/schema';
import { buildDistanceMatrix, ALGORITHM_PRESETS, type AlgorithmMode } from './similarity';
import { calculateConfidence, type ConfidenceResult } from './confidence';

export { type AlgorithmMode } from './similarity';
export { ALGORITHM_PRESETS } from './similarity';

export interface ClusterResult {
  categoryName: string;
  playlists: Array<{ id: number; title: string }>;
  totalVideos: number;
  confidence: ConfidenceResult;
}

// Words to filter out when generating category names
const STOPWORDS = new Set([
  'the', 'and', 'of', 'in', 'for', 'to', 'a', 'an', 'my',
  'videos', 'playlist', 'watch', 'later', 'vids',
]);

/**
 * Cluster playlists into proposed categories using combined distance
 * (name similarity via fast-dice-coefficient + video overlap) and
 * AGNES hierarchical clustering with threshold-based cutting.
 *
 * Only merges playlists whose combined distance falls below the
 * threshold — playlists with no meaningful similarity stay separate.
 *
 * @param mode - 'aggressive' (lower threshold, merges more) or 'conservative' (higher bar for merging)
 * @returns Array of cluster results sorted by totalVideos descending, with confidence scores
 */
export async function clusterPlaylists(
  mode: AlgorithmMode = 'aggressive'
): Promise<ClusterResult[]> {
  // Fetch all playlists from database, excluding Watch Later
  const allPlaylists = await db
    .select({
      id: playlists.id,
      title: playlists.title,
      itemCount: playlists.itemCount,
      youtubeId: playlists.youtubeId,
    })
    .from(playlists);

  // Filter out Watch Later playlist
  const filteredPlaylists = allPlaylists.filter(
    p => p.youtubeId !== 'WL' && p.title !== 'Watch Later'
  );

  if (filteredPlaylists.length === 0) {
    return [];
  }

  if (filteredPlaylists.length === 1) {
    return [{
      categoryName: filteredPlaylists[0].title,
      playlists: [{ id: filteredPlaylists[0].id, title: filteredPlaylists[0].title }],
      totalVideos: filteredPlaylists[0].itemCount ?? 0,
      confidence: { score: 100, level: 'HIGH', reason: 'Single playlist, no merge needed' },
    }];
  }

  const playlistsForClustering = filteredPlaylists.map(p => ({
    id: p.id,
    title: p.title,
    itemCount: p.itemCount,
  }));

  // Build combined distance matrix (name similarity + video overlap)
  const { distances, videoOverlaps } = await buildDistanceMatrix(playlistsForClustering, mode);

  // AGNES hierarchical clustering with average linkage (UPGMA)
  const tree = agnes(distances, { method: 'average', isDistanceMatrix: true });

  // Cut dendrogram at distance threshold — only merge playlists that
  // are actually similar. Unrelated playlists stay as their own category.
  const { distanceThreshold } = ALGORITHM_PRESETS[mode];
  const clusters = tree.cut(distanceThreshold);

  // Build result array with confidence scores
  const results: ClusterResult[] = clusters.map((cluster) => {
    const indices = cluster.indices();
    const clusterPlaylistItems = indices.map((idx: number) => ({
      id: playlistsForClustering[idx].id,
      title: playlistsForClustering[idx].title,
    }));

    const clusterTitles = indices.map((idx: number) => playlistsForClustering[idx].title);
    const totalVideos = indices.reduce(
      (sum: number, idx: number) => sum + (playlistsForClustering[idx].itemCount ?? 0),
      0
    );

    // Calculate average video overlap percentage within this cluster
    let totalOverlap = 0;
    let overlapPairs = 0;
    for (let i = 0; i < indices.length; i++) {
      for (let j = i + 1; j < indices.length; j++) {
        totalOverlap += videoOverlaps[indices[i]][indices[j]];
        overlapPairs++;
      }
    }
    const avgVideoOverlap = overlapPairs > 0 ? totalOverlap / overlapPairs : 0;
    const videoOverlapPercent = Math.round(avgVideoOverlap * 100);

    const confidence = calculateConfidence(clusterTitles, videoOverlapPercent);

    return {
      categoryName: generateCategoryName(clusterTitles),
      playlists: clusterPlaylistItems,
      totalVideos,
      confidence,
    };
  });

  // Sort by totalVideos descending
  results.sort((a, b) => b.totalVideos - a.totalVideos);

  return results;
}

/**
 * Generate a human-readable category name from a list of playlist titles.
 *
 * Strategy: For single-item clusters, use the playlist title directly.
 * For multi-item clusters, pick the most descriptive title
 * (most non-stopword words, then longest).
 */
export function generateCategoryName(titles: string[]): string {
  if (titles.length === 0) return 'Uncategorised';
  if (titles.length === 1) return titles[0];

  // Score each title: prefer longer, more descriptive names
  const scored = titles.map(title => ({
    title,
    wordCount: title
      .split(/\s+/)
      .filter(w => !STOPWORDS.has(w.toLowerCase()))
      .length,
    length: title.length,
  }));

  // Sort by meaningful word count descending, then by length descending
  scored.sort((a, b) => b.wordCount - a.wordCount || b.length - a.length);

  return scored[0].title;
}
