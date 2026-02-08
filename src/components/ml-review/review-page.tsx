'use client';

import { useState, useMemo, useOptimistic, useTransition } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { Settings } from 'lucide-react';
import type { ReviewResult, ReviewStats } from '@/types/ml';
import type { Category } from '@/types/categories';
import {
  acceptSuggestion,
  rejectSuggestion,
  recategoriseVideo,
  getReviewData,
  getVideoReviewDetail,
} from '@/app/actions/ml-categorisation';
import { ReviewGrid } from './review-grid';
import { ReviewModal } from './review-modal';
import { ReviewProgress } from './review-progress';
import { KeyboardHints } from './keyboard-hints';
import { CategoryPickerDialog } from './category-picker-dialog';

type ConfidenceFilter = 'all' | 'HIGH' | 'MEDIUM' | 'LOW';
type ReviewStatusFilter = 'pending' | 'rejected';

interface ReviewPageProps {
  initialResults: ReviewResult[];
  initialStats: ReviewStats;
}

/**
 * ReviewPage - Client orchestrator for the ML review workflow.
 *
 * Wires ReviewGrid, ReviewModal, ReviewProgress, KeyboardHints, and
 * CategoryPickerDialog together with:
 * - Optimistic updates (useOptimistic hook) for instant accept/reject feedback
 * - Real accept/reject handlers calling server actions with auto-advance
 * - Confidence filter functionality
 * - Review status filtering (pending vs rejected)
 * - Category picker for manual recategorisation of rejected videos
 * - Tab/Enter keyboard navigation for grid-to-modal interaction
 */
export function ReviewPage({ initialResults, initialStats }: ReviewPageProps) {
  const [results, setResults] = useState<ReviewResult[]>(initialResults);
  const [stats, setStats] = useState<ReviewStats>(initialStats);
  const [gridFocusIndex, setGridFocusIndex] = useState(0);
  const [selectedVideoId, setSelectedVideoId] = useState<number | null>(null);

  // Filter state
  const [confidenceFilter, setConfidenceFilter] =
    useState<ConfidenceFilter>('all');
  const [reviewStatusFilter, setReviewStatusFilter] =
    useState<ReviewStatusFilter>('pending');

  // Category picker state
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [pickerVideoId, setPickerVideoId] = useState<number | null>(null);
  const [pickerCategories, setPickerCategories] = useState<Category[]>([]);

  // Optimistic updates — clear opposite state to match server action semantics
  const [optimisticResults, updateOptimistic] = useOptimistic(
    results,
    (
      state: ReviewResult[],
      update: { videoId: number; action: 'accept' | 'reject' }
    ) => {
      return state.map((r) =>
        r.videoId === update.videoId
          ? {
              ...r,
              acceptedAt:
                update.action === 'accept' ? new Date() : null,
              rejectedAt:
                update.action === 'reject' ? new Date() : null,
            }
          : r
      );
    }
  );

  const [isPending, startTransition] = useTransition();

  const isModalOpen = selectedVideoId !== null;

  // --- Filtered results ---
  const filteredResults = useMemo(() => {
    return optimisticResults.filter((r) => {
      // Confidence filter
      if (confidenceFilter !== 'all' && r.confidence !== confidenceFilter) {
        return false;
      }
      // Review status filter
      if (reviewStatusFilter === 'pending') {
        return r.acceptedAt === null && r.rejectedAt === null;
      }
      if (reviewStatusFilter === 'rejected') {
        return r.rejectedAt !== null;
      }
      return true;
    });
  }, [optimisticResults, confidenceFilter, reviewStatusFilter]);

  // --- Auto-advance helper ---
  const advanceToNext = (currentVideoId: number) => {
    const currentIdx = filteredResults.findIndex(
      (r) => r.videoId === currentVideoId
    );
    if (currentIdx >= 0 && currentIdx < filteredResults.length - 1) {
      const nextVideo = filteredResults[currentIdx + 1];
      setSelectedVideoId(nextVideo.videoId);
      setGridFocusIndex(currentIdx + 1);
    } else {
      // No next video, close modal
      setSelectedVideoId(null);
    }
  };

  // --- Accept handler ---
  const handleAccept = (videoId: number) => {
    advanceToNext(videoId);
    startTransition(async () => {
      updateOptimistic({ videoId, action: 'accept' });
      await acceptSuggestion(videoId);
      // Persist to real state so optimistic doesn't revert
      setResults((prev) =>
        prev.map((r) =>
          r.videoId === videoId
            ? { ...r, acceptedAt: new Date(), rejectedAt: null, manualCategoryId: null }
            : r
        )
      );
      setStats((prev) => ({
        ...prev,
        reviewed: prev.reviewed + 1,
        pending: prev.pending - 1,
      }));
    });
  };

  // --- Reject handler ---
  const handleReject = (videoId: number) => {
    advanceToNext(videoId);
    startTransition(async () => {
      updateOptimistic({ videoId, action: 'reject' });
      await rejectSuggestion(videoId);
      // Persist to real state so optimistic doesn't revert
      setResults((prev) =>
        prev.map((r) =>
          r.videoId === videoId
            ? { ...r, rejectedAt: new Date(), acceptedAt: null }
            : r
        )
      );
      setStats((prev) => ({
        ...prev,
        reviewed: prev.reviewed + 1,
        pending: prev.pending - 1,
      }));
    });
  };

  // --- Confidence filter handler ---
  const handleFilterChange = (filter: ConfidenceFilter) => {
    setGridFocusIndex(0); // Pitfall 7: reset index on filter change
    setConfidenceFilter(filter);
  };

  // --- Recategorise rejected videos button handler ---
  const handleShowRejected = () => {
    setReviewStatusFilter('rejected');
    setGridFocusIndex(0);
  };

  // --- Back to pending button handler ---
  const handleShowPending = () => {
    setReviewStatusFilter('pending');
    setGridFocusIndex(0);
  };

  // --- Category picker handlers ---
  const handleCardClick = (videoId: number) => {
    if (reviewStatusFilter === 'rejected') {
      // In rejected mode, clicking a card opens the category picker
      setPickerVideoId(videoId);
      // Fetch all categories for the picker
      getVideoReviewDetail(videoId).then((detail) => {
        if (detail) {
          setPickerCategories(detail.allCategories);
          setShowCategoryPicker(true);
        }
      });
    } else {
      // In pending mode, clicking opens the review modal
      setSelectedVideoId(videoId);
      const clickedIndex = filteredResults.findIndex(
        (r) => r.videoId === videoId
      );
      if (clickedIndex >= 0) {
        setGridFocusIndex(clickedIndex);
      }
    }
  };

  const handleCategoryPickerConfirm = (categoryId: number) => {
    if (pickerVideoId === null) return;

    startTransition(async () => {
      await recategoriseVideo(pickerVideoId, categoryId);
      // Refetch data to update the grid
      const updatedResults = await getReviewData(
        confidenceFilter === 'all' ? undefined : confidenceFilter,
        reviewStatusFilter
      );
      setResults(updatedResults);
    });

    setShowCategoryPicker(false);
    setPickerVideoId(null);
  };

  const handleCategoryPickerClose = () => {
    setShowCategoryPicker(false);
    setPickerVideoId(null);
  };

  // --- Keyboard navigation ---

  // Tab: Navigate forward through grid
  useHotkeys(
    'tab',
    (e) => {
      e.preventDefault();
      setGridFocusIndex((prev) => (prev + 1) % filteredResults.length);
    },
    {
      enabled: !isModalOpen && filteredResults.length > 0 && !showCategoryPicker,
      preventDefault: true,
    }
  );

  // Shift+Tab: Navigate backward through grid
  useHotkeys(
    'shift+tab',
    (e) => {
      e.preventDefault();
      setGridFocusIndex(
        (prev) => (prev - 1 + filteredResults.length) % filteredResults.length
      );
    },
    {
      enabled: !isModalOpen && filteredResults.length > 0 && !showCategoryPicker,
      preventDefault: true,
    }
  );

  // Enter: Open modal/picker for focused card
  useHotkeys(
    'enter',
    () => {
      const focused = filteredResults[gridFocusIndex];
      if (focused) {
        handleCardClick(focused.videoId);
      }
    },
    {
      enabled: !isModalOpen && filteredResults.length > 0 && !showCategoryPicker,
      preventDefault: true,
    }
  );

  // --- Modal handlers ---

  const handleClose = () => {
    setSelectedVideoId(null);
  };

  const handleNavigate = (newVideoId: number) => {
    setSelectedVideoId(newVideoId);
    const newIndex = filteredResults.findIndex(
      (r) => r.videoId === newVideoId
    );
    if (newIndex >= 0) {
      setGridFocusIndex(newIndex);
    }
  };

  const handleFocusChange = (index: number) => {
    setGridFocusIndex(index);
  };

  // Get picker video info
  const pickerVideo = pickerVideoId
    ? filteredResults.find((r) => r.videoId === pickerVideoId)
    : null;

  return (
    <div className="flex flex-col h-screen">
      {/* Progress bar at top */}
      <ReviewProgress
        stats={stats}
        currentFilter={confidenceFilter}
        onFilterChange={handleFilterChange}
      />

      {/* Recategorise rejected videos button / Back to pending */}
      <div className="px-4 py-2 border-b bg-card">
        {reviewStatusFilter === 'pending' ? (
          <button
            onClick={handleShowRejected}
            className="flex items-center gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded text-sm transition-colors"
          >
            <Settings className="h-4 w-4" />
            Recategorise rejected videos
          </button>
        ) : (
          <button
            onClick={handleShowPending}
            className="flex items-center gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded text-sm transition-colors"
          >
            Back to pending videos
          </button>
        )}
      </div>

      {/* Review grid */}
      <ReviewGrid
        results={filteredResults}
        focusedIndex={gridFocusIndex}
        onCardClick={handleCardClick}
        onFocusChange={handleFocusChange}
      />

      {/* Review modal (only in pending mode) */}
      <ReviewModal
        open={isModalOpen}
        videoId={selectedVideoId}
        resultsList={filteredResults}
        onClose={handleClose}
        onNavigate={handleNavigate}
        onAccept={handleAccept}
        onReject={handleReject}
      />

      {/* Category picker dialog */}
      <CategoryPickerDialog
        open={showCategoryPicker}
        videoId={pickerVideoId}
        videoTitle={pickerVideo?.title ?? ''}
        currentCategoryName={pickerVideo?.suggestedCategoryName ?? ''}
        allCategories={pickerCategories}
        onClose={handleCategoryPickerClose}
        onConfirm={handleCategoryPickerConfirm}
      />

      {/* Keyboard shortcuts legend */}
      <KeyboardHints />
    </div>
  );
}
