'use client';

import { useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { ReviewResult } from '@/types/ml';
import { ReviewCard } from './review-card';

interface ReviewGridProps {
  results: ReviewResult[];
  focusedIndex: number;
  onCardClick: (videoId: number) => void;
  onFocusChange: (index: number) => void;
}

const ROW_HEIGHT = 340;
const COLUMN_COUNT = 3;

export function ReviewGrid({
  results,
  focusedIndex,
  onCardClick,
  onFocusChange,
}: ReviewGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rowCount = Math.ceil(results.length / COLUMN_COUNT);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 3,
  });

  // Reset scroll position when results array changes
  useEffect(() => {
    rowVirtualizer.scrollToIndex(0);
  }, [results.length, rowVirtualizer]);

  // Scroll focused card into view when focusedIndex changes
  useEffect(() => {
    if (focusedIndex >= 0 && focusedIndex < results.length) {
      const focusedRow = Math.floor(focusedIndex / COLUMN_COUNT);
      rowVirtualizer.scrollToIndex(focusedRow, { align: 'auto' });
    }
  }, [focusedIndex, results.length, rowVirtualizer]);

  // Empty state
  if (results.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>No videos to review</p>
      </div>
    );
  }

  return (
    <div ref={parentRef} className="flex-1 overflow-auto">
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const startIdx = virtualRow.index * COLUMN_COUNT;
          const rowResults = results.slice(startIdx, startIdx + COLUMN_COUNT);

          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div
                className="grid grid-cols-3"
                style={{
                  gap: '24px',
                  paddingLeft: '48px',
                  paddingRight: '48px',
                }}
              >
                {rowResults.map((result, colIdx) => {
                  const globalIndex = startIdx + colIdx;
                  return (
                    <ReviewCard
                      key={result.videoId}
                      result={result}
                      isFocused={globalIndex === focusedIndex}
                      onClick={onCardClick}
                    />
                  );
                })}
                {/* Fill empty cells in last row to maintain grid alignment */}
                {Array.from({
                  length: COLUMN_COUNT - rowResults.length,
                }).map((_, idx) => (
                  <div key={`empty-${idx}`} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
