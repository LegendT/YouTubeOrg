'use server';

import { db } from '@/lib/db';
import { videos, categories, mlCategorisations } from '@/lib/db/schema';
import type { RunMLCategorisationResult, MLCategorisationResult, CategorisationResult, ReviewResult, ReviewStats, VideoReviewDetail } from '@/types/ml';
import { eq, inArray, and, isNull, isNotNull, count, sql } from 'drizzle-orm';
import type { Category } from '@/types/categories';
import type { VideoCardData } from '@/types/videos';

/**
 * Fetch videos and categories for client-side categorisation.
 * Returns data needed for MLCategorisationEngine.
 */
export async function getDataForCategorisation(): Promise<{
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
        error: 'No categories available for ML categorisation',
      };
    }

    return {
      success: true,
      videos: videosToProcess.map((v) => ({
        ...v,
        categoryNames: [], // Not needed for categorisation
      })),
      categories: allCategories,
    };
  } catch (error) {
    console.error('[getDataForCategorisation] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Persist ML categorisation results to database.
 * Called from client after ML engine completes.
 */
export async function saveCategorisationResults(
  results: CategorisationResult[]
): Promise<RunMLCategorisationResult> {
  try {
    if (results.length === 0) {
      return {
        success: true,
        categorisedCount: 0,
        highConfidenceCount: 0,
        mediumConfidenceCount: 0,
        lowConfidenceCount: 0,
      };
    }

    // Delete existing ML categorisations for these videos (re-run scenario)
    const videoIds = results.map((r) => r.videoId);
    await db
      .delete(mlCategorisations)
      .where(inArray(mlCategorisations.videoId, videoIds));

    // Insert new categorisation results
    const categorisationRecords = results.map((result) => ({
      videoId: result.videoId,
      suggestedCategoryId: result.suggestedCategoryId,
      confidence: result.confidence,
      similarityScore: result.similarityScore,
      modelVersion: 'all-MiniLM-L6-v2',
    }));

    await db.insert(mlCategorisations).values(categorisationRecords);

    // Calculate statistics
    const highCount = results.filter((r) => r.confidence === 'HIGH').length;
    const mediumCount = results.filter((r) => r.confidence === 'MEDIUM').length;
    const lowCount = results.filter((r) => r.confidence === 'LOW').length;

    return {
      success: true,
      categorisedCount: results.length,
      highConfidenceCount: highCount,
      mediumConfidenceCount: mediumCount,
      lowConfidenceCount: lowCount,
    };
  } catch (error) {
    console.error('[saveCategorisationResults] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch ML categorisation results for a specific video.
 *
 * @param videoId - Video database ID
 * @returns ML categorisation result or null if not found
 */
export async function getMLCategorisationForVideo(
  videoId: number
): Promise<MLCategorisationResult | null> {
  try {
    const result = await db
      .select()
      .from(mlCategorisations)
      .where(eq(mlCategorisations.videoId, videoId))
      .limit(1);

    if (result.length === 0) return null;

    return result[0] as MLCategorisationResult;
  } catch (error) {
    console.error('[getMLCategorisationForVideo] Error:', error);
    return null;
  }
}

/**
 * Get all ML categorisation results, optionally filtered by confidence level.
 *
 * @param confidenceFilter - Optional: 'HIGH', 'MEDIUM', 'LOW'
 * @returns Array of categorisation results
 */
export async function getMLCategorisationResults(
  confidenceFilter?: 'HIGH' | 'MEDIUM' | 'LOW'
): Promise<MLCategorisationResult[]> {
  try {
    const results = confidenceFilter
      ? await db
          .select()
          .from(mlCategorisations)
          .where(eq(mlCategorisations.confidence, confidenceFilter))
      : await db.select().from(mlCategorisations);

    return results as MLCategorisationResult[];
  } catch (error) {
    console.error('[getMLCategorisationResults] Error:', error);
    return [];
  }
}

// --- Phase 6: Review & Approval Interface ---

/**
 * Accept an ML categorisation suggestion for a video.
 * Sets acceptedAt timestamp and clears any previous rejection.
 *
 * @param videoId - Video database ID
 * @returns Success status
 */
export async function acceptSuggestion(
  videoId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .update(mlCategorisations)
      .set({
        acceptedAt: new Date(),
        rejectedAt: null,
        manualCategoryId: null,
      })
      .where(eq(mlCategorisations.videoId, videoId));

    return { success: true };
  } catch (error) {
    console.error('[acceptSuggestion] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Reject an ML categorisation suggestion for a video.
 * Sets rejectedAt timestamp and clears any previous acceptance.
 *
 * @param videoId - Video database ID
 * @returns Success status
 */
export async function rejectSuggestion(
  videoId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .update(mlCategorisations)
      .set({
        rejectedAt: new Date(),
        acceptedAt: null,
      })
      .where(eq(mlCategorisations.videoId, videoId));

    return { success: true };
  } catch (error) {
    console.error('[rejectSuggestion] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Recategorise a video with a manual category choice.
 * Sets manualCategoryId and marks as rejected if not already.
 *
 * @param videoId - Video database ID
 * @param newCategoryId - User-chosen category ID
 * @returns Success status
 */
export async function recategoriseVideo(
  videoId: number,
  newCategoryId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // Fetch current state to check if already rejected
    const existing = await db
      .select({ rejectedAt: mlCategorisations.rejectedAt })
      .from(mlCategorisations)
      .where(eq(mlCategorisations.videoId, videoId))
      .limit(1);

    if (existing.length === 0) {
      return { success: false, error: 'No ML categorisation found for this video' };
    }

    const updateData: {
      manualCategoryId: number;
      rejectedAt?: Date;
      acceptedAt: null;
    } = {
      manualCategoryId: newCategoryId,
      acceptedAt: null,
    };

    // Set rejectedAt if not already rejected
    if (!existing[0].rejectedAt) {
      updateData.rejectedAt = new Date();
    }

    await db
      .update(mlCategorisations)
      .set(updateData)
      .where(eq(mlCategorisations.videoId, videoId));

    return { success: true };
  } catch (error) {
    console.error('[recategoriseVideo] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch enriched review data with three-way join (videos -> mlCategorisations -> categories).
 * Supports filtering by confidence level and review status.
 *
 * @param confidenceFilter - Optional: filter by confidence level
 * @param reviewStatus - Optional: 'all' | 'pending' | 'accepted' | 'rejected'
 * @returns Array of enriched review results
 */
export async function getReviewData(
  confidenceFilter?: 'HIGH' | 'MEDIUM' | 'LOW',
  reviewStatus?: 'all' | 'pending' | 'accepted' | 'rejected'
): Promise<ReviewResult[]> {
  try {
    // Build WHERE conditions
    const conditions = [];

    if (confidenceFilter) {
      conditions.push(eq(mlCategorisations.confidence, confidenceFilter));
    }

    if (reviewStatus === 'pending') {
      conditions.push(isNull(mlCategorisations.acceptedAt));
      conditions.push(isNull(mlCategorisations.rejectedAt));
    } else if (reviewStatus === 'accepted') {
      conditions.push(isNotNull(mlCategorisations.acceptedAt));
    } else if (reviewStatus === 'rejected') {
      conditions.push(isNotNull(mlCategorisations.rejectedAt));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Three-way join: videos -> mlCategorisations -> categories
    const results = await db
      .select({
        videoId: videos.id,
        youtubeId: videos.youtubeId,
        title: videos.title,
        thumbnailUrl: videos.thumbnailUrl,
        channelTitle: videos.channelTitle,
        duration: videos.duration,
        publishedAt: videos.publishedAt,
        suggestedCategoryId: mlCategorisations.suggestedCategoryId,
        suggestedCategoryName: categories.name,
        confidence: mlCategorisations.confidence,
        similarityScore: mlCategorisations.similarityScore,
        acceptedAt: mlCategorisations.acceptedAt,
        rejectedAt: mlCategorisations.rejectedAt,
        manualCategoryId: mlCategorisations.manualCategoryId,
      })
      .from(mlCategorisations)
      .innerJoin(videos, eq(mlCategorisations.videoId, videos.id))
      .innerJoin(categories, eq(mlCategorisations.suggestedCategoryId, categories.id))
      .where(whereClause);

    return results as ReviewResult[];
  } catch (error) {
    console.error('[getReviewData] Error:', error);
    return [];
  }
}

/**
 * Fetch full video details with ML categorisation context for review modal.
 * Includes suggested category details and all non-protected categories for manual picker.
 *
 * @param videoId - Video database ID
 * @returns Full review detail or null if not found
 */
export async function getVideoReviewDetail(
  videoId: number
): Promise<VideoReviewDetail | null> {
  try {
    // Fetch video data
    const videoResult = await db
      .select({
        id: videos.id,
        youtubeId: videos.youtubeId,
        title: videos.title,
        thumbnailUrl: videos.thumbnailUrl,
        duration: videos.duration,
        channelTitle: videos.channelTitle,
        publishedAt: videos.publishedAt,
      })
      .from(videos)
      .where(eq(videos.id, videoId))
      .limit(1);

    if (videoResult.length === 0) return null;

    // Fetch ML categorisation for this video
    const categorisationResult = await db
      .select()
      .from(mlCategorisations)
      .where(eq(mlCategorisations.videoId, videoId))
      .limit(1);

    if (categorisationResult.length === 0) return null;

    const categorisation = categorisationResult[0] as MLCategorisationResult;

    // Fetch suggested category
    const suggestedCategoryResult = await db
      .select()
      .from(categories)
      .where(eq(categories.id, categorisation.suggestedCategoryId))
      .limit(1);

    if (suggestedCategoryResult.length === 0) return null;

    // Fetch all non-protected categories for manual recategorisation picker
    const allCategories = await db
      .select()
      .from(categories)
      .where(eq(categories.isProtected, false));

    const video = videoResult[0];

    return {
      video: {
        ...video,
        categoryNames: [], // Not needed in review context
      },
      categorisation,
      suggestedCategory: suggestedCategoryResult[0] as Category,
      allCategories: allCategories as Category[],
    };
  } catch (error) {
    console.error('[getVideoReviewDetail] Error:', error);
    return null;
  }
}

/**
 * Calculate review statistics from mlCategorisations table.
 * Provides dashboard-level counts for total, reviewed, pending, and confidence breakdowns.
 *
 * @returns ReviewStats with 6 statistics
 */
export async function getReviewStats(): Promise<ReviewStats> {
  try {
    // Single query with conditional counts instead of 6 separate queries
    const result = await db
      .select({
        total: count(),
        reviewed: sql<string>`count(*) filter (where ${mlCategorisations.acceptedAt} is not null or ${mlCategorisations.rejectedAt} is not null)`,
        pending: sql<string>`count(*) filter (where ${mlCategorisations.acceptedAt} is null and ${mlCategorisations.rejectedAt} is null)`,
        highConfidence: sql<string>`count(*) filter (where ${mlCategorisations.confidence} = 'HIGH')`,
        mediumConfidence: sql<string>`count(*) filter (where ${mlCategorisations.confidence} = 'MEDIUM')`,
        lowConfidence: sql<string>`count(*) filter (where ${mlCategorisations.confidence} = 'LOW')`,
      })
      .from(mlCategorisations);

    const row = result[0];
    return {
      total: Number(row.total),
      reviewed: Number(row.reviewed),
      pending: Number(row.pending),
      highConfidence: Number(row.highConfidence),
      mediumConfidence: Number(row.mediumConfidence),
      lowConfidence: Number(row.lowConfidence),
    };
  } catch (error) {
    console.error('[getReviewStats] Error:', error);
    return {
      total: 0,
      reviewed: 0,
      pending: 0,
      highConfidence: 0,
      mediumConfidence: 0,
      lowConfidence: 0,
    };
  }
}
