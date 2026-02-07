'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { Category } from '@/types/categories';

interface CategoryPickerDialogProps {
  open: boolean;
  videoId: number | null;
  videoTitle: string;
  currentCategoryName: string;
  allCategories: Category[];
  onClose: () => void;
  onConfirm: (categoryId: number) => void;
}

/**
 * CategoryPickerDialog - Manual recategorisation dialog for rejected videos.
 *
 * Displays all non-protected categories as clickable buttons, highlighting
 * the current suggested category. User selects a new category to recategorise
 * the video.
 */
export function CategoryPickerDialog({
  open,
  videoTitle,
  currentCategoryName,
  allCategories,
  onClose,
  onConfirm,
}: CategoryPickerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Recategorise Video</DialogTitle>
          <DialogDescription>
            Choose a new category for: {videoTitle}
          </DialogDescription>
        </DialogHeader>

        {/* Category list */}
        <div className="flex flex-col gap-1 mt-2">
          {allCategories.map((category) => {
            const isCurrent = category.name === currentCategoryName;
            return (
              <button
                key={category.id}
                onClick={() => {
                  onConfirm(category.id);
                }}
                className={`w-full text-left p-3 rounded transition-colors ${
                  isCurrent
                    ? 'bg-secondary font-medium'
                    : 'hover:bg-secondary/60'
                }`}
              >
                <span className="text-sm">{category.name}</span>
                {isCurrent && (
                  <span className="text-xs text-muted-foreground ml-2">
                    (current)
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Cancel button */}
        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded text-sm text-muted-foreground hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
