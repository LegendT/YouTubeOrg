import type { ConfidenceLevel } from '@/lib/ml/confidence';

/** Result of ML categorization for a single video (database record) */
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

/** Categorization result from ML engine (before database persistence) */
export interface CategorizationResult {
  videoId: number;
  suggestedCategoryId: number;
  confidence: ConfidenceLevel;
  similarityScore: number; // 0-100
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
