'use client';

import { useState, useEffect, useMemo } from 'react';
import type { CategoryListItem } from '@/types/categories';
import type { VideoCardData, SortOption } from '@/types/videos';
import { getCategories } from '@/app/actions/categories';
import { getVideosForCategory, removeVideosFromCategory } from '@/app/actions/videos';
import { assignVideosToCategory } from '@/app/actions/categories';
import { CategorySidebar } from './category-sidebar';
import { VideoToolbar } from './video-toolbar';
import { VideoGrid } from './video-grid';
import { MoveCopyDialog } from './move-copy-dialog';
import { UndoBanner } from '@/components/analysis/undo-banner';
import { useUndoStack } from '@/lib/categories/undo-stack';
import { parseDurationToSeconds } from '@/lib/videos/format';
import { Loader2 } from 'lucide-react';

interface VideoBrowsePageProps {
  initialCategories: CategoryListItem[];
  initialVideos: VideoCardData[];
  totalVideoCount: number;
}

/**
 * Main orchestrator for video browsing (Client Component).
 *
 * Manages all state: category selection, search, sort, selection,
 * move/copy dialog, and undo support. Wires together sidebar, toolbar,
 * grid, and dialogs.
 */
export function VideoBrowsePage({
  initialCategories,
  initialVideos,
  totalVideoCount,
}: VideoBrowsePageProps) {
  // Category selection
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [categories, setCategories] = useState(initialCategories);
  const [videos, setVideos] = useState(initialVideos);
  const [isLoading, setIsLoading] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchScope, setSearchScope] = useState<'category' | 'all'>('category');

  // Sort
  const [currentSort, setCurrentSort] = useState<SortOption>('dateAdded');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Move/Copy dialog
  const [moveCopyOpen, setMoveCopyOpen] = useState(false);
  const [moveCopyMode, setMoveCopyMode] = useState<'move' | 'copy'>('move');

  // Undo
  const undoStack = useUndoStack();

  // Debounce search query (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle category selection
  const handleSelectCategory = async (categoryId: number | null) => {
    setIsLoading(true);
    setSelectedCategoryId(categoryId);
    setSearchQuery('');
    setDebouncedQuery('');
    setSelectedIds(new Set());
    setSearchScope('category');

    const newVideos = await getVideosForCategory(categoryId);
    setVideos(newVideos);
    setIsLoading(false);
  };

  // Handle search scope toggle
  const handleSearchScopeChange = async (scope: 'category' | 'all') => {
    setSearchScope(scope);
    if (scope === 'all' && selectedCategoryId !== null) {
      // Load all videos for "all" scope when viewing a specific category
      setIsLoading(true);
      const allVideos = await getVideosForCategory(null);
      setVideos(allVideos);
      setIsLoading(false);
    } else if (scope === 'category' && selectedCategoryId !== null) {
      // Re-load category videos when toggling back to "category" scope
      setIsLoading(true);
      const categoryVideos = await getVideosForCategory(selectedCategoryId);
      setVideos(categoryVideos);
      setIsLoading(false);
    }
  };

  // Filter videos based on search query
  const filteredVideos = useMemo(() => {
    if (!debouncedQuery) return videos;

    const query = debouncedQuery.toLowerCase();
    return videos.filter((video) => {
      return (
        video.title.toLowerCase().includes(query) ||
        video.channelTitle?.toLowerCase().includes(query) ||
        video.categoryNames.some((name) => name.toLowerCase().includes(query))
      );
    });
  }, [videos, debouncedQuery]);

  // Sort filtered videos
  const sortedVideos = useMemo(() => {
    const sorted = [...filteredVideos];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (currentSort) {
        case 'dateAdded':
        case 'dateAddedOldest': {
          // Note: We don't have addedAt in VideoCardData, so this won't work perfectly
          // for "All Videos" view. This is acceptable for now.
          comparison = 0; // Keep natural order from query
          break;
        }
        case 'publishedAt': {
          const aTime = a.publishedAt?.getTime() ?? 0;
          const bTime = b.publishedAt?.getTime() ?? 0;
          comparison = bTime - aTime; // Newest first
          break;
        }
        case 'title': {
          comparison = a.title.localeCompare(b.title);
          break;
        }
        case 'duration': {
          const aDuration = parseDurationToSeconds(a.duration);
          const bDuration = parseDurationToSeconds(b.duration);
          comparison = bDuration - aDuration; // Longest first
          break;
        }
      }

      // Handle "oldest first" variants
      if (currentSort === 'dateAddedOldest') {
        comparison = -comparison;
      }

      return comparison;
    });

    return sorted;
  }, [filteredVideos, currentSort]);

  // Selection handlers
  const toggleSelect = (videoId: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(videoId)) {
      newSet.delete(videoId);
    } else {
      newSet.add(videoId);
    }
    setSelectedIds(newSet);
  };

  const selectAll = () => {
    const allIds = new Set(sortedVideos.map((v) => v.id));
    setSelectedIds(allIds);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Move/Copy handlers
  const openMoveDialog = () => {
    setMoveCopyMode('move');
    setMoveCopyOpen(true);
  };

  const openCopyDialog = () => {
    setMoveCopyMode('copy');
    setMoveCopyOpen(true);
  };

  const handleMoveCopyConfirm = async (
    targetCategoryId: number,
    targetCategoryName: string
  ) => {
    const videoIds = Array.from(selectedIds);
    const mode = moveCopyMode;
    const sourceCategoryId = selectedCategoryId;
    const sourceCategoryName =
      categories.find((c) => c.id === sourceCategoryId)?.name || null;

    // Execute the move/copy
    const result = await assignVideosToCategory(
      targetCategoryId,
      videoIds,
      mode,
      sourceCategoryId ?? undefined
    );

    if (result.success) {
      // Optimistic update: remove moved videos from current view
      if (mode === 'move' && sourceCategoryId !== null) {
        setVideos((prev) => prev.filter((v) => !selectedIds.has(v.id)));
      }

      // Push to undo stack
      undoStack.push({
        type: mode,
        label: `${mode === 'move' ? 'Moved' : 'Copied'} ${videoIds.length} video${videoIds.length > 1 ? 's' : ''} to "${targetCategoryName}"`,
        undoAction: async () => {
          if (mode === 'move' && sourceCategoryId !== null) {
            // Undo move: move videos back to source
            return await assignVideosToCategory(
              sourceCategoryId,
              videoIds,
              'move',
              targetCategoryId
            );
          } else {
            // Undo copy: remove copied videos from target
            return await removeVideosFromCategory(targetCategoryId, videoIds);
          }
        },
      });

      // Clear selection
      clearSelection();

      // Refresh categories list to update counts
      const updatedCategories = await getCategories();
      setCategories(updatedCategories);
    } else {
      // Show error (could use toast here)
      console.error('Move/copy failed:', result.error);
      alert(result.error || 'Failed to move/copy videos');
    }
  };

  // Undo handler
  const handleUndo = async () => {
    const result = await undoStack.undo();

    if (result.success) {
      // Refresh both categories and current videos
      const updatedCategories = await getCategories();
      setCategories(updatedCategories);

      const updatedVideos = await getVideosForCategory(selectedCategoryId);
      setVideos(updatedVideos);
    } else {
      // Show error
      console.error('Undo failed:', result.error);
      alert(result.error || 'Failed to undo');
    }
  };

  // Get current category name for display
  const currentCategoryName =
    selectedCategoryId === null
      ? 'All Videos'
      : categories.find((c) => c.id === selectedCategoryId)?.name || null;

  const showScopeToggle = selectedCategoryId !== null;
  const isAllSelected =
    selectedIds.size > 0 && selectedIds.size === sortedVideos.length;

  return (
    <div className="flex h-screen">
      {/* Category Sidebar */}
      <CategorySidebar
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={handleSelectCategory}
        totalVideoCount={totalVideoCount}
      />

      {/* Main content area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Toolbar */}
        <VideoToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchScope={searchScope}
          onSearchScopeChange={handleSearchScopeChange}
          showScopeToggle={showScopeToggle}
          resultCount={filteredVideos.length}
          totalCount={videos.length}
          currentSort={currentSort}
          onSortChange={setCurrentSort}
          selectedCount={selectedIds.size}
          totalInView={sortedVideos.length}
          onSelectAll={selectAll}
          onClearSelection={clearSelection}
          isAllSelected={isAllSelected}
          onMoveToClick={openMoveDialog}
          onCopyToClick={openCopyDialog}
          hasSelection={selectedIds.size > 0}
          currentCategoryName={currentCategoryName}
        />

        {/* Video Grid */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <VideoGrid
            videos={sortedVideos}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            showCategoryBadges={selectedCategoryId === null}
          />
        )}
      </div>

      {/* Move/Copy Dialog */}
      <MoveCopyDialog
        open={moveCopyOpen}
        onOpenChange={setMoveCopyOpen}
        mode={moveCopyMode}
        selectedVideoIds={Array.from(selectedIds)}
        categories={categories}
        currentCategoryId={selectedCategoryId}
        currentCategoryName={
          selectedCategoryId === null ? null : currentCategoryName
        }
        onConfirm={handleMoveCopyConfirm}
      />

      {/* Undo Banner */}
      <UndoBanner
        canUndo={undoStack.canUndo}
        latest={undoStack.latest}
        onUndo={handleUndo}
        isUndoing={undoStack.isUndoing}
      />
    </div>
  );
}
