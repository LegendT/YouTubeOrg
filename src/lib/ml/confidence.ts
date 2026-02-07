/**
 * Confidence scoring for ML categorization predictions.
 *
 * Thresholds calibrated against actual YouTube video data (1030 videos):
 *   median score = 37%, p75 = 46%, mean = 40%
 * Short video titles + category names produce lower cosine similarities
 * than full-sentence benchmarks, so thresholds are adjusted accordingly.
 */

import { cosineSimilarity } from './similarity';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Calibrated thresholds for all-MiniLM-L6-v2 + hybrid channel-boost scoring.
 *
 * Thresholds:
 * - HIGH (≥0.50): Top ~20% — strong match, high confidence
 * - MEDIUM (0.35-0.49): Middle ~37% — reasonable match, worth reviewing
 * - LOW (<0.35): Bottom ~43% — weak match, likely needs manual reassignment
 */
export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.5,
  MEDIUM: 0.35,
} as const;

/**
 * Determines confidence level based on similarity score.
 * @param score - Cosine similarity score [-1, 1]
 * @returns Confidence level classification
 */
export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= CONFIDENCE_THRESHOLDS.HIGH) return 'HIGH';
  if (score >= CONFIDENCE_THRESHOLDS.MEDIUM) return 'MEDIUM';
  return 'LOW';
}

/**
 * Categorizes a video and returns full result with confidence.
 * Combines similarity search with confidence classification.
 *
 * @param videoEmbedding - Video's embedding vector
 * @param categoryEmbeddings - Map of categoryId to category embedding
 * @returns { categoryId, confidence, score } or null if no categories
 */
export function categorizeWithConfidence(
  videoEmbedding: Float32Array,
  categoryEmbeddings: Map<number, Float32Array>
): { categoryId: number; confidence: ConfidenceLevel; score: number } | null {
  if (categoryEmbeddings.size === 0) {
    return null;
  }

  let bestMatch = { categoryId: -1, score: -Infinity };

  for (const [categoryId, catEmbedding] of categoryEmbeddings) {
    const similarity = cosineSimilarity(videoEmbedding, catEmbedding);
    if (similarity > bestMatch.score) {
      bestMatch = { categoryId, score: similarity };
    }
  }

  const confidence = getConfidenceLevel(bestMatch.score);

  return { ...bestMatch, confidence };
}
