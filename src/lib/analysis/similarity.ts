import { db } from '@/lib/db';
import { playlistVideos } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

export const ALGORITHM_PRESETS = {
  aggressive: { distanceThreshold: 0.80, nameWeight: 0.6, overlapWeight: 0.4 },
  conservative: { distanceThreshold: 0.60, nameWeight: 0.8, overlapWeight: 0.2 },
} as const;

export type AlgorithmMode = keyof typeof ALGORITHM_PRESETS;

export interface PlaylistForClustering {
  id: number;
  title: string;
  itemCount: number | null;
}

export interface DistanceMatrixResult {
  distances: number[][];
  nameSimilarities: number[][];
  videoOverlaps: number[][];
}

// Noise tokens to filter before computing word-level similarity
const TOKEN_STOPWORDS = new Set([
  'the', 'and', 'of', 'in', 'for', 'to', 'a', 'an', 'my',
]);

/**
 * Word-level Jaccard similarity between two titles.
 * Tokenizes on whitespace and common separators, filters stopwords,
 * then returns |intersection| / |union|.
 */
function wordJaccard(a: string, b: string): number {
  const tokenize = (s: string): Set<string> => {
    const words = s.toLowerCase().split(/[\s/:|\-–—:]+/).filter(Boolean);
    return new Set(words.filter(w => !TOKEN_STOPWORDS.has(w) && w.length > 0));
  };
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const w of setA) {
    if (setB.has(w)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Build combined distance matrix using name similarity + video overlap.
 * distance = nameWeight * (1 - nameSim) + overlapWeight * (1 - videoOverlap)
 *
 * Uses word-level Jaccard for name matching (much better than character
 * bigrams for short playlist titles like "css" vs "css animations") and
 * Jaccard overlap for shared video content.
 */
export async function buildDistanceMatrix(
  playlists: PlaylistForClustering[],
  mode: AlgorithmMode = 'aggressive'
): Promise<DistanceMatrixResult> {
  const { nameWeight, overlapWeight } = ALGORITHM_PRESETS[mode];
  const n = playlists.length;

  // Name similarity matrix using word-level Jaccard
  const nameSimilarities: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    nameSimilarities[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      const sim = wordJaccard(playlists[i].title, playlists[j].title);
      nameSimilarities[i][j] = sim;
      nameSimilarities[j][i] = sim;
    }
  }

  // Video overlap matrix: for each pair, count shared videos / total unique videos (Jaccard)
  const videoOverlaps: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

  // Pre-fetch video sets for each playlist
  const videoSets: Map<number, Set<number>> = new Map();
  for (const p of playlists) {
    const rows = await db
      .select({ videoId: playlistVideos.videoId })
      .from(playlistVideos)
      .where(sql`${playlistVideos.playlistId} = ${p.id}`);
    videoSets.set(p.id, new Set(rows.map(r => r.videoId)));
  }

  for (let i = 0; i < n; i++) {
    videoOverlaps[i][i] = 1;
    const setI = videoSets.get(playlists[i].id) || new Set();
    for (let j = i + 1; j < n; j++) {
      const setJ = videoSets.get(playlists[j].id) || new Set();
      let intersection = 0;
      for (const vid of setI) {
        if (setJ.has(vid)) intersection++;
      }
      const union = setI.size + setJ.size - intersection;
      const overlap = union > 0 ? intersection / union : 0;
      videoOverlaps[i][j] = overlap;
      videoOverlaps[j][i] = overlap;
    }
  }

  // Combined distance matrix
  const distances: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dist = nameWeight * (1 - nameSimilarities[i][j]) + overlapWeight * (1 - videoOverlaps[i][j]);
      distances[i][j] = dist;
      distances[j][i] = dist;
    }
  }

  return { distances, nameSimilarities, videoOverlaps };
}
