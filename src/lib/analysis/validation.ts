import { z } from 'zod';

// YouTube playlist limits
export const YOUTUBE_PLAYLIST_LIMIT = 5000;
export const SAFETY_MARGIN = 500;
export const MAX_VIDEOS_PER_CATEGORY = YOUTUBE_PLAYLIST_LIMIT - SAFETY_MARGIN; // 4500

/**
 * Schema for a single playlist consolidation category.
 * Validates that no category exceeds the safe video limit.
 */
export const PlaylistConsolidationSchema = z.object({
  categoryName: z.string().min(1).max(100),
  playlistIds: z.array(z.number()).min(1),
  totalVideos: z.number().max(MAX_VIDEOS_PER_CATEGORY, {
    message: `Category exceeds safe limit of ${MAX_VIDEOS_PER_CATEGORY} videos (YouTube max: ${YOUTUBE_PLAYLIST_LIMIT})`,
  }),
});

/**
 * Schema for the complete consolidation proposal.
 * Validates overall category count targets 25-35 categories.
 */
export const ConsolidationProposalSchema = z.object({
  categories: z.array(PlaylistConsolidationSchema).min(1),
  totalCategories: z.number().min(1),
});

export type PlaylistConsolidation = z.infer<typeof PlaylistConsolidationSchema>;
export type ConsolidationProposal = z.infer<typeof ConsolidationProposalSchema>;

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * Validate a consolidation proposal against YouTube limits and category targets.
 * Returns { valid: true } if proposal is safe to execute, or
 * { valid: false, errors: [...] } with formatted error messages.
 */
export async function validateConsolidation(
  proposal: unknown
): Promise<ValidationResult> {
  const parsed = ConsolidationProposalSchema.safeParse(proposal);

  if (!parsed.success) {
    const errors = parsed.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`
    );
    return { valid: false, errors };
  }

  // Additional check: find any categories exceeding the video limit
  const overLimitCategories = parsed.data.categories.filter(
    (cat) => cat.totalVideos > MAX_VIDEOS_PER_CATEGORY
  );

  if (overLimitCategories.length > 0) {
    const errors = overLimitCategories.map(
      (cat) =>
        `Category "${cat.categoryName}" has ${cat.totalVideos} videos, exceeding safe limit of ${MAX_VIDEOS_PER_CATEGORY}`
    );
    return { valid: false, errors };
  }

  return { valid: true };
}
