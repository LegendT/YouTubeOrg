'use client';

import { useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import type { ReviewResult, ReviewStats } from '@/types/ml';
import { ReviewGrid } from './review-grid';
import { ReviewModal } from './review-modal';
import { ReviewProgress } from './review-progress';
import { KeyboardHints } from './keyboard-hints';

interface ReviewPageProps {
  initialResults: ReviewResult[];
  initialStats: ReviewStats;
}

/**
 * ReviewPage - Client orchestrator for the ML review workflow.
 *
 * Wires ReviewGrid, ReviewModal, ReviewProgress, and KeyboardHints together
 * with Tab/Enter keyboard navigation for grid-to-modal interaction.
 *
 * NOTE: This is the basic version. Plan 06-05 will add:
 * - Optimistic updates (useOptimistic hook)
 * - Real accept/reject handlers with server actions
 * - Confidence filter functionality
 * - Review status filtering
 * - Category picker for recategorisation
 * - Auto-advance logic
 * - Navbar link
 */
export function ReviewPage({ initialResults, initialStats }: ReviewPageProps) {
  const [results, setResults] = useState<ReviewResult[]>(initialResults);
  const [stats, setStats] = useState<ReviewStats>(initialStats);
  const [gridFocusIndex, setGridFocusIndex] = useState(0);
  const [selectedVideoId, setSelectedVideoId] = useState<number | null>(null);

  const isModalOpen = selectedVideoId !== null;

  // --- Keyboard navigation ---

  // Tab: Navigate forward through grid
  useHotkeys(
    'tab',
    (e) => {
      e.preventDefault();
      setGridFocusIndex((prev) => (prev + 1) % results.length);
    },
    { enabled: !isModalOpen && results.length > 0, preventDefault: true }
  );

  // Shift+Tab: Navigate backward through grid
  useHotkeys(
    'shift+tab',
    (e) => {
      e.preventDefault();
      setGridFocusIndex((prev) => (prev - 1 + results.length) % results.length);
    },
    { enabled: !isModalOpen && results.length > 0, preventDefault: true }
  );

  // Enter: Open modal for focused card
  useHotkeys(
    'enter',
    () => {
      const focused = results[gridFocusIndex];
      if (focused) {
        setSelectedVideoId(focused.videoId);
      }
    },
    { enabled: !isModalOpen && results.length > 0, preventDefault: true }
  );

  // --- Modal handlers ---

  const handleClose = () => {
    setSelectedVideoId(null);
  };

  const handleNavigate = (newVideoId: number) => {
    setSelectedVideoId(newVideoId);
    // Update gridFocusIndex to match the navigated video
    const newIndex = results.findIndex((r) => r.videoId === newVideoId);
    if (newIndex >= 0) {
      setGridFocusIndex(newIndex);
    }
  };

  // Placeholder handlers - will be implemented with server actions in Plan 06-05
  const handleAccept = (videoId: number) => {
    console.log('Accept:', videoId);
  };

  const handleReject = (videoId: number) => {
    console.log('Reject:', videoId);
  };

  // --- Grid handlers ---

  const handleCardClick = (videoId: number) => {
    setSelectedVideoId(videoId);
    const clickedIndex = results.findIndex((r) => r.videoId === videoId);
    if (clickedIndex >= 0) {
      setGridFocusIndex(clickedIndex);
    }
  };

  const handleFocusChange = (index: number) => {
    setGridFocusIndex(index);
  };

  // Confidence filter placeholder - will be implemented in Plan 06-05
  const handleFilterChange = () => {
    // No-op for now
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Progress bar at top */}
      <ReviewProgress
        stats={stats}
        currentFilter="all"
        onFilterChange={handleFilterChange}
      />

      {/* Review grid */}
      <ReviewGrid
        results={results}
        focusedIndex={gridFocusIndex}
        onCardClick={handleCardClick}
        onFocusChange={handleFocusChange}
      />

      {/* Review modal */}
      <ReviewModal
        open={isModalOpen}
        videoId={selectedVideoId}
        resultsList={results}
        onClose={handleClose}
        onNavigate={handleNavigate}
        onAccept={handleAccept}
        onReject={handleReject}
      />

      {/* Keyboard shortcuts legend */}
      <KeyboardHints />
    </div>
  );
}
