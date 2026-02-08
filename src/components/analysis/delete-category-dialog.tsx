'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, AlertTriangle } from 'lucide-react'
import { deleteCategory } from '@/app/actions/categories'
import type { DeleteUndoData } from '@/types/categories'

interface DeleteCategoryDialogProps {
  categoryId: number
  categoryName: string
  videoCount: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: (undoData: DeleteUndoData) => void
}

/**
 * Confirmation dialog for deleting a category.
 *
 * Shows a warning with video count information. Orphaned videos
 * (not in any other category) will be moved to Uncategorised.
 * Returns undo data to the parent so it can push to the undo stack.
 * Protected categories should not be offered this dialog (parent controls).
 */
export function DeleteCategoryDialog({
  categoryId,
  categoryName,
  videoCount,
  open,
  onOpenChange,
  onDeleted,
}: DeleteCategoryDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen)
    if (!nextOpen) {
      setError(null)
    }
  }

  const handleDelete = async () => {
    setError(null)
    setIsDeleting(true)

    try {
      const result = await deleteCategory(categoryId)
      if (result.success && result.undoData) {
        onDeleted(result.undoData)
        handleOpenChange(false)
      } else {
        setError(result.error ?? 'Failed to delete category')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Category</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &ldquo;{categoryName}&rdquo;?
          </DialogDescription>
        </DialogHeader>

        {videoCount > 0 ? (
          <div className="flex items-start gap-2 text-sm px-3 py-2 rounded-md bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              {videoCount.toLocaleString()} video{videoCount !== 1 ? 's' : ''} will
              be reassigned. Videos that exist in other categories will stay there.
              Truly orphaned videos will be moved to Uncategorised.
            </span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            This empty category will be permanently removed.
          </p>
        )}

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
