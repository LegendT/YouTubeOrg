'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import type { CategoryListItem } from '@/types/categories';

interface CategorySidebarProps {
  categories: CategoryListItem[];
  selectedCategoryId: number | null; // null = "All Videos"
  onSelectCategory: (categoryId: number | null) => void;
  totalVideoCount: number; // Sum of all unique videos for "All Videos" count
}

/**
 * Category sidebar for video browsing.
 * Displays "All Videos" entry at top, followed by all categories sorted alphabetically
 * with "Uncategorised" pinned to bottom.
 */
export function CategorySidebar({
  categories,
  selectedCategoryId,
  onSelectCategory,
  totalVideoCount,
}: CategorySidebarProps) {
  return (
    <nav aria-label="Video categories" className="w-[280px] border-r border-border bg-card flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">Categories</h2>
      </div>

      {/* Category List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {/* All Videos Entry */}
          <button
            onClick={() => onSelectCategory(null)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors cursor-pointer ${
              selectedCategoryId === null
                ? 'bg-accent text-accent-foreground'
                : 'text-foreground hover:bg-accent/50'
            }`}
          >
            <span>All Videos</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {totalVideoCount}
            </span>
          </button>

          {/* Category Entries */}
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => onSelectCategory(category.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors cursor-pointer ${
                selectedCategoryId === category.id
                  ? 'bg-accent text-accent-foreground'
                  : 'text-foreground hover:bg-accent/50'
              }`}
            >
              <span className="truncate">{category.name}</span>
              <span className="text-xs text-muted-foreground tabular-nums ml-2">
                {category.videoCount}
              </span>
            </button>
          ))}
        </div>
      </ScrollArea>

      {/* Keyboard shortcut hint */}
      <div className="border-t border-border px-4 py-2">
        <p className="text-xs text-muted-foreground">
          Press <kbd className="bg-muted border border-border rounded px-1.5 py-0.5 text-xs font-mono text-muted-foreground">?</kbd> for shortcuts
        </p>
      </div>
    </nav>
  );
}
