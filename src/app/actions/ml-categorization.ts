'use server';

import { db } from '@/lib/db';
import { videos, categories, mlCategorizations } from '@/lib/db/schema';
import type { RunMLCategorizationResult, MLCategorizationResult, CategorizationResult } from '@/types/ml';
import { eq, inArray } from 'drizzle-orm';
import type { Category } from '@/types/categories';
import type { VideoCardData } from '@/types/videos';

/**
 * Fetch videos and categories for client-side categorization.
 * Returns data needed for MLCategorizationEngine.
 */
export async function getDataForCategorization(): Promise<{
  success: boolean;
  error?: string;
  videos?: VideoCardData[];
  categories?: Category[];
}> {
  try {
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

    return {
      success: true,
      videos: videosToProcess.map((v) => ({
        ...v,
        categoryNames: [], // Not needed for categorization
      })),
      categories: allCategories,
    };
  } catch (error) {
    console.error('[getDataForCategorization] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Persist ML categorization results to database.
 * Called from client after ML engine completes.
 */
export async function saveCategorizationResults(
  results: CategorizationResult[]
): Promise<RunMLCategorizationResult> {
  try {
    if (results.length === 0) {
      return {
        success: true,
        categorizedCount: 0,
        highConfidenceCount: 0,
        mediumConfidenceCount: 0,
        lowConfidenceCount: 0,
      };
    }

    // Delete existing ML categorizations for these videos (re-run scenario)
    const videoIds = results.map((r) => r.videoId);
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

    // Calculate statistics
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
    console.error('[saveCategorizationResults] Error:', error);
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
