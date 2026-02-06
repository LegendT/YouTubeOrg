'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import {
  consolidationProposals,
  duplicateVideos,
  analysisSessions,
  playlists,
} from '@/lib/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import { createConsolidationProposals } from '@/lib/analysis/consolidation';
import { findDuplicateVideos, calculateOverlapStats } from '@/lib/analysis/duplicates';
import type { AlgorithmMode } from '@/lib/analysis/clustering';

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
) {
  try {
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
export async function approveProposal(proposalId: number) {
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
export async function rejectProposal(proposalId: number, notes?: string) {
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
export async function getProposals() {
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
export async function getDuplicateStats() {
  try {
    const stats = await calculateOverlapStats();
    return { success: true as const, stats };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false as const, error: message };
  }
}
