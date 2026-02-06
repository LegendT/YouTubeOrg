/**
 * Shared type definitions for the playlist analysis and consolidation workflow.
 * Used by server actions, business logic, and client components.
 */

export type ProposalStatus = 'pending' | 'approved' | 'rejected';

export interface PlaylistSummary {
  id: number;
  title: string;
}

export interface ConsolidationProposal {
  id: number;
  categoryName: string;
  playlists: PlaylistSummary[];
  totalVideos: number;
  status: ProposalStatus;
  createdAt: Date;
  approvedAt?: Date | null;
  notes?: string | null;
  confidenceScore?: number | null;
  confidenceReason?: string | null;
  uniqueVideoCount?: number | null;
  sessionId?: number | null;
}

export interface DuplicateVideo {
  videoId: number;
  videoYoutubeId: string;
  title: string;
  playlistCount: number;
  playlists: Array<{ playlistId: number; playlistTitle: string }>;
}

export interface OverlapStats {
  totalUniqueVideos: number;
  duplicateVideoCount: number;
  duplicationPercentage: number;
}

export interface ProposalGenerationResult {
  success: boolean;
  proposalCount?: number;
  duplicateCount?: number;
  sessionId?: number;
  errors?: string[];
}

export interface ProposalActionResult {
  success: boolean;
  error?: string;
}

export interface ProposalsQueryResult {
  success: boolean;
  proposals: ConsolidationProposal[];
  error?: string;
}

export interface DuplicateStatsResult {
  success: boolean;
  stats?: OverlapStats;
  error?: string;
}
