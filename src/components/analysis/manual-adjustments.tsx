'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Plus,
  X,
  MagnifyingGlass,
  FolderPlus,
  Warning,
} from '@phosphor-icons/react'
import { Spinner } from '@/components/ui/spinner'
import {
  updateProposalPlaylists,
  createCustomCategory,
} from '@/app/actions/analysis'

// ---- Shared types ----

interface PlaylistInfo {
  id: number
  title: string
  itemCount: number
}

// ---- RemovePlaylistButton ----

interface RemovePlaylistButtonProps {
  proposalId: number
  playlistIdToRemove: number
  currentPlaylistIds: number[]
  disabled?: boolean
  onUpdate: () => void
}

export function RemovePlaylistButton({
  proposalId,
  playlistIdToRemove,
  currentPlaylistIds,
  disabled = false,
  onUpdate,
}: RemovePlaylistButtonProps) {
  const [isRemoving, setIsRemoving] = useState(false)

  const handleRemove = async () => {
    setIsRemoving(true)
    try {
      const newIds = currentPlaylistIds.filter(
        (id) => id !== playlistIdToRemove
      )
      const result = await updateProposalPlaylists(proposalId, newIds)
      if (result.success) {
        onUpdate()
      }
    } catch (err) {
      console.error('Failed to remove playlist:', err)
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <button
      onClick={handleRemove}
      disabled={disabled || isRemoving}
      title={
        disabled
          ? 'Cannot remove the only playlist'
          : 'Remove playlist from this category'
      }
      className="inline-flex items-center justify-center h-5 w-5 rounded-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {isRemoving ? (
        <Spinner size={12} />
      ) : (
        <X className="h-3 w-3" />
      )}
    </button>
  )
}

// ---- AddPlaylistSelector ----

interface AddPlaylistSelectorProps {
  proposalId: number
  currentPlaylistIds: number[]
  allPlaylists: PlaylistInfo[]
  onUpdate: () => void
}

export function AddPlaylistSelector({
  proposalId,
  currentPlaylistIds,
  allPlaylists,
  onUpdate,
}: AddPlaylistSelectorProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Available playlists = all minus those already in this proposal
  const currentSet = useMemo(
    () => new Set(currentPlaylistIds),
    [currentPlaylistIds]
  )

  const available = useMemo(() => {
    return allPlaylists
      .filter((p) => !currentSet.has(p.id))
      .filter(
        (p) =>
          search.trim() === '' ||
          p.title.toLowerCase().includes(search.toLowerCase())
      )
  }, [allPlaylists, currentSet, search])

  const toggleSelect = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleAdd = async () => {
    if (selected.size === 0) return
    setError(null)
    setIsAdding(true)

    try {
      const newIds = [...currentPlaylistIds, ...Array.from(selected)]
      const result = await updateProposalPlaylists(proposalId, newIds)
      if (result.success) {
        setOpen(false)
        setSearch('')
        setSelected(new Set())
        onUpdate()
      } else {
        setError(result.error ?? 'Failed to add playlists')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error')
    } finally {
      setIsAdding(false)
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      setSearch('')
      setSelected(new Set())
      setError(null)
    }
  }

  const noAvailable = allPlaylists.filter((p) => !currentSet.has(p.id)).length === 0

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={noAvailable}
        title={noAvailable ? 'All playlists already included' : undefined}
      >
        <Plus className="h-4 w-4" />
        Add playlist
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Playlists</DialogTitle>
            <DialogDescription>
              Select playlists to add to this category.
            </DialogDescription>
          </DialogHeader>

          {/* Search input */}
          <div className="relative">
            <MagnifyingGlass className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search playlists..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {/* Playlist list */}
          <ScrollArea className="h-64">
            <div className="space-y-1 pr-3">
              {available.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {search.trim()
                    ? 'No matching playlists found'
                    : 'All playlists already included'}
                </p>
              ) : (
                available.map((playlist) => (
                  <label
                    key={playlist.id}
                    className="flex items-center gap-2 text-sm py-1.5 px-2 rounded cursor-pointer hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selected.has(playlist.id)}
                      onCheckedChange={() => toggleSelect(playlist.id)}
                    />
                    <span className="flex-1 truncate">{playlist.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {(playlist.itemCount ?? 0).toLocaleString()} videos
                    </span>
                  </label>
                ))
              )}
            </div>
          </ScrollArea>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isAdding}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={selected.size === 0 || isAdding}
            >
              {isAdding ? (
                <>
                  <Spinner size={16} />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Add {selected.size > 0 ? `(${selected.size})` : ''}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ---- CreateCategoryDialog ----

interface CreateCategoryDialogProps {
  allPlaylists: PlaylistInfo[]
  onCreated: () => void
}

export function CreateCategoryDialog({
  allPlaylists,
  onCreated,
}: CreateCategoryDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (search.trim() === '') return allPlaylists
    return allPlaylists.filter((p) =>
      p.title.toLowerCase().includes(search.toLowerCase())
    )
  }, [allPlaylists, search])

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  // Estimate video count from selected playlists
  const estimatedVideos = useMemo(() => {
    return allPlaylists
      .filter((p) => selectedIds.has(p.id))
      .reduce((sum, p) => sum + (p.itemCount ?? 0), 0)
  }, [allPlaylists, selectedIds])

  const isOverLimit = estimatedVideos > 4500
  const isWarning = estimatedVideos >= 3000 && estimatedVideos <= 4500

  const handleCreate = async () => {
    if (!name.trim() || selectedIds.size === 0) return
    setError(null)
    setIsCreating(true)

    try {
      const result = await createCustomCategory(
        name.trim(),
        Array.from(selectedIds)
      )
      if (result.success) {
        handleOpenChange(false)
        onCreated()
      } else {
        setError(result.error ?? 'Failed to create category')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error')
    } finally {
      setIsCreating(false)
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      setName('')
      setSearch('')
      setSelectedIds(new Set())
      setError(null)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <FolderPlus className="h-4 w-4" />
        Create new category
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Category</DialogTitle>
            <DialogDescription>
              Name your category and select the playlists to include.
            </DialogDescription>
          </DialogHeader>

          {/* Category name */}
          <div>
            <label
              htmlFor="new-cat-name"
              className="block text-sm font-medium mb-1"
            >
              Category name
            </label>
            <input
              id="new-cat-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. JavaScript Tutorials"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {/* Search input */}
          <div className="relative">
            <MagnifyingGlass className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search playlists..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {/* Playlist list */}
          <ScrollArea className="h-56">
            <div className="space-y-1 pr-3">
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No matching playlists
                </p>
              ) : (
                filtered.map((playlist) => (
                  <label
                    key={playlist.id}
                    className="flex items-center gap-2 text-sm py-1.5 px-2 rounded cursor-pointer hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selectedIds.has(playlist.id)}
                      onCheckedChange={() => toggleSelect(playlist.id)}
                    />
                    <span className="flex-1 truncate">{playlist.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {(playlist.itemCount ?? 0).toLocaleString()} videos
                    </span>
                  </label>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Video count estimate */}
          {selectedIds.size > 0 && (
            <div
              className={`flex items-center gap-2 text-sm px-3 py-2 rounded-md ${
                isOverLimit
                  ? 'bg-destructive/10 text-destructive'
                  : isWarning
                    ? 'bg-warning/10 text-warning'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {(isOverLimit || isWarning) && (
                <Warning className="h-4 w-4 shrink-0" />
              )}
              <span>
                ~{estimatedVideos.toLocaleString()} estimated videos
                {isOverLimit && ' (exceeds 4,500 limit)'}
                {isWarning && ' (approaching 4,500 limit)'}
              </span>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                !name.trim() ||
                selectedIds.size === 0 ||
                isCreating ||
                isOverLimit
              }
            >
              {isCreating ? (
                <>
                  <Spinner size={16} />
                  Creating...
                </>
              ) : (
                <>
                  <FolderPlus className="h-4 w-4" />
                  Create
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ---- ManualAdjustments (container) ----

interface ManualAdjustmentsProps {
  proposalId: number
  currentPlaylistIds: number[]
  allPlaylists: PlaylistInfo[]
  sourcePlaylists: Array<{ playlistId: number; playlistTitle: string }>
  onUpdate: () => void
  onSplitClick: () => void
}

/**
 * Container component for all manual adjustment controls.
 * Shows source playlists with remove buttons, add button, and split button.
 * Only renders for pending proposals (parent controls visibility).
 */
export function ManualAdjustments({
  proposalId,
  currentPlaylistIds,
  allPlaylists,
  sourcePlaylists,
  onUpdate,
  onSplitClick,
}: ManualAdjustmentsProps) {
  const canRemove = currentPlaylistIds.length > 1

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">
        Adjustments
      </h3>

      {/* Source playlists with remove buttons */}
      <div className="space-y-1">
        {sourcePlaylists.map((sp) => (
          <div
            key={sp.playlistId}
            className="flex items-center justify-between gap-2 text-sm py-1 px-2 rounded hover:bg-muted/30"
          >
            <span className="truncate">{sp.playlistTitle}</span>
            <RemovePlaylistButton
              proposalId={proposalId}
              playlistIdToRemove={sp.playlistId}
              currentPlaylistIds={currentPlaylistIds}
              disabled={!canRemove}
              onUpdate={onUpdate}
            />
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <AddPlaylistSelector
          proposalId={proposalId}
          currentPlaylistIds={currentPlaylistIds}
          allPlaylists={allPlaylists}
          onUpdate={onUpdate}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={onSplitClick}
          disabled={currentPlaylistIds.length < 2}
          title={
            currentPlaylistIds.length < 2
              ? 'Need at least 2 playlists to split'
              : 'Split this category into multiple'
          }
        >
          <span className="text-xs">Split category</span>
        </Button>
      </div>
    </div>
  )
}
