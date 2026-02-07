'use server';

import { db } from '@/lib/db';
import { videos, categories, mlCategorizations } from '@/lib/db/schema';
import type { RunMLCategorizationResult, MLCategorizationResult, CategorizationResult, ReviewResult, ReviewStats, VideoReviewDetail } from '@/types/ml';
import { eq, inArray, and, isNull, isNotNull, count, sql } from 'drizzle-orm';
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

// --- Phase 6: Review & Approval Interface ---

/**
 * Accept an ML categorization suggestion for a video.
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
      .update(mlCategorizations)
      .set({
        acceptedAt: new Date(),
        rejectedAt: null,
        manualCategoryId: null,
      })
      .where(eq(mlCategorizations.videoId, videoId));

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
 * Reject an ML categorization suggestion for a video.
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
      .update(mlCategorizations)
      .set({
        rejectedAt: new Date(),
        acceptedAt: null,
      })
      .where(eq(mlCategorizations.videoId, videoId));

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
export async function recategorizeVideo(
  videoId: number,
  newCategoryId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // Fetch current state to check if already rejected
    const existing = await db
      .select({ rejectedAt: mlCategorizations.rejectedAt })
      .from(mlCategorizations)
      .where(eq(mlCategorizations.videoId, videoId))
      .limit(1);

    if (existing.length === 0) {
      return { success: false, error: 'No ML categorization found for this video' };
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
      .update(mlCategorizations)
      .set(updateData)
      .where(eq(mlCategorizations.videoId, videoId));

    return { success: true };
  } catch (error) {
    console.error('[recategorizeVideo] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch enriched review data with three-way join (videos -> mlCategorizations -> categories).
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
      conditions.push(eq(mlCategorizations.confidence, confidenceFilter));
    }

    if (reviewStatus === 'pending') {
      conditions.push(isNull(mlCategorizations.acceptedAt));
      conditions.push(isNull(mlCategorizations.rejectedAt));
    } else if (reviewStatus === 'accepted') {
      conditions.push(isNotNull(mlCategorizations.acceptedAt));
    } else if (reviewStatus === 'rejected') {
      conditions.push(isNotNull(mlCategorizations.rejectedAt));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Three-way join: videos -> mlCategorizations -> categories
    const results = await db
      .select({
        videoId: videos.id,
        youtubeId: videos.youtubeId,
        title: videos.title,
        thumbnailUrl: videos.thumbnailUrl,
        channelTitle: videos.channelTitle,
        duration: videos.duration,
        publishedAt: videos.publishedAt,
        suggestedCategoryId: mlCategorizations.suggestedCategoryId,
        suggestedCategoryName: categories.name,
        confidence: mlCategorizations.confidence,
        similarityScore: mlCategorizations.similarityScore,
        acceptedAt: mlCategorizations.acceptedAt,
        rejectedAt: mlCategorizations.rejectedAt,
        manualCategoryId: mlCategorizations.manualCategoryId,
      })
      .from(mlCategorizations)
      .innerJoin(videos, eq(mlCategorizations.videoId, videos.id))
      .innerJoin(categories, eq(mlCategorizations.suggestedCategoryId, categories.id))
      .where(whereClause);

    return results as ReviewResult[];
  } catch (error) {
    console.error('[getReviewData] Error:', error);
    return [];
  }
}

/**
 * Fetch full video details with ML categorization context for review modal.
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

    // Fetch ML categorization for this video
    const categorizationResult = await db
      .select()
      .from(mlCategorizations)
      .where(eq(mlCategorizations.videoId, videoId))
      .limit(1);

    if (categorizationResult.length === 0) return null;

    const categorization = categorizationResult[0] as MLCategorizationResult;

    // Fetch suggested category
    const suggestedCategoryResult = await db
      .select()
      .from(categories)
      .where(eq(categories.id, categorization.suggestedCategoryId))
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
      categorization,
      suggestedCategory: suggestedCategoryResult[0] as Category,
      allCategories: allCategories as Category[],
    };
  } catch (error) {
    console.error('[getVideoReviewDetail] Error:', error);
    return null;
  }
}

/**
 * Calculate review statistics from mlCategorizations table.
 * Provides dashboard-level counts for total, reviewed, pending, and confidence breakdowns.
 *
 * @returns ReviewStats with 6 statistics
 */
export async function getReviewStats(): Promise<ReviewStats> {
  try {
    // Total count
    const totalResult = await db
      .select({ value: count() })
      .from(mlCategorizations);
    const total = Number(totalResult[0].value);

    // Reviewed count (accepted OR rejected)
    const reviewedResult = await db
      .select({ value: count() })
      .from(mlCategorizations)
      .where(
        sql`${mlCategorizations.acceptedAt} IS NOT NULL OR ${mlCategorizations.rejectedAt} IS NOT NULL`
      );
    const reviewed = Number(reviewedResult[0].value);

    // Pending count (neither accepted nor rejected)
    const pendingResult = await db
      .select({ value: count() })
      .from(mlCategorizations)
      .where(
        and(
          isNull(mlCategorizations.acceptedAt),
          isNull(mlCategorizations.rejectedAt)
        )
      );
    const pending = Number(pendingResult[0].value);

    // Confidence level counts
    const highResult = await db
      .select({ value: count() })
      .from(mlCategorizations)
      .where(eq(mlCategorizations.confidence, 'HIGH'));
    const highConfidence = Number(highResult[0].value);

    const mediumResult = await db
      .select({ value: count() })
      .from(mlCategorizations)
      .where(eq(mlCategorizations.confidence, 'MEDIUM'));
    const mediumConfidence = Number(mediumResult[0].value);

    const lowResult = await db
      .select({ value: count() })
      .from(mlCategorizations)
      .where(eq(mlCategorizations.confidence, 'LOW'));
    const lowConfidence = Number(lowResult[0].value);

    return {
      total,
      reviewed,
      pending,
      highConfidence,
      mediumConfidence,
      lowConfidence,
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
