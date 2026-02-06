import type { ConfidenceLevel } from '@/lib/ml/confidence';

/** Result of ML categorization for a single video */
export interface MLCategorizationResult {
  id: number;
  videoId: number;
  suggestedCategoryId: number;
  confidence: ConfidenceLevel;
  similarityScore: number; // 0-100
  modelVersion: string;
  createdAt: Date;
  acceptedAt: Date | null;
  rejectedAt: Date | null;
  manualCategoryId: number | null;
}

/** Progress update during batch categorization */
export interface MLProgressUpdate {
  current: number;
  total: number;
  percentage: number;
  status: string;
}

/** Result of runMLCategorization server action */
export interface RunMLCategorizationResult {
  success: boolean;
  error?: string;
  categorizedCount?: number;
  highConfidenceCount?: number;
  mediumConfidenceCount?: number;
  lowConfidenceCount?: number;
}
