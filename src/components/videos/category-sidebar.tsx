'use client';

import { useState } from 'react';
import { Funnel } from '@phosphor-icons/react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import type { CategoryListItem } from '@/types/categories';

interface CategorySidebarProps {
  categories: CategoryListItem[];
  selectedCategoryId: number | null; // null = "All Videos"
  onSelectCategory: (categoryId: number | null) => void;
  totalVideoCount: number; // Sum of all unique videos for "All Videos" count
}

/**
 * Category list content — shared between desktop sidebar and mobile sheet.
 */
function CategoryList({
  categories,
  selectedCategoryId,
  onSelectCategory,
  totalVideoCount,
  onItemClick,
}: CategorySidebarProps & { onItemClick?: () => void }) {
  const handleSelect = (categoryId: number | null) => {
    onSelectCategory(categoryId);
    onItemClick?.();
  };

  return (
    <>
      {/* All Videos Entry */}
      <button
        onClick={() => handleSelect(null)}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm transition-colors cursor-pointer min-h-[44px] ${
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
          onClick={() => handleSelect(category.id)}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm transition-colors cursor-pointer min-h-[44px] ${
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
    </>
  );
}

/**
 * Category sidebar for video browsing.
 * Desktop: fixed sidebar. Mobile: Sheet drawer triggered by filter button.
 */
export function CategorySidebar({
  categories,
  selectedCategoryId,
  onSelectCategory,
  totalVideoCount,
}: CategorySidebarProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      {/* Mobile: filter button (visible below md) */}
      <div className="md:hidden fixed bottom-4 right-4 z-30">
        <Button
          size="icon"
          className="h-12 w-12 rounded-full shadow-lg"
          onClick={() => setSheetOpen(true)}
          aria-label="Open categories"
        >
          <Funnel size={20} weight="bold" />
        </Button>
      </div>

      {/* Mobile: Sheet drawer */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left" className="w-[300px] p-0">
          <SheetHeader className="p-4 border-b border-border">
            <SheetTitle>Categories</SheetTitle>
            <SheetDescription className="sr-only">
              Select a category to filter videos
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-80px)]">
            <div className="p-2">
              <CategoryList
                categories={categories}
                selectedCategoryId={selectedCategoryId}
                onSelectCategory={onSelectCategory}
                totalVideoCount={totalVideoCount}
                onItemClick={() => setSheetOpen(false)}
              />
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Desktop: sidebar (hidden below md) */}
      <nav aria-label="Video categories" className="hidden md:flex w-[280px] border-r border-border bg-card flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Categories</h2>
        </div>

        {/* Category List */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            <CategoryList
              categories={categories}
              selectedCategoryId={selectedCategoryId}
              onSelectCategory={onSelectCategory}
              totalVideoCount={totalVideoCount}
            />
          </div>
        </ScrollArea>

        {/* Keyboard shortcut hint */}
        <div className="border-t border-border px-4 py-2">
          <p className="text-xs text-muted-foreground">
            Press <kbd className="bg-muted border border-border rounded px-1.5 py-0.5 text-xs font-mono text-muted-foreground">?</kbd> for shortcuts
          </p>
        </div>
      </nav>
    </>
  );
}
