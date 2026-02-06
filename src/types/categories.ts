export interface Category {
  id: number;
  name: string;
  sourceProposalId: number | null;
  videoCount: number;
  isProtected: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryVideo {
  id: number;
  categoryId: number;
  videoId: number;
  addedAt: Date;
  source: string;
}

export interface CategoryListItem {
  id: number;
  name: string;
  videoCount: number;
  isProtected: boolean;
  sourcePlaylistNames: string[];
  updatedAt: Date;
}

export interface DeleteUndoData {
  type: 'delete';
  categoryName: string;
  categoryId: number;
  videoIds: number[];
  wasProtected: boolean;
}

export interface MergeUndoData {
  type: 'merge';
  mergedCategoryId: number;
  originalCategories: Array<{
    name: string;
    videoIds: number[];
  }>;
}

export type UndoData = DeleteUndoData | MergeUndoData;

export interface CategoryActionResult {
  success: boolean;
  error?: string;
}

export interface DeleteCategoryResult extends CategoryActionResult {
  undoData?: DeleteUndoData;
  orphanedCount?: number;
}

export interface MergeCategoriesResult extends CategoryActionResult {
  mergedCategoryId?: number;
  totalVideos?: number;
  undoData?: MergeUndoData;
}

export interface VideoSearchResult {
  id: number;
  youtubeId: string;
  title: string;
  thumbnailUrl: string | null;
  channelTitle: string | null;
  duration: string | null;
  categoryNames: string[];
}
