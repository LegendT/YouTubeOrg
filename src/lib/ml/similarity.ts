/**
 * Cosine similarity calculation for normalized embedding vectors.
 *
 * For normalized vectors (from Transformers.js with normalize: true),
 * cosine similarity simplifies to dot product:
 *   cosine(a, b) = dot(a, b) / (||a|| * ||b||) = dot(a, b) / (1 * 1) = dot(a, b)
 *
 * This is significantly faster than computing magnitudes separately.
 */

/**
 * Calculates cosine similarity between two normalized vectors.
 * For normalized vectors (from Transformers.js with normalize: true),
 * cosine similarity simplifies to dot product.
 *
 * @param a - First embedding vector (Float32Array)
 * @param b - Second embedding vector (Float32Array)
 * @returns Similarity score in range [-1, 1] where 1 = identical, 0 = orthogonal, -1 = opposite
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimensions must match: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
  }

  // Vectors are already normalized by Transformers.js (normalize: true)
  // So cosine similarity = dot product
  return dotProduct;
}

/**
 * Finds the best matching category for a video embedding.
 * @param videoEmbedding - Video's embedding vector
 * @param categoryEmbeddings - Map of categoryId to category embedding
 * @returns { categoryId, score } of best match, or null if no categories provided
 */
export function findBestMatch(
  videoEmbedding: Float32Array,
  categoryEmbeddings: Map<number, Float32Array>
): { categoryId: number; score: number } | null {
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

  return bestMatch;
}
