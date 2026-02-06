/**
 * Confidence scoring for ML categorization predictions.
 *
 * Thresholds are empirical starting points based on sentence-transformers research.
 * These may need calibration after running on actual YouTube video data.
 * See .planning/phases/05-ml-categorization-engine/05-RESEARCH.md Open Question 3.
 */

import { cosineSimilarity } from './similarity';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Empirical thresholds for all-MiniLM-L6-v2 model.
 * These may need calibration based on actual categorization results.
 *
 * Thresholds:
 * - HIGH (≥0.75): Strong semantic match, high confidence in category assignment
 * - MEDIUM (0.60-0.74): Moderate match, reasonable confidence but may need review
 * - LOW (<0.60): Weak match, likely needs manual review or reassignment
 *
 * Note: These are starting points. Phase 05-02 will implement monitoring
 * to track actual accuracy by confidence level for threshold tuning.
 */
export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.75, // ≥0.75: Strong semantic match
  MEDIUM: 0.6, // 0.60-0.74: Moderate match
  // <0.60: Weak match (LOW)
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
