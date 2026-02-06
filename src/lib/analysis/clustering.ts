import { agnes } from 'ml-hclust';
import diceCoefficient from 'fast-dice-coefficient';
import { db } from '@/lib/db';
import { playlists } from '@/lib/db/schema';

interface PlaylistForClustering {
  id: number;
  title: string;
  itemCount: number | null;
}

export interface ClusterResult {
  categoryName: string;
  playlists: Array<{ id: number; title: string }>;
  totalVideos: number;
}

// Aggressive mode: fewer categories (more merging)
// Conservative mode: more categories (less merging)
const ALGORITHM_PRESETS = {
  aggressive: { targetClusters: 25 },
  conservative: { targetClusters: 35 },
} as const;

// Words to filter out when generating category names
const STOPWORDS = new Set([
  'the', 'and', 'of', 'in', 'for', 'to', 'a', 'an', 'my',
  'videos', 'playlist', 'watch', 'later', 'vids',
]);

/**
 * Cluster playlists into proposed categories using Dice coefficient
 * string similarity and AGNES hierarchical clustering.
 *
 * @param mode - 'aggressive' (25 clusters) or 'conservative' (35 clusters)
 * @returns Array of cluster results sorted by totalVideos descending
 */
export async function clusterPlaylists(
  mode: 'aggressive' | 'conservative' = 'aggressive'
): Promise<ClusterResult[]> {
  // Fetch all playlists from database
  const allPlaylists = await db
    .select({
      id: playlists.id,
      title: playlists.title,
      itemCount: playlists.itemCount,
    })
    .from(playlists);

  if (allPlaylists.length === 0) {
    return [];
  }

  // For a single playlist, return it as its own cluster
  if (allPlaylists.length === 1) {
    return [{
      categoryName: allPlaylists[0].title,
      playlists: [{ id: allPlaylists[0].id, title: allPlaylists[0].title }],
      totalVideos: allPlaylists[0].itemCount ?? 0,
    }];
  }

  const n = allPlaylists.length;
  const titles = allPlaylists.map(p => p.title.toLowerCase());

  // Build distance matrix: distance = 1 - Dice coefficient similarity
  const distances: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = diceCoefficient(titles[i], titles[j]);
      const distance = 1 - sim;
      distances[i][j] = distance;
      distances[j][i] = distance;
    }
  }

  // AGNES hierarchical clustering with average linkage (UPGMA)
  const tree = agnes(distances, { method: 'average' });

  // Use built-in group(k) to cut dendrogram into target number of clusters
  const { targetClusters } = ALGORITHM_PRESETS[mode];
  // Ensure target does not exceed number of playlists
  const k = Math.min(targetClusters, n);
  const groupResult = tree.group(k);

  // Extract clusters from group result
  // group(k) returns a Cluster whose children are the k clusters
  const clusters = groupResult.children;

  // Build result array from clusters
  const results: ClusterResult[] = clusters.map((cluster) => {
    const indices = cluster.indices();
    const clusterPlaylists = indices.map((idx: number) => ({
      id: allPlaylists[idx].id,
      title: allPlaylists[idx].title,
    }));

    const clusterTitles = indices.map((idx: number) => allPlaylists[idx].title);
    const totalVideos = indices.reduce(
      (sum: number, idx: number) => sum + (allPlaylists[idx].itemCount ?? 0),
      0
    );

    return {
      categoryName: generateCategoryName(clusterTitles),
      playlists: clusterPlaylists,
      totalVideos,
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
  if (titles.length === 0) return 'Uncategorized';
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
