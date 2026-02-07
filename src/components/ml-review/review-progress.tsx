'use client';

import type { ReviewStats } from '@/types/ml';

type ConfidenceFilter = 'all' | 'HIGH' | 'MEDIUM' | 'LOW';

interface ReviewProgressProps {
  stats: ReviewStats;
  currentFilter: ConfidenceFilter;
  onFilterChange: (filter: ConfidenceFilter) => void;
}

interface FilterButton {
  label: string;
  filter: ConfidenceFilter;
  count: number;
}

export function ReviewProgress({
  stats,
  currentFilter,
  onFilterChange,
}: ReviewProgressProps) {
  const percentage =
    stats.total > 0 ? Math.round((stats.reviewed / stats.total) * 100) : 0;

  const filterButtons: FilterButton[] = [
    { label: 'All', filter: 'all', count: stats.total },
    { label: 'High', filter: 'HIGH', count: stats.highConfidence },
    { label: 'Medium', filter: 'MEDIUM', count: stats.mediumConfidence },
    { label: 'Low', filter: 'LOW', count: stats.lowConfidence },
  ];

  return (
    <div className="flex items-center justify-between gap-4 p-4 bg-card border-b">
      {/* Progress text */}
      <div className="text-sm">
        <span className="font-semibold">
          Reviewed {stats.reviewed} / {stats.total} videos
        </span>
        <span className="text-muted-foreground ml-2">({percentage}%)</span>
      </div>

      {/* Filter buttons */}
      <div className="flex items-center gap-2">
        {filterButtons.map((btn) => {
          const isActive = currentFilter === btn.filter;
          return (
            <button
              key={btn.filter}
              onClick={() => onFilterChange(btn.filter)}
              className={`text-xs px-3 py-1.5 rounded transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {btn.label}: {btn.count}
            </button>
          );
        })}
      </div>
    </div>
  );
}
