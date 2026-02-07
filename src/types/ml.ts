import type { ConfidenceLevel } from '@/lib/ml/confidence';
import type { Category } from '@/types/categories';
import type { VideoCardData } from '@/types/videos';

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

// --- Phase 6: Review & Approval Interface ---

/** Enriched review data combining video metadata with ML categorization details */
export interface ReviewResult {
  videoId: number;
  youtubeId: string;
  title: string;
  thumbnailUrl: string | null;
  channelTitle: string | null;
  duration: string | null;
  publishedAt: Date | null;
  suggestedCategoryId: number;
  suggestedCategoryName: string;
  confidence: ConfidenceLevel;
  similarityScore: number; // 0-100
  acceptedAt: Date | null;
  rejectedAt: Date | null;
  manualCategoryId: number | null;
}

/** Statistics summary for ML review dashboard */
export interface ReviewStats {
  total: number;
  reviewed: number;
  pending: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
}

/** Full video detail for review modal display */
export interface VideoReviewDetail {
  video: VideoCardData;
  categorization: MLCategorizationResult;
  suggestedCategory: Category;
  allCategories: Category[];
}
