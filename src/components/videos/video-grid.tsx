'use client';

import { useRef, useState, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { VideoCardData } from '@/types/videos';
import { VideoCard } from './video-card';

interface VideoGridProps {
  videos: VideoCardData[];
  selectedIds: Set<number>;
  onToggleSelect: (videoId: number) => void;
  showCategoryBadges: boolean;
}

const ROW_HEIGHT = 340;
const MIN_CARD_WIDTH = 300;
const MAX_COLUMNS = 4;
const MIN_COLUMNS = 1;

/**
 * Custom hook to calculate responsive column count based on container width.
 * Uses ResizeObserver to track container size changes.
 */
function useColumnCount(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [columnCount, setColumnCount] = useState(2);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateColumnCount = () => {
      const width = container.clientWidth;
      const calculatedColumns = Math.floor(width / MIN_CARD_WIDTH);
      const columns = Math.max(MIN_COLUMNS, Math.min(MAX_COLUMNS, calculatedColumns));
      setColumnCount(columns);
    };

    // Initial calculation
    updateColumnCount();

    // Watch for resize
    const resizeObserver = new ResizeObserver(updateColumnCount);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [containerRef]);

  return columnCount;
}

export function VideoGrid({
  videos,
  selectedIds,
  onToggleSelect,
  showCategoryBadges,
}: VideoGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const columnCount = useColumnCount(parentRef);
  const rowCount = Math.ceil(videos.length / columnCount);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 3,
  });

  // Reset scroll position when videos array changes
  useEffect(() => {
    rowVirtualizer.scrollToIndex(0);
  }, [videos.length, rowVirtualizer]);

  // Empty state
  if (videos.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>No videos found</p>
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
          const rowVideos = videos.slice(startIdx, startIdx + columnCount);

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
                className="grid gap-3 px-4"
                style={{
                  gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
                }}
              >
                {rowVideos.map((video) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    isSelected={selectedIds.has(video.id)}
                    onToggleSelect={onToggleSelect}
                    showCategoryBadge={showCategoryBadges}
                  />
                ))}
                {/* Fill empty cells in last row */}
                {Array.from({ length: columnCount - rowVideos.length }).map((_, idx) => (
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
