'use client';

import { useRef, useState, useEffect } from 'react';
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
const MIN_CARD_WIDTH = 280;
const MAX_COLUMNS = 3;
const MIN_COLUMNS = 1;

/**
 * Responsive column count based on container width.
 */
function useColumnCount(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [columnCount, setColumnCount] = useState(3);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateColumnCount = () => {
      const width = container.clientWidth;
      const calculated = Math.floor(width / MIN_CARD_WIDTH);
      setColumnCount(Math.max(MIN_COLUMNS, Math.min(MAX_COLUMNS, calculated)));
    };

    updateColumnCount();

    const resizeObserver = new ResizeObserver(updateColumnCount);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [containerRef]);

  return columnCount;
}

export function ReviewGrid({
  results,
  focusedIndex,
  onCardClick,
  onFocusChange,
}: ReviewGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const columnCount = useColumnCount(parentRef);
  const rowCount = Math.ceil(results.length / columnCount);

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
      const focusedRow = Math.floor(focusedIndex / columnCount);
      rowVirtualizer.scrollToIndex(focusedRow, { align: 'auto' });
    }
  }, [focusedIndex, results.length, columnCount, rowVirtualizer]);

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
          const startIdx = virtualRow.index * columnCount;
          const rowResults = results.slice(startIdx, startIdx + columnCount);

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
                className="grid px-4 md:px-12"
                style={{
                  gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
                  gap: columnCount === 1 ? '16px' : '24px',
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
                  length: columnCount - rowResults.length,
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
