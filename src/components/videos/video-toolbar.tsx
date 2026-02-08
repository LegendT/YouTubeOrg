'use client';

import { MagnifyingGlass, X, CaretDown } from '@phosphor-icons/react';
import { SortOption } from '@/types/videos';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface VideoToolbarProps {
  // Search
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchScope: 'category' | 'all';
  onSearchScopeChange: (scope: 'category' | 'all') => void;
  showScopeToggle: boolean;
  resultCount: number;
  totalCount: number;

  // Sort
  currentSort: SortOption;
  onSortChange: (sort: SortOption) => void;

  // Selection
  selectedCount: number;
  totalInView: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  isAllSelected: boolean;

  // Batch actions
  onMoveToClick: () => void;
  onCopyToClick: () => void;
  hasSelection: boolean;

  // Current category context
  currentCategoryName: string | null;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'dateAdded', label: 'Date Added' },
  { value: 'publishedAt', label: 'Published Date' },
  { value: 'title', label: 'Title A-Z' },
  { value: 'duration', label: 'Duration' },
];

export function VideoToolbar({
  searchQuery,
  onSearchChange,
  searchScope,
  onSearchScopeChange,
  showScopeToggle,
  resultCount,
  totalCount,
  currentSort,
  onSortChange,
  selectedCount,
  totalInView,
  onSelectAll,
  onClearSelection,
  isAllSelected,
  onMoveToClick,
  onCopyToClick,
  hasSelection,
  currentCategoryName,
}: VideoToolbarProps) {
  const isSearching = searchQuery.length > 0;
  const currentSortLabel =
    SORT_OPTIONS.find((opt) => opt.value === currentSort)?.label || 'Date Added';

  return (
    <div className="border-b border-border bg-card/95 backdrop-blur-sm">
      {/* Main toolbar row */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 md:gap-4">
        {/* Search area */}
        <div className="flex min-w-0 flex-1 items-center gap-2 basis-full md:basis-auto">
          <div className="relative min-w-0 flex-1 max-w-md">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              placeholder="Search videos..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Search videos"
              className="w-full h-9 pl-9 pr-9 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            {isSearching && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onSearchChange('')}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X size={16} />
              </Button>
            )}
          </div>

          {/* Scope toggle */}
          {showScopeToggle && (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() =>
                onSearchScopeChange(searchScope === 'category' ? 'all' : 'category')
              }
            >
              {searchScope === 'category'
                ? `In ${currentCategoryName || 'Category'}`
                : 'All categories'}
            </Button>
          )}
        </div>

        {/* Sort dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="shrink-0 gap-1">
              {currentSortLabel}
              <CaretDown size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup value={currentSort} onValueChange={(value) => onSortChange(value as SortOption)}>
              {SORT_OPTIONS.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Selection controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={isAllSelected}
              onCheckedChange={(checked) => {
                if (checked) {
                  onSelectAll();
                } else {
                  onClearSelection();
                }
              }}
              aria-label="Select all videos"
            />
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {selectedCount > 0 ? `${selectedCount} selected` : `Select all (${totalInView})`}
            </span>
          </div>

          {/* Batch action buttons */}
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={!hasSelection}
            onClick={onMoveToClick}
          >
            Move to...
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            disabled={!hasSelection}
            onClick={onCopyToClick}
          >
            Copy to...
          </Button>
        </div>
      </div>

      {/* Search result banner */}
      {isSearching && (
        <div className="flex items-center justify-between px-4 py-2 bg-muted/50 text-sm">
          <span>
            {resultCount} result{resultCount !== 1 ? 's' : ''} for &quot;{searchQuery}&quot;
          </span>
          <Button
            variant="link"
            size="sm"
            onClick={() => onSearchChange('')}
            className="h-auto p-0 text-muted-foreground hover:text-foreground"
          >
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}
