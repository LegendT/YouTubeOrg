'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import {
  consolidationProposals,
  duplicateVideos,
  analysisSessions,
  playlists,
} from '@/lib/db/schema';
import { eq, desc, inArray, sql, count, max, ne, and } from 'drizzle-orm';
import { createConsolidationProposals, calculateDeduplicatedCount } from '@/lib/analysis/consolidation';
import { findDuplicateVideos, calculateOverlapStats } from '@/lib/analysis/duplicates';
import { clusterPlaylists } from '@/lib/analysis/clustering';
import { calculateConfidence } from '@/lib/analysis/confidence';
import type {
  ProposalGenerationResult,
  ProposalActionResult,
  ProposalsQueryResult,
  DuplicateStatsResult,
  RunAnalysisResult,
  StalenessCheck,
  AnalysisSummary,
  AnalysisSession,
  DuplicateResolution,
  SplitInput,
} from '@/types/analysis';
import type { AlgorithmMode } from '@/types/analysis';

/**
 * Generate consolidation proposals from existing playlists.
 *
 * Runs the full clustering + validation pipeline and persists
 * proposals to database with 'pending' status for user review.
 * Also detects and records duplicate videos across playlists.
 *
 * @param mode - Algorithm mode: 'aggressive' or 'conservative'
 * @returns Result with proposal count and duplicate count, or errors
 */
export async function generateConsolidationProposal(
  mode: AlgorithmMode = 'aggressive'
): Promise<ProposalGenerationResult> {
  try {
    // Step 0: Clear previous proposals and duplicates so we don't accumulate stale data
    await db.delete(consolidationProposals);
    await db.delete(duplicateVideos);

    // Step 1: Run clustering and validation
    const result = await createConsolidationProposals(mode);

    if (!result.success || !result.proposals) {
      return {
        success: false as const,
        errors: result.errors ?? ['Proposal generation failed'],
      };
    }

    // Step 2: Create an analysis session to track this run
    const allPlaylistRows = await db.select({ id: playlists.id }).from(playlists);
    const [session] = await db
      .insert(analysisSessions)
      .values({
        mode,
        playlistCount: allPlaylistRows.length,
        proposalCount: result.proposals.length,
        playlistDataTimestamp: new Date(),
      })
      .returning({ id: analysisSessions.id });

    // Step 3: Persist each proposal to database with 'pending' status
    for (const proposal of result.proposals) {
      await db.insert(consolidationProposals).values({
        categoryName: proposal.categoryName,
        sourcePlaylistIds: proposal.playlistIds,
        totalVideos: proposal.totalVideos,
        status: 'pending',
        sessionId: session.id,
        confidenceScore: proposal.confidence.score,
        confidenceReason: proposal.confidence.reason,
        uniqueVideoCount: proposal.totalVideos,
      });
    }

    // Step 4: Find and persist duplicate videos
    const duplicates = await findDuplicateVideos();
    for (const dup of duplicates) {
      await db.insert(duplicateVideos).values({
        videoId: dup.videoId,
        playlistIds: dup.playlists.map((p) => p.playlistId),
        occurrenceCount: dup.playlistCount,
        analyzedAt: new Date(),
        sessionId: session.id,
      });
    }

    // Step 5: Update session with duplicate count
    await db
      .update(analysisSessions)
      .set({ duplicateCount: duplicates.length })
      .where(eq(analysisSessions.id, session.id));

    revalidatePath('/analysis');

    return {
      success: true as const,
      proposalCount: result.proposals.length,
      duplicateCount: duplicates.length,
      sessionId: session.id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false as const,
      errors: [`Failed to generate proposals: ${message}`],
    };
  }
}

/**
 * Approve a consolidation proposal. Sets status to 'approved'
 * with timestamp for when the user confirmed the merge.
 */
export async function approveProposal(proposalId: number): Promise<ProposalActionResult> {
  try {
    await db
      .update(consolidationProposals)
      .set({
        status: 'approved',
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(consolidationProposals.id, proposalId));

    revalidatePath('/analysis');
    return { success: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false as const, error: message };
  }
}

/**
 * Reject a consolidation proposal with optional notes explaining why.
 */
export async function rejectProposal(proposalId: number, notes?: string): Promise<ProposalActionResult> {
  try {
    await db
      .update(consolidationProposals)
      .set({
        status: 'rejected',
        notes: notes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(consolidationProposals.id, proposalId));

    revalidatePath('/analysis');
    return { success: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false as const, error: message };
  }
}

/**
 * Fetch all consolidation proposals with their source playlist details.
 * Orders by total videos descending (largest categories first).
 */
export async function getProposals(): Promise<ProposalsQueryResult> {
  try {
    const proposals = await db
      .select()
      .from(consolidationProposals)
      .orderBy(desc(consolidationProposals.totalVideos));

    // Enrich each proposal with playlist titles
    const enriched = await Promise.all(
      proposals.map(async (proposal) => {
        const playlistIds = proposal.sourcePlaylistIds as number[];
        const playlistDetails =
          playlistIds.length > 0
            ? await db
                .select({ id: playlists.id, title: playlists.title })
                .from(playlists)
                .where(inArray(playlists.id, playlistIds))
            : [];

        return {
          id: proposal.id,
          categoryName: proposal.categoryName,
          playlists: playlistDetails,
          totalVideos: proposal.totalVideos,
          status: proposal.status,
          createdAt: proposal.createdAt,
          approvedAt: proposal.approvedAt,
          notes: proposal.notes,
          confidenceScore: proposal.confidenceScore,
          confidenceReason: proposal.confidenceReason,
          uniqueVideoCount: proposal.uniqueVideoCount,
          sessionId: proposal.sessionId,
        };
      })
    );

    return { success: true as const, proposals: enriched };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false as const, error: message, proposals: [] };
  }
}

/**
 * Get duplicate video statistics across all playlists.
 * Returns total unique videos, duplicate count, and duplication percentage.
 */
export async function getDuplicateStats(): Promise<DuplicateStatsResult> {
  try {
    const stats = await calculateOverlapStats();
    return { success: true as const, stats };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false as const, error: message };
  }
}

// === Enhanced server actions for analysis workflow (Plan 02-06) ===

/**
 * Run a full analysis session with mode selection and session tracking.
 *
 * Creates an analysis session record, clusters playlists using the specified
 * algorithm mode, enriches proposals with confidence data, detects duplicates,
 * and persists everything to the database.
 *
 * @param mode - 'aggressive' (25 clusters, more merging) or 'conservative' (35 clusters, less merging)
 * @returns Result with session ID, proposal count, duplicate count, or errors
 */
export async function runAnalysis(
  mode: AlgorithmMode = 'aggressive'
): Promise<RunAnalysisResult> {
  try {
    // Step 1: Count playlists and get latest data timestamp
    const allPlaylistRows = await db
      .select({
        id: playlists.id,
        lastFetched: playlists.lastFetched,
        youtubeId: playlists.youtubeId,
        title: playlists.title,
      })
      .from(playlists);

    const filteredPlaylists = allPlaylistRows.filter(
      (p) => p.youtubeId !== 'WL' && p.title !== 'Watch Later'
    );

    if (filteredPlaylists.length === 0) {
      return { success: false, errors: ['No playlists found to analyze'] };
    }

    // Determine the latest playlist data timestamp for staleness detection
    const latestFetched = filteredPlaylists.reduce(
      (latest, p) => (p.lastFetched > latest ? p.lastFetched : latest),
      filteredPlaylists[0].lastFetched
    );

    // Step 2: Create analysis session
    const [session] = await db
      .insert(analysisSessions)
      .values({
        mode,
        playlistCount: filteredPlaylists.length,
        playlistDataTimestamp: latestFetched,
      })
      .returning({ id: analysisSessions.id });

    // Step 3: Run clustering with mode parameter
    const clusters = await clusterPlaylists(mode);

    if (clusters.length === 0) {
      return { success: false, sessionId: session.id, errors: ['Clustering produced no results'] };
    }

    // Step 4: Persist enriched proposals with confidence data
    for (const cluster of clusters) {
      const playlistIds = cluster.playlists.map((p) => p.id);
      const dedupCount = await calculateDeduplicatedCount(playlistIds);
      const duplicateVideoCount = cluster.totalVideos - dedupCount;

      await db.insert(consolidationProposals).values({
        categoryName: cluster.categoryName,
        sourcePlaylistIds: playlistIds,
        totalVideos: dedupCount,
        status: 'pending',
        sessionId: session.id,
        confidenceScore: cluster.confidence.score,
        confidenceReason: cluster.confidence.reason,
        uniqueVideoCount: dedupCount,
        duplicateVideoCount: Math.max(0, duplicateVideoCount),
      });
    }

    // Step 5: Find and persist duplicate videos with session tracking
    const duplicates = await findDuplicateVideos();
    for (const dup of duplicates) {
      await db.insert(duplicateVideos).values({
        videoId: dup.videoId,
        playlistIds: dup.playlists.map((p) => p.playlistId),
        occurrenceCount: dup.playlistCount,
        analyzedAt: new Date(),
        sessionId: session.id,
      });
    }

    // Step 6: Update session with final counts
    await db
      .update(analysisSessions)
      .set({
        proposalCount: clusters.length,
        duplicateCount: duplicates.length,
      })
      .where(eq(analysisSessions.id, session.id));

    revalidatePath('/analysis');

    return {
      success: true,
      sessionId: session.id,
      proposalCount: clusters.length,
      duplicateCount: duplicates.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, errors: [`Failed to run analysis: ${message}`] };
  }
}

/**
 * Split a proposal into multiple new categories.
 *
 * Used by the split wizard when a proposed category is too broad.
 * Rejects the original proposal and creates new ones with manual
 * confidence scoring.
 *
 * @param proposalId - ID of the proposal to split
 * @param newCategories - Array of new category definitions with names and playlist IDs
 * @returns Result with new proposal IDs or error
 */
export async function splitProposal(
  proposalId: number,
  newCategories: SplitInput[]
): Promise<{ success: boolean; newProposalIds?: number[]; error?: string }> {
  try {
    if (newCategories.length === 0) {
      return { success: false, error: 'At least one new category is required' };
    }

    // Get the original proposal to inherit its session
    const [original] = await db
      .select()
      .from(consolidationProposals)
      .where(eq(consolidationProposals.id, proposalId))
      .limit(1);

    if (!original) {
      return { success: false, error: `Proposal ${proposalId} not found` };
    }

    // Reject the original with a note
    await db
      .update(consolidationProposals)
      .set({
        status: 'rejected',
        notes: `Split into ${newCategories.length} categories`,
        updatedAt: new Date(),
      })
      .where(eq(consolidationProposals.id, proposalId));

    // Create new proposals for each split category
    const newProposalIds: number[] = [];

    for (const category of newCategories) {
      const dedupCount = await calculateDeduplicatedCount(category.playlistIds);

      const [newProposal] = await db
        .insert(consolidationProposals)
        .values({
          categoryName: category.name,
          sourcePlaylistIds: category.playlistIds,
          totalVideos: dedupCount,
          status: 'pending',
          sessionId: original.sessionId,
          confidenceScore: 100,
          confidenceReason: 'Manually created via split wizard',
          uniqueVideoCount: dedupCount,
        })
        .returning({ id: consolidationProposals.id });

      newProposalIds.push(newProposal.id);
    }

    revalidatePath('/analysis');

    return { success: true, newProposalIds };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to split proposal: ${message}` };
  }
}

/**
 * Create a custom category from manually selected playlists.
 *
 * Validates the video count against the 4500 limit before creating.
 * Associates the proposal with the latest analysis session.
 *
 * @param name - Category name for the new proposal
 * @param playlistIds - Array of playlist IDs to include
 * @returns Result with new proposal ID or error
 */
export async function createCustomCategory(
  name: string,
  playlistIds: number[]
): Promise<{ success: boolean; proposalId?: number; error?: string }> {
  try {
    if (!name.trim()) {
      return { success: false, error: 'Category name is required' };
    }

    if (playlistIds.length === 0) {
      return { success: false, error: 'At least one playlist is required' };
    }

    // Calculate deduplicated video count
    const dedupCount = await calculateDeduplicatedCount(playlistIds);

    // Validate against YouTube's safe limit (4500)
    if (dedupCount > 4500) {
      return {
        success: false,
        error: `Category would have ${dedupCount} videos, exceeding the safe limit of 4500`,
      };
    }

    // Get latest session or create one if none exists
    const [latestSession] = await db
      .select()
      .from(analysisSessions)
      .orderBy(desc(analysisSessions.createdAt))
      .limit(1);

    let sessionId: number;

    if (latestSession) {
      sessionId = latestSession.id;
    } else {
      // Create a minimal session for custom category tracking
      const allPlaylistRows = await db.select({ id: playlists.id }).from(playlists);
      const [newSession] = await db
        .insert(analysisSessions)
        .values({
          mode: 'aggressive',
          playlistCount: allPlaylistRows.length,
          playlistDataTimestamp: new Date(),
        })
        .returning({ id: analysisSessions.id });
      sessionId = newSession.id;
    }

    // Create the custom proposal
    const [newProposal] = await db
      .insert(consolidationProposals)
      .values({
        categoryName: name.trim(),
        sourcePlaylistIds: playlistIds,
        totalVideos: dedupCount,
        status: 'pending',
        sessionId,
        confidenceScore: 100,
        confidenceReason: 'Manually created',
        uniqueVideoCount: dedupCount,
      })
      .returning({ id: consolidationProposals.id });

    revalidatePath('/analysis');

    return { success: true, proposalId: newProposal.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to create custom category: ${message}` };
  }
}

/**
 * Resolve duplicate videos by assigning a winning playlist to each.
 *
 * Bulk-updates duplicate video records with the selected playlist,
 * indicating which playlist should retain the video.
 *
 * @param resolutions - Array of duplicate resolution decisions
 * @returns Result with count of resolved duplicates
 */
export async function resolveDuplicates(
  resolutions: DuplicateResolution[]
): Promise<{ success: boolean; resolvedCount?: number; error?: string }> {
  try {
    if (resolutions.length === 0) {
      return { success: false, error: 'At least one resolution is required' };
    }

    let resolvedCount = 0;

    for (const resolution of resolutions) {
      const result = await db
        .update(duplicateVideos)
        .set({ resolvedPlaylistId: resolution.resolvedPlaylistId })
        .where(eq(duplicateVideos.id, resolution.duplicateRecordId));

      resolvedCount++;
    }

    revalidatePath('/analysis');

    return { success: true, resolvedCount };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to resolve duplicates: ${message}` };
  }
}

/**
 * Batch-update proposal statuses (approve or reject multiple at once).
 *
 * Sets approvedAt timestamp when approving, updatedAt for all changes.
 *
 * @param proposalIds - Array of proposal IDs to update
 * @param status - Target status: 'approved' or 'rejected'
 * @returns Result with count of updated proposals
 */
export async function bulkUpdateStatus(
  proposalIds: number[],
  status: 'approved' | 'rejected'
): Promise<{ success: boolean; updatedCount?: number; error?: string }> {
  try {
    if (proposalIds.length === 0) {
      return { success: false, error: 'At least one proposal ID is required' };
    }

    const now = new Date();
    const updateData: Record<string, unknown> = {
      status,
      updatedAt: now,
    };

    if (status === 'approved') {
      updateData.approvedAt = now;
    }

    await db
      .update(consolidationProposals)
      .set(updateData)
      .where(inArray(consolidationProposals.id, proposalIds));

    revalidatePath('/analysis');

    return { success: true, updatedCount: proposalIds.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Failed to bulk update: ${message}` };
  }
}

/**
 * Check if the current analysis is stale relative to playlist data.
 *
 * Compares the latest analysis session's playlistDataTimestamp against
 * the most recently fetched playlist. Staleness means playlists were
 * synced after the analysis ran, so results may be outdated.
 *
 * @returns Staleness check result with dates and message
 */
export async function checkStaleness(): Promise<StalenessCheck> {
  try {
    // Get the latest analysis session
    const [latestSession] = await db
      .select()
      .from(analysisSessions)
      .orderBy(desc(analysisSessions.createdAt))
      .limit(1);

    if (!latestSession) {
      return { isStale: false, message: 'No analysis run yet' };
    }

    // Get the latest playlist sync timestamp
    const [latestPlaylist] = await db
      .select({ lastFetched: max(playlists.lastFetched) })
      .from(playlists);

    const lastSyncDate = latestPlaylist?.lastFetched ?? null;

    if (!lastSyncDate) {
      return {
        isStale: false,
        lastAnalysisDate: latestSession.createdAt,
        message: 'No playlist data available',
      };
    }

    // Compare: if playlists were synced after the analysis session's data snapshot
    const isStale = lastSyncDate > latestSession.playlistDataTimestamp;

    return {
      isStale,
      lastAnalysisDate: latestSession.createdAt,
      lastSyncDate,
      message: isStale
        ? 'Playlist data has changed since last analysis. Re-analyze?'
        : 'Analysis is up to date',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { isStale: false, message: `Error checking staleness: ${message}` };
  }
}

/**
 * Get an overview summary of the analysis state.
 *
 * Returns counts for playlists, proposals by status, and duplicates
 * from the latest session. Used by the analysis dashboard overview card.
 *
 * @returns Analysis summary with all counts
 */
export async function getAnalysisSummary(): Promise<AnalysisSummary> {
  try {
    // Count playlists excluding Watch Later
    const playlistRows = await db
      .select({ id: playlists.id, youtubeId: playlists.youtubeId, title: playlists.title })
      .from(playlists);

    const totalPlaylists = playlistRows.filter(
      (p) => p.youtubeId !== 'WL' && p.title !== 'Watch Later'
    ).length;

    // Count proposals by status
    const allProposals = await db
      .select({ status: consolidationProposals.status })
      .from(consolidationProposals);

    const approvedCount = allProposals.filter((p) => p.status === 'approved').length;
    const rejectedCount = allProposals.filter((p) => p.status === 'rejected').length;
    const pendingCount = allProposals.filter((p) => p.status === 'pending').length;
    const reviewedCount = approvedCount + rejectedCount;
    const proposedCategories = allProposals.length;

    // Count duplicates from the latest session
    const [latestSession] = await db
      .select()
      .from(analysisSessions)
      .orderBy(desc(analysisSessions.createdAt))
      .limit(1);

    const duplicatesFound = latestSession?.duplicateCount ?? 0;

    return {
      totalPlaylists,
      proposedCategories,
      duplicatesFound,
      reviewedCount,
      approvedCount,
      rejectedCount,
      pendingCount,
    };
  } catch {
    return {
      totalPlaylists: 0,
      proposedCategories: 0,
      duplicatesFound: 0,
      reviewedCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      pendingCount: 0,
    };
  }
}

/**
 * Get the latest analysis session record.
 *
 * Returns the most recent session with all tracking data, or null
 * if no analysis has been run yet.
 *
 * @returns Latest AnalysisSession or null
 */
export async function getLatestSession(): Promise<AnalysisSession | null> {
  try {
    const [session] = await db
      .select()
      .from(analysisSessions)
      .orderBy(desc(analysisSessions.createdAt))
      .limit(1);

    if (!session) return null;

    return {
      id: session.id,
      mode: session.mode,
      playlistCount: session.playlistCount,
      proposalCount: session.proposalCount,
      duplicateCount: session.duplicateCount,
      createdAt: session.createdAt,
      playlistDataTimestamp: session.playlistDataTimestamp,
      finalizedAt: session.finalizedAt,
    };
  } catch {
    return null;
  }
}
