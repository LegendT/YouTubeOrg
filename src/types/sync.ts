/**
 * Phase 8: Batch Sync Operations - Type Definitions
 *
 * Types for the multi-stage sync pipeline that creates YouTube playlists
 * from categories, adds videos, and deletes old playlists.
 *
 * The sync process follows a state machine:
 * pending -> backup -> create_playlists -> add_videos -> delete_playlists -> completed
 *                                                                         -> failed
 *                                                                         -> paused (at any stage)
 */

export type SyncStage =
  | 'pending'
  | 'backup'
  | 'create_playlists'
  | 'add_videos'
  | 'delete_playlists'
  | 'completed'
  | 'failed'
  | 'paused';

export type PauseReason = 'quota_exhausted' | 'user_paused' | 'errors_collected';

export interface SyncError {
  stage: string;
  entityType: 'playlist' | 'video';
  entityId: string;
  message: string;
  timestamp: string; // ISO 8601
}

export interface StageResults {
  [stage: string]: {
    succeeded: number;
    failed: number;
    skipped: number;
  };
}

export interface SyncPreview {
  stages: {
    createPlaylists: {
      count: number;
      quotaCost: number;
      items: Array<{ categoryName: string; categoryId: number }>;
    };
    addVideos: {
      count: number;
      quotaCost: number;
      byCategory: Array<{ categoryName: string; categoryId: number; videoCount: number }>;
    };
    deletePlaylists: {
      count: number;
      quotaCost: number;
      items: Array<{ playlistName: string; playlistId: number; youtubeId: string }>;
    };
  };
  totalQuotaCost: number;
  estimatedDays: number;
  dailyQuotaLimit: number;
}

// Represents a syncJobs row as returned from the database
export interface SyncJobRecord {
  id: number;
  stage: SyncStage;
  currentStageProgress: number;
  currentStageTotal: number;
  stageResults: StageResults;
  errors: SyncError[];
  quotaUsedThisSync: number;
  pauseReason: PauseReason | null;
  previewData: SyncPreview | null;
  startedAt: Date;
  completedAt: Date | null;
  lastResumedAt: Date | null;
  backupSnapshotId: number | null;
}

// Represents a syncVideoOperations row
export type SyncVideoStatus = 'pending' | 'completed' | 'failed' | 'skipped';

export interface SyncVideoOperationRecord {
  id: number;
  syncJobId: number;
  categoryId: number;
  videoId: number;
  youtubeVideoId: string;
  status: SyncVideoStatus;
  errorMessage: string | null;
  completedAt: Date | null;
}

// Stage display labels for the UI
export const STAGE_LABELS: Record<SyncStage, string> = {
  pending: 'Ready to sync',
  backup: 'Creating backup',
  create_playlists: 'Creating playlists',
  add_videos: 'Adding videos',
  delete_playlists: 'Deleting old playlists',
  completed: 'Sync complete',
  failed: 'Sync failed',
  paused: 'Sync paused',
};
