import { db } from '@/lib/db';
import { playlistVideos } from '@/lib/db/schema';
import { sql, inArray } from 'drizzle-orm';
import { clusterPlaylists, type AlgorithmMode, type ClusterResult } from './clustering';
import { validateConsolidation, type ValidationResult } from './validation';

export interface ProposalData {
  categoryName: string;
  playlistIds: number[];
  totalVideos: number;
  confidence: ClusterResult['confidence'];
}

export interface ConsolidationResult {
  success: boolean;
  proposals?: ProposalData[];
  errors?: string[];
}

/**
 * Generate consolidation proposals by clustering playlists and validating
 * the result against YouTube limits.
 *
 * Uses deduplicated video counts (not raw sums) to accurately represent
 * the true size of each proposed category after merging.
 *
 * @param mode - Algorithm mode: 'aggressive' (25 clusters) or 'conservative' (35 clusters)
 * @returns Structured result with proposals or validation errors
 */
export async function createConsolidationProposals(
  mode: AlgorithmMode = 'aggressive'
): Promise<ConsolidationResult> {
  try {
    // Step 1: Cluster playlists using combined distance metric
    const clusters = await clusterPlaylists(mode);

    if (clusters.length === 0) {
      return { success: false, errors: ['No playlists found to cluster'] };
    }

    // Step 2: Build proposals with deduplicated video counts
    const proposals: ProposalData[] = await Promise.all(
      clusters.map(async (cluster) => {
        const playlistIds = cluster.playlists.map((p) => p.id);
        const dedupCount = await calculateDeduplicatedCount(playlistIds);

        return {
          categoryName: cluster.categoryName,
          playlistIds,
          totalVideos: dedupCount,
          confidence: cluster.confidence,
        };
      })
    );

    // Step 3: Validate the entire proposal set against YouTube limits
    const validationInput = {
      categories: proposals.map((p) => ({
        categoryName: p.categoryName,
        playlistIds: p.playlistIds,
        totalVideos: p.totalVideos,
      })),
      totalCategories: proposals.length,
    };

    const validation: ValidationResult = await validateConsolidation(validationInput);

    if (!validation.valid) {
      return {
        success: false,
        proposals,
        errors: validation.errors,
      };
    }

    return { success: true, proposals };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error during proposal generation';
    return { success: false, errors: [message] };
  }
}

/**
 * Calculate the deduplicated video count across a set of playlists.
 *
 * Uses COUNT(DISTINCT videoId) to determine how many unique videos
 * would exist in a merged category. This is critical for accurate
 * validation -- raw sums would overcount shared videos and falsely
 * reject safe proposals.
 *
 * @param playlistIds - Array of playlist IDs to count across
 * @returns Number of unique videos across all specified playlists
 */
export async function calculateDeduplicatedCount(
  playlistIds: number[]
): Promise<number> {
  if (playlistIds.length === 0) return 0;

  const result = await db
    .select({
      count: sql<number>`count(distinct ${playlistVideos.videoId})`,
    })
    .from(playlistVideos)
    .where(inArray(playlistVideos.playlistId, playlistIds));

  return result[0]?.count ?? 0;
}
