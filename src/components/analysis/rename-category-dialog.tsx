'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { renameCategory } from '@/app/actions/categories'

interface RenameCategoryDialogProps {
  categoryId: number
  currentName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onRenamed: () => void
}

/**
 * Dialog for renaming a category.
 *
 * Validates name constraints (non-empty, max 150 chars).
 * Calls the renameCategory server action and reports success/error.
 * Protected categories should not be offered this dialog (parent controls).
 */
export function RenameCategoryDialog({
  categoryId,
  currentName,
  open,
  onOpenChange,
  onRenamed,
}: RenameCategoryDialogProps) {
  const [newName, setNewName] = useState(currentName)
  const [error, setError] = useState<string | null>(null)
  const [isRenaming, setIsRenaming] = useState(false)

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setNewName(currentName)
      setError(null)
    }
  }, [open, currentName])

  const validate = (): string | null => {
    const trimmed = newName.trim()
    if (!trimmed) return 'Category name cannot be empty'
    if (trimmed.length > 150) return 'Category name must be 150 characters or less'
    if (trimmed === currentName) return 'Name is unchanged'
    return null
  }

  const handleSubmit = async () => {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    setIsRenaming(true)

    try {
      const result = await renameCategory(categoryId, newName.trim())
      if (result.success) {
        onRenamed()
        onOpenChange(false)
      } else {
        setError(result.error ?? 'Failed to rename category')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error')
    } finally {
      setIsRenaming(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rename Category</DialogTitle>
          <DialogDescription>
            Enter a new name for &ldquo;{currentName}&rdquo;.
          </DialogDescription>
        </DialogHeader>

        <div>
          <label
            htmlFor="rename-category-name"
            className="block text-sm font-medium mb-1"
          >
            Category name
          </label>
          <input
            id="rename-category-name"
            type="text"
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value)
              setError(null)
            }}
            onKeyDown={handleKeyDown}
            autoFocus
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {error && (
            <p className="text-sm text-destructive mt-1">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isRenaming}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isRenaming || !newName.trim() || newName.trim() === currentName}
          >
            {isRenaming ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Renaming...
              </>
            ) : (
              'Rename'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
