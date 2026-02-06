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
  duplicateVideoCount?: number | null;
  sessionId?: number | null;
  confidence?: ConfidenceInfo | null;
  updatedAt?: Date | null;
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

// === Extended types for analysis workflow (Plan 02-06) ===

/** Algorithm mode for clustering: aggressive merges more, conservative merges less */
export type AlgorithmMode = 'conservative' | 'aggressive';

/** Confidence level bucketed from score: HIGH >= 70, MEDIUM >= 40, LOW < 40 */
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

/** Tracks a single analysis run with mode, counts, and staleness detection */
export interface AnalysisSession {
  id: number;
  mode: AlgorithmMode;
  playlistCount: number;
  proposalCount: number;
  duplicateCount: number;
  createdAt: Date;
  playlistDataTimestamp: Date;
  finalizedAt?: Date | null;
}

/** Confidence information for a cluster/proposal */
export interface ConfidenceInfo {
  score: number; // 0-100
  level: ConfidenceLevel;
  reason: string; // e.g. "Name similarity: 85%, Video overlap: 45%"
}

/** Input for splitting a proposal into new categories */
export interface SplitInput {
  name: string;
  playlistIds: number[];
}

/** Enriched duplicate record from the database with video and playlist details */
export interface DuplicateRecord {
  id: number; // duplicateVideos table primary key
  videoId: number;
  videoTitle: string;
  videoYoutubeId: string;
  playlistCount: number;
  playlists: Array<{ playlistId: number; playlistTitle: string; itemCount: number }>;
  resolvedPlaylistId: number | null;
}

/** Input for resolving a single duplicate video to a winning playlist */
export interface DuplicateResolution {
  duplicateRecordId: number;
  resolvedPlaylistId: number; // The playlist that "wins" for this video
}

/** Result from running a full analysis session */
export interface RunAnalysisResult {
  success: boolean;
  sessionId?: number;
  proposalCount?: number;
  duplicateCount?: number;
  errors?: string[];
}

/** Result from checking if analysis is stale relative to playlist data */
export interface StalenessCheck {
  isStale: boolean;
  lastAnalysisDate?: Date;
  lastSyncDate?: Date;
  message?: string;
}

/** Overview counts for the analysis dashboard */
export interface AnalysisSummary {
  totalPlaylists: number;
  proposedCategories: number;
  duplicatesFound: number;
  reviewedCount: number;
  approvedCount: number;
  rejectedCount: number;
  pendingCount: number;
}

/** Detailed video info for display in proposal detail views */
export interface VideoDetail {
  id: number;
  youtubeId: string;
  title: string;
  thumbnailUrl?: string;
  duration?: string;
  channelName?: string;
  publishedAt?: Date;
  sourcePlaylistId: number;
  sourcePlaylistTitle: string;
}

/** Metrics for a proposed category including validation status */
export interface CategoryMetrics {
  uniqueVideoCount: number;
  duplicateVideoCount: number;
  sourcePlaylistBreakdown: Array<{
    playlistId: number;
    playlistTitle: string;
    videoCount: number;
  }>;
  confidence: ConfidenceInfo;
  validationStatus: 'safe' | 'warning' | 'danger'; // <3000, 3000-4500, >4500
}
