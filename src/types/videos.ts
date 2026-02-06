/**
 * Shared type definitions for Phase 4 video display and organization.
 * Used by video browsing components and video list interfaces.
 */

/** Data structure for video card display in lists and grids */
export interface VideoCardData {
  id: number;
  youtubeId: string;
  title: string;
  thumbnailUrl: string | null;
  duration: string | null;
  channelTitle: string | null;
  publishedAt: Date | null;
  categoryNames: string[];
}

/** Sort options for video lists */
export type SortOption =
  | 'dateAdded' // Newest to oldest by categoryVideos.addedAt
  | 'dateAddedOldest' // Oldest to newest by categoryVideos.addedAt
  | 'publishedAt' // Newest to oldest by videos.publishedAt
  | 'title' // A-Z by videos.title
  | 'duration'; // Longest to shortest by videos.duration

/** Undo data for moving videos between categories */
export interface MoveUndoData {
  type: 'move';
  videoIds: number[];
  fromCategoryId: number;
  toCategoryId: number;
  fromCategoryName: string;
  toCategoryName: string;
}

/** Undo data for copying videos to categories */
export interface CopyUndoData {
  type: 'copy';
  videoIds: number[];
  toCategoryId: number;
  toCategoryName: string;
  categoryVideoIds: number[]; // categoryVideos.id for removal
}

export type VideoUndoData = MoveUndoData | CopyUndoData;
