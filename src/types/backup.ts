// Backup JSON file structure — uses stable YouTube IDs and category names, NOT internal serial IDs
export interface BackupData {
  version: '1.0';
  createdAt: string;
  trigger: string;
  data: {
    categories: BackupCategory[];
    mlCategorisations: BackupMLCategorization[];
    metadata: {
      totalCategories: number;
      totalVideos: number;
      totalCategorizations: number;
    };
  };
}

export interface BackupCategory {
  name: string;
  isProtected: boolean;
  videos: BackupCategoryVideo[];
}

export interface BackupCategoryVideo {
  youtubeId: string;
  title: string;
  source: string;
}

export interface BackupMLCategorization {
  videoYoutubeId: string;
  suggestedCategoryName: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  similarityScore: number;
  acceptedAt: string | null;
  rejectedAt: string | null;
  manualCategoryName: string | null;
}

export interface OperationLogEntry {
  id: number;
  action: string;
  entityType: string;
  entityIds: number[];
  metadata: Record<string, unknown> | null;
  backupSnapshotId: number | null;
  createdAt: Date;
}

export interface BackupSnapshotMeta {
  id: number;
  filename: string;
  trigger: string;
  scope: string;
  entityCount: number;
  fileSizeBytes: number;
  checksum: string;
  createdAt: Date;
}

export interface PendingChange {
  type: 'category_created' | 'category_deleted' | 'category_renamed' | 'videos_moved' | 'videos_added' | 'ml_accepted' | 'ml_rejected' | 'ml_recategorised';
  description: string;
  entityType: string;
  count: number;
  timestamp: Date;
}

export interface PendingChangeSummary {
  changes: PendingChange[];
  totalChanges: number;
  lastSyncTimestamp: Date | null;
}
