'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { GitMerge, Warning } from '@phosphor-icons/react'
import { Spinner } from '@/components/ui/spinner'
import { mergeCategories } from '@/app/actions/categories'
import type { MergeUndoData } from '@/types/categories'

interface MergeCategoriesDialogProps {
  categories: Array<{ id: number; name: string; videoCount: number }>
  open: boolean
  onOpenChange: (open: boolean) => void
  onMerged: (undoData: MergeUndoData) => void
}

/**
 * MergeCategoriesDialog - Preview and confirm merging 2+ categories.
 *
 * Shows the categories being merged with their video counts, a combined
 * total (noting duplicates will be removed), and requires the user to
 * confirm or edit the merged category name before executing. Returns
 * undo data to the parent for reversal support.
 */
export function MergeCategoriesDialog({
  categories: sourceCategories,
  open,
  onOpenChange,
  onMerged,
}: MergeCategoriesDialogProps) {
  // Auto-suggest the longest category name
  const longestName =
    sourceCategories.length > 0
      ? sourceCategories.reduce((a, b) => (a.name.length >= b.name.length ? a : b)).name
      : ''

  const [mergedName, setMergedName] = useState(longestName)
  const [isMerging, setIsMerging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state when dialog opens/closes or categories change
  useEffect(() => {
    if (open) {
      setMergedName(longestName)
      setIsMerging(false)
      setError(null)
    }
  }, [open, longestName])

  const combinedCount = sourceCategories.reduce((sum, c) => sum + c.videoCount, 0)
  const isOverLimit = combinedCount > 5000
  const isNearLimit = combinedCount > 4500 && combinedCount <= 5000
  const canSubmit =
    mergedName.trim().length > 0 &&
    !isMerging &&
    !isOverLimit &&
    sourceCategories.length >= 2

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return

    setIsMerging(true)
    setError(null)

    try {
      const categoryIds = sourceCategories.map((c) => c.id)
      const result = await mergeCategories(categoryIds, mergedName.trim())

      if (result.success && result.undoData) {
        onMerged(result.undoData)
        onOpenChange(false)
      } else {
        setError(result.error ?? 'Merge failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsMerging(false)
    }
  }, [canSubmit, sourceCategories, mergedName, onMerged, onOpenChange])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && canSubmit) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [canSubmit, handleSubmit]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5" />
            Merge Categories
          </DialogTitle>
          <DialogDescription>
            Combine {sourceCategories.length} categories into one. The original
            categories will be removed.
          </DialogDescription>
        </DialogHeader>

        {/* Preview section: categories being merged */}
        <div className="space-y-3">
          <div className="rounded-md border p-3 space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Categories to merge:
            </p>
            <ul className="space-y-1.5">
              {sourceCategories.map((cat) => (
                <li
                  key={cat.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="font-medium truncate mr-2">{cat.name}</span>
                  <Badge variant="secondary" className="shrink-0">
                    {cat.videoCount.toLocaleString()} videos
                  </Badge>
                </li>
              ))}
            </ul>

            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground">
                Combined: ~{combinedCount.toLocaleString()} videos{' '}
                <span className="text-xs">
                  (duplicates will be removed automatically)
                </span>
              </p>
            </div>
          </div>

          {/* Warning for near-limit */}
          {isNearLimit && (
            <div className="flex items-start gap-2 rounded-md border border-warning/50 bg-warning/10 p-3">
              <Warning className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <p className="text-sm text-warning">
                Combined video count is approaching the 5,000 limit. The actual
                count after deduplication may be lower.
              </p>
            </div>
          )}

          {/* Block for over-limit */}
          {isOverLimit && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3">
              <Warning className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">
                Combined video count exceeds the 5,000 limit. Cannot merge these
                categories. The actual count after deduplication may be lower --
                try removing categories with overlapping videos first.
              </p>
            </div>
          )}

          {/* Name input */}
          <div className="space-y-2">
            <label
              htmlFor="merge-name"
              className="text-sm font-medium leading-none"
            >
              Merged category name
            </label>
            <input
              id="merge-name"
              type="text"
              value={mergedName}
              onChange={(e) => setMergedName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              maxLength={150}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Enter category name..."
              disabled={isMerging}
            />
          </div>

          {/* Confirmation text */}
          <p className="text-sm text-muted-foreground">
            This will merge {sourceCategories.length} categories into one. The
            original categories will be removed.
          </p>

          {/* Error display */}
          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isMerging}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isMerging ? (
              <Spinner size={16} className="mr-1.5" />
            ) : (
              <GitMerge className="h-4 w-4 mr-1.5" />
            )}
            Merge {sourceCategories.length} categories
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
