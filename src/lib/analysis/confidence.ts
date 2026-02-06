import diceCoefficient from 'fast-dice-coefficient';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ConfidenceResult {
  score: number;
  level: ConfidenceLevel;
  reason: string;
}

/**
 * Calculate confidence score for a cluster based on pairwise name similarity + video overlap.
 *
 * Score = 60% average name similarity + 40% video overlap, scaled to 0-100.
 * HIGH >= 70, MEDIUM >= 40, LOW < 40.
 *
 * @param clusterTitles - Playlist titles within the cluster
 * @param videoOverlapPercent - Percentage of shared videos across cluster playlists (0-100)
 * @returns Confidence score, level, and human-readable reasoning
 */
export function calculateConfidence(
  clusterTitles: string[],
  videoOverlapPercent: number
): ConfidenceResult {
  if (clusterTitles.length === 1) {
    return { score: 100, level: 'HIGH', reason: 'Single playlist, no merge needed' };
  }

  // Average pairwise name similarity within cluster
  let totalSim = 0;
  let pairs = 0;
  for (let i = 0; i < clusterTitles.length; i++) {
    for (let j = i + 1; j < clusterTitles.length; j++) {
      totalSim += diceCoefficient(clusterTitles[i].toLowerCase(), clusterTitles[j].toLowerCase());
      pairs++;
    }
  }
  const avgNameSim = pairs > 0 ? totalSim / pairs : 1;

  // Combined score: 60% name similarity, 40% video overlap
  const score = Math.round((avgNameSim * 0.6 + (videoOverlapPercent / 100) * 0.4) * 100);
  const clampedScore = Math.max(0, Math.min(100, score));
  const level: ConfidenceLevel = clampedScore >= 70 ? 'HIGH' : clampedScore >= 40 ? 'MEDIUM' : 'LOW';
  const reason = `Name similarity: ${Math.round(avgNameSim * 100)}%, Video overlap: ${videoOverlapPercent}%`;

  return { score: clampedScore, level, reason };
}
