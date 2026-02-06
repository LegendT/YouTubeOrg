import diceCoefficient from 'fast-dice-coefficient';
import { db } from '@/lib/db';
import { playlistVideos } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

export const ALGORITHM_PRESETS = {
  aggressive: { targetClusters: 25, nameWeight: 0.6, overlapWeight: 0.4 },
  conservative: { targetClusters: 35, nameWeight: 0.8, overlapWeight: 0.2 },
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

/**
 * Build combined distance matrix using name similarity + video overlap.
 * distance = nameWeight * (1 - nameSim) + overlapWeight * (1 - videoOverlap)
 *
 * Uses fast-dice-coefficient for string similarity (O(n) Sorensen-Dice)
 * and Jaccard-like overlap for shared video content.
 */
export async function buildDistanceMatrix(
  playlists: PlaylistForClustering[],
  mode: AlgorithmMode = 'aggressive'
): Promise<DistanceMatrixResult> {
  const { nameWeight, overlapWeight } = ALGORITHM_PRESETS[mode];
  const n = playlists.length;
  const titles = playlists.map(p => p.title.toLowerCase());

  // Name similarity matrix using fast-dice-coefficient
  const nameSimilarities: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    nameSimilarities[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      const sim = diceCoefficient(titles[i], titles[j]);
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
      // Jaccard-like overlap: intersection / union
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
