export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ConfidenceResult {
  score: number;
  level: ConfidenceLevel;
  reason: string;
}

// Noise tokens to filter before computing word-level similarity
const TOKEN_STOPWORDS = new Set([
  'the', 'and', 'of', 'in', 'for', 'to', 'a', 'an', 'my',
]);

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
 * Calculate confidence score for a cluster based on pairwise name similarity + video overlap.
 *
 * Score = 60% average name similarity + 40% video overlap, scaled to 0-100.
 * HIGH >= 70, MEDIUM >= 40, LOW < 40.
 */
export function calculateConfidence(
  clusterTitles: string[],
  videoOverlapPercent: number
): ConfidenceResult {
  if (clusterTitles.length === 1) {
    return { score: 100, level: 'HIGH', reason: 'Single playlist, no merge needed' };
  }

  // Average pairwise name similarity within cluster (word-level Jaccard)
  let totalSim = 0;
  let pairs = 0;
  for (let i = 0; i < clusterTitles.length; i++) {
    for (let j = i + 1; j < clusterTitles.length; j++) {
      totalSim += wordJaccard(clusterTitles[i], clusterTitles[j]);
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
