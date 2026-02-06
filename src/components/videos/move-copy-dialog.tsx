'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { CategoryListItem } from '@/types/categories';

interface MoveCopyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'move' | 'copy';
  selectedVideoIds: number[];
  categories: CategoryListItem[];
  currentCategoryId: number | null; // Source category (null for "All Videos")
  currentCategoryName: string | null;
  onConfirm: (targetCategoryId: number, targetCategoryName: string) => void;
}

/**
 * Dialog for moving or copying videos between categories.
 *
 * Displays a scrollable list of target categories (excluding the current source category).
 * Shows a bulk move warning when moving 5+ videos.
 * Disabled confirm button until a target category is selected.
 */
export function MoveCopyDialog({
  open,
  onOpenChange,
  mode,
  selectedVideoIds,
  categories,
  currentCategoryId,
  currentCategoryName,
  onConfirm,
}: MoveCopyDialogProps) {
  const [selectedTargetId, setSelectedTargetId] = useState<number | null>(null);

  // Filter out the current category from the available targets
  const availableCategories = categories.filter(
    (cat) => cat.id !== currentCategoryId
  );

  // Find the selected target category name
  const selectedTarget = availableCategories.find(
    (cat) => cat.id === selectedTargetId
  );

  // Reset selection when dialog closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setSelectedTargetId(null);
    }
    onOpenChange(isOpen);
  };

  const handleConfirm = () => {
    if (selectedTargetId !== null && selectedTarget) {
      onConfirm(selectedTargetId, selectedTarget.name);
      handleOpenChange(false);
    }
  };

  const videoCount = selectedVideoIds.length;
  const showBulkWarning = mode === 'move' && videoCount >= 5;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'move' ? 'Move' : 'Copy'} {videoCount} video
            {videoCount !== 1 ? 's' : ''} to...
          </DialogTitle>
          <DialogDescription>
            Select a target category
            {mode === 'move' && currentCategoryName
              ? ` (will be removed from "${currentCategoryName}")`
              : ''}
          </DialogDescription>
        </DialogHeader>

        {/* Bulk move warning */}
        {showBulkWarning && currentCategoryName && (
          <div className="rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
            This will remove {videoCount} videos from &quot;{currentCategoryName}
            &quot;
          </div>
        )}

        {/* Category list */}
        <ScrollArea className="h-[300px] rounded-md border">
          <div className="p-2">
            {availableCategories.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm py-8">
                No other categories available
              </div>
            ) : (
              availableCategories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedTargetId(category.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedTargetId === category.id
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  <span className="truncate">{category.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums ml-2">
                    {category.videoCount}
                  </span>
                </button>
              ))
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={selectedTargetId === null}>
            {mode === 'move' ? 'Move' : 'Copy'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
