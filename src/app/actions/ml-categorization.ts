'use server';

import { db } from '@/lib/db';
import { videos, categories, mlCategorizations } from '@/lib/db/schema';
import { MLCategorizationEngine } from '@/lib/ml/categorization-engine';
import type { RunMLCategorizationResult, MLCategorizationResult } from '@/types/ml';
import { eq, inArray } from 'drizzle-orm';

/**
 * Run ML categorization on all uncategorized videos.
 * Note: Progress updates happen client-side (server actions don't stream).
 *
 * @returns Result with success status and categorization counts
 */
export async function runMLCategorization(): Promise<RunMLCategorizationResult> {
  try {
    // Step 1: Fetch all videos that need categorization
    // For Phase 5: categorize all videos (no filter)
    // For Phase 6: filter to Watch Later or uncategorized videos
    const videosToProcess = await db
      .select({
        id: videos.id,
        youtubeId: videos.youtubeId,
        title: videos.title,
        thumbnailUrl: videos.thumbnailUrl,
        duration: videos.duration,
        channelTitle: videos.channelTitle,
        publishedAt: videos.publishedAt,
      })
      .from(videos);

    if (videosToProcess.length === 0) {
      return {
        success: true,
        categorizedCount: 0,
        highConfidenceCount: 0,
        mediumConfidenceCount: 0,
        lowConfidenceCount: 0,
      };
    }

    // Step 2: Fetch all categories (exclude protected "Uncategorized")
    const allCategories = await db
      .select()
      .from(categories)
      .where(eq(categories.isProtected, false));

    if (allCategories.length === 0) {
      return {
        success: false,
        error: 'No categories available for ML categorization',
      };
    }

    // Step 3: Run ML categorization engine
    // Note: Progress callbacks don't work in server actions (no streaming)
    // Progress will be tracked client-side in Plan 04
    const engine = new MLCategorizationEngine();

    const results = await engine.categorizeVideos(
      videosToProcess.map((v) => ({
        ...v,
        categoryNames: [], // Not needed for categorization
      })),
      allCategories
    );

    engine.terminate();

    // Step 4: Persist results to database
    // Delete existing ML categorizations for these videos (re-run scenario)
    const videoIds = videosToProcess.map((v) => v.id);
    await db
      .delete(mlCategorizations)
      .where(inArray(mlCategorizations.videoId, videoIds));

    // Insert new categorization results
    const categorizationRecords = results.map((result) => ({
      videoId: result.videoId,
      suggestedCategoryId: result.suggestedCategoryId,
      confidence: result.confidence,
      similarityScore: result.similarityScore,
      modelVersion: 'all-MiniLM-L6-v2',
    }));

    await db.insert(mlCategorizations).values(categorizationRecords);

    // Step 5: Calculate statistics
    const highCount = results.filter((r) => r.confidence === 'HIGH').length;
    const mediumCount = results.filter((r) => r.confidence === 'MEDIUM').length;
    const lowCount = results.filter((r) => r.confidence === 'LOW').length;

    return {
      success: true,
      categorizedCount: results.length,
      highConfidenceCount: highCount,
      mediumConfidenceCount: mediumCount,
      lowConfidenceCount: lowCount,
    };
  } catch (error) {
    console.error('[runMLCategorization] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch ML categorization results for a specific video.
 *
 * @param videoId - Video database ID
 * @returns ML categorization result or null if not found
 */
export async function getMLCategorizationForVideo(
  videoId: number
): Promise<MLCategorizationResult | null> {
  try {
    const result = await db
      .select()
      .from(mlCategorizations)
      .where(eq(mlCategorizations.videoId, videoId))
      .limit(1);

    if (result.length === 0) return null;

    return result[0] as MLCategorizationResult;
  } catch (error) {
    console.error('[getMLCategorizationForVideo] Error:', error);
    return null;
  }
}

/**
 * Get all ML categorization results, optionally filtered by confidence level.
 *
 * @param confidenceFilter - Optional: 'HIGH', 'MEDIUM', 'LOW'
 * @returns Array of categorization results
 */
export async function getMLCategorizationResults(
  confidenceFilter?: 'HIGH' | 'MEDIUM' | 'LOW'
): Promise<MLCategorizationResult[]> {
  try {
    const results = confidenceFilter
      ? await db
          .select()
          .from(mlCategorizations)
          .where(eq(mlCategorizations.confidence, confidenceFilter))
      : await db.select().from(mlCategorizations);

    return results as MLCategorizationResult[];
  } catch (error) {
    console.error('[getMLCategorizationResults] Error:', error);
    return [];
  }
}
