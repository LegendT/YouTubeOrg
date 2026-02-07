/**
 * Batch categorization orchestrator for ML-powered video categorization.
 *
 * Coordinates:
 * - Web Worker for embeddings generation (Transformers.js)
 * - IndexedDB cache for persistent storage
 * - Confidence scoring for category assignment
 *
 * Usage:
 *   const engine = new MLCategorizationEngine();
 *   const results = await engine.categorizeVideos(videos, categories, onProgress);
 *   engine.terminate(); // Clean up worker
 *
 * Architecture:
 * 1. Pre-compute category embeddings (reused for all videos)
 * 2. Process videos in batches of 32
 * 3. Check cache before generating embeddings
 * 4. Generate embeddings for uncached videos only
 * 5. Find best category match via cosine similarity
 * 6. Scale similarity score to 0-100 for storage
 */

import type { Category } from '@/types/categories';
import type { VideoCardData } from '@/types/videos';
import { EmbeddingsCache } from './embeddings-cache';
import { categorizeWithConfidence, type ConfidenceLevel } from './confidence';

const MODEL_VERSION = 'all-MiniLM-L6-v2';
const EMBEDDING_DIM = 384; // all-MiniLM-L6-v2 embedding dimension
const BATCH_SIZE = 32; // Per RESEARCH.md recommendation for browser performance

export interface CategorizationResult {
  videoId: number;
  suggestedCategoryId: number;
  confidence: ConfidenceLevel;
  similarityScore: number; // 0-100 for UI display
}

export interface ProgressCallback {
  (current: number, total: number, percentage: number, status: string): void;
}

export class MLCategorizationEngine {
  private worker: Worker | null = null;
  private embeddingsCache: EmbeddingsCache;
  private pendingRequests = new Map<string, { resolve: Function; reject: Function }>();

  constructor() {
    this.embeddingsCache = new EmbeddingsCache();
  }

  /**
   * Initialize Web Worker for embeddings generation.
   * Lazy initialization to avoid loading model until needed.
   */
  private initWorker(): void {
    if (this.worker) return;

    // Create worker from worker.ts file
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), {
      type: 'module',
    });

    this.worker.addEventListener('message', (event: MessageEvent) => {
      const { type, id, embeddings, progress, error } = event.data;

      if (type === 'EMBEDDINGS_RESULT') {
        const pending = this.pendingRequests.get(id);
        if (pending) {
          // Validate embeddings structure
          if (!embeddings || !Array.isArray(embeddings) || embeddings.length === 0) {
            console.error('[Engine] Invalid embeddings received:', embeddings);
            pending.reject(new Error('Invalid embeddings received from worker'));
            this.pendingRequests.delete(id);
            return;
          }

          // Ensure all embeddings are Float32Arrays with correct dimensions
          const typedEmbeddings: Float32Array[] = embeddings.map((e: any) => {
            if (e instanceof Float32Array) {
              return e;
            }
            // Convert to Float32Array if needed (handles structured clone edge cases)
            return new Float32Array(e);
          });

          pending.resolve(typedEmbeddings);
          this.pendingRequests.delete(id);
        }
      } else if (type === 'ERROR') {
        console.error('[Engine] Worker error:', error);
        const pending = this.pendingRequests.get(id);
        if (pending) {
          pending.reject(new Error(error || 'Unknown worker error'));
          this.pendingRequests.delete(id);
        }
      } else if (type === 'LOAD_PROGRESS') {
        console.log('[ML Worker] Model loading progress:', progress);
      }
    });

    this.worker.addEventListener('error', (error) => {
      console.error('[ML Worker] Error:', error);
      // Reject all pending requests
      for (const pending of this.pendingRequests.values()) {
        pending.reject(new Error('Worker error'));
      }
      this.pendingRequests.clear();
    });
  }

  /**
   * Generate embeddings for texts using Web Worker.
   * Returns cached embeddings when available.
   */
  private async generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
    this.initWorker();

    if (!this.worker) {
      console.error('[Engine] Worker failed to initialize');
      throw new Error('Worker failed to initialize');
    }

    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).substring(2);
      this.pendingRequests.set(id, { resolve, reject });

      this.worker!.postMessage({
        type: 'GENERATE_EMBEDDINGS',
        texts,
        id,
      });

      // 60 second timeout for batch processing
      setTimeout(() => {
        const pending = this.pendingRequests.get(id);
        if (pending) {
          console.error(`[Engine] Embedding generation timed out after 60s`);
          pending.reject(new Error('Embedding generation timeout'));
          this.pendingRequests.delete(id);
        }
      }, 60000);
    });
  }

  /**
   * Pre-compute category embeddings from category names.
   * Returns Map<categoryId, embedding>.
   */
  async generateCategoryEmbeddings(
    categories: Category[]
  ): Promise<Map<number, Float32Array>> {
    const categoryTexts = categories.map((c) => c.name);
    const embeddings = await this.generateEmbeddings(categoryTexts);

    const categoryEmbeddings = new Map<number, Float32Array>();
    categories.forEach((category, index) => {
      categoryEmbeddings.set(category.id, embeddings[index]);
    });

    return categoryEmbeddings;
  }

  /**
   * Categorize videos in batches with progress updates.
   * Main orchestration method coordinating cache, worker, and similarity.
   */
  async categorizeVideos(
    videos: VideoCardData[],
    categories: Category[],
    onProgress?: ProgressCallback
  ): Promise<CategorizationResult[]> {
    const results: CategorizationResult[] = [];

    // Step 1: Pre-compute category embeddings (reused for all videos)
    onProgress?.(0, videos.length, 0, 'Preparing categories...');
    const categoryEmbeddings = await this.generateCategoryEmbeddings(categories);

    // Step 2: Process videos in batches
    for (let i = 0; i < videos.length; i += BATCH_SIZE) {
      const batch = videos.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(videos.length / BATCH_SIZE);

      onProgress?.(
        i,
        videos.length,
        Math.round((i / videos.length) * 100),
        `Processing batch ${batchNum}/${totalBatches}...`
      );

      // Step 2a: Check cache for existing embeddings
      const rawCachedEmbeddings = await this.embeddingsCache.getBatch(
        batch.map((v) => v.id),
        MODEL_VERSION
      );

      // Validate cached embeddings (defensive: check dimensions to avoid corrupted cache)
      const validCachedEmbeddings = new Map<number, Float32Array>();
      const invalidVideoIds: number[] = [];

      for (const [videoId, embedding] of rawCachedEmbeddings) {
        if (
          embedding &&
          embedding instanceof Float32Array &&
          embedding.length === EMBEDDING_DIM
        ) {
          validCachedEmbeddings.set(videoId, embedding);
        } else {
          console.warn(
            `[Engine] Invalid cached embedding for video ${videoId}: ` +
            `${embedding ? `${embedding.length} dims (expected ${EMBEDDING_DIM})` : 'undefined'}`
          );
          invalidVideoIds.push(videoId);
        }
      }

      if (invalidVideoIds.length > 0) {
        console.warn(
          `[Engine] Found ${invalidVideoIds.length} corrupted cache entries, will regenerate`
        );
      }

      // Step 2b: Generate embeddings for uncached or invalid videos
      const uncachedVideos = batch.filter(
        (v) => !validCachedEmbeddings.has(v.id)
      );
      if (uncachedVideos.length > 0) {
        const texts = uncachedVideos.map(
          (v) => `${v.title} ${v.channelTitle || ''}`
        );
        const newEmbeddings = await this.generateEmbeddings(texts);

        // Cache new embeddings
        await this.embeddingsCache.setBatch(
          uncachedVideos.map((v, idx) => ({
            videoId: v.id,
            embedding: newEmbeddings[idx],
          })),
          MODEL_VERSION
        );

        // Merge with validated cached embeddings
        uncachedVideos.forEach((v, idx) => {
          validCachedEmbeddings.set(v.id, newEmbeddings[idx]);
        });
      }

      // Step 2c: Categorize each video in batch
      for (const video of batch) {
        const videoEmbedding = validCachedEmbeddings.get(video.id);

        if (!videoEmbedding) {
          console.error(`[Engine] No embedding found for video ${video.id}`);
          continue;
        }

        const match = categorizeWithConfidence(videoEmbedding, categoryEmbeddings);

        // Skip if no match (shouldn't happen since we pre-computed categories)
        if (!match) {
          console.warn(`[Engine] No category match for video ${video.id}`);
          continue;
        }

        results.push({
          videoId: video.id,
          suggestedCategoryId: match.categoryId,
          confidence: match.confidence,
          similarityScore: Math.round(match.score * 100), // Convert to 0-100
        });
      }
    }

    // Final progress update
    onProgress?.(videos.length, videos.length, 100, 'Categorization complete');

    return results;
  }

  /**
   * Terminate worker and cleanup resources.
   * Call when categorization is complete.
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingRequests.clear();
  }
}
