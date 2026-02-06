'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Loader2,
  Search,
  X,
  AlertTriangle,
} from 'lucide-react'
import {
  searchVideosForAssignment,
  assignVideosToCategory,
} from '@/app/actions/categories'
import type { VideoSearchResult } from '@/types/categories'

interface VideoAssignmentDialogProps {
  categoryId: number
  categoryName: string
  currentVideoCount: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onAssigned: () => void
  allCategories: Array<{ id: number; name: string }>
}

/**
 * VideoAssignmentDialog - Full-screen dialog for searching, browsing, and
 * assigning videos to a category.
 *
 * Left panel (70%): search bar + source category tabs + video list with
 * checkboxes. Right panel (30%): selected video summary, move/copy toggle,
 * video limit indicator, and assign button. Enforces 5,000 video limit.
 */
export function VideoAssignmentDialog({
  categoryId,
  categoryName,
  currentVideoCount,
  open,
  onOpenChange,
  onAssigned,
  allCategories,
}: VideoAssignmentDialogProps) {
  // Search state
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<VideoSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [totalResults, setTotalResults] = useState(0)

  // Source category browsing
  const [activeSourceId, setActiveSourceId] = useState<number | null>(null)

  // Selection state
  const [selectedVideos, setSelectedVideos] = useState<Map<number, VideoSearchResult>>(
    new Map()
  )

  // Move/copy mode
  const [mode, setMode] = useState<'copy' | 'move'>('copy')

  // Assignment state
  const [isAssigning, setIsAssigning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Debounce ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Filter out target category from source categories
  const sourceCategories = allCategories.filter((c) => c.id !== categoryId)

  // Video limit calculations
  const selectedCount = selectedVideos.size
  const projectedCount = currentVideoCount + selectedCount
  const isOverLimit = projectedCount > 5000
  const isNearLimit = projectedCount >= 4500 && projectedCount <= 5000

  const canAssign = selectedCount > 0 && !isOverLimit && !isAssigning

  // Reset all state when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery('')
      setSearchResults([])
      setIsSearching(false)
      setTotalResults(0)
      setActiveSourceId(null)
      setSelectedVideos(new Map())
      setMode('copy')
      setIsAssigning(false)
      setError(null)
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    }
  }, [open])

  // Debounced search on query change
  useEffect(() => {
    if (!open) return

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const result = await searchVideosForAssignment(
          query,
          activeSourceId ?? undefined
        )
        setSearchResults(result.videos)
        setTotalResults(result.total)
      } catch {
        setSearchResults([])
        setTotalResults(0)
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query, activeSourceId, open])

  // Handle source category tab click
  const handleSourceTab = useCallback(
    (catId: number | null) => {
      setActiveSourceId(catId)
      // Reset query when switching source tabs
      setQuery('')
    },
    []
  )

  // Toggle video selection
  const toggleVideo = useCallback(
    (video: VideoSearchResult) => {
      setSelectedVideos((prev) => {
        const next = new Map(prev)
        if (next.has(video.id)) {
          next.delete(video.id)
        } else {
          next.set(video.id, video)
        }
        return next
      })
    },
    []
  )

  // Remove from selection
  const removeSelected = useCallback((videoId: number) => {
    setSelectedVideos((prev) => {
      const next = new Map(prev)
      next.delete(videoId)
      return next
    })
  }, [])

  // Check if video is already in target category
  const isAlreadyInTarget = useCallback(
    (video: VideoSearchResult) => {
      return video.categoryNames.includes(categoryName)
    },
    [categoryName]
  )

  // Handle assign
  const handleAssign = useCallback(async () => {
    if (!canAssign) return

    setIsAssigning(true)
    setError(null)

    try {
      const videoIds = Array.from(selectedVideos.keys())
      const result = await assignVideosToCategory(
        categoryId,
        videoIds,
        mode,
        mode === 'move' && activeSourceId !== null ? activeSourceId : undefined
      )

      if (result.success) {
        onAssigned()
        onOpenChange(false)
      } else {
        setError(result.error ?? 'Assignment failed')
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred'
      )
    } finally {
      setIsAssigning(false)
    }
  }, [
    canAssign,
    selectedVideos,
    categoryId,
    mode,
    activeSourceId,
    onAssigned,
    onOpenChange,
  ])

  // Parse ISO 8601 duration to readable format
  const formatDuration = useCallback((duration: string | null): string => {
    if (!duration) return ''
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
    if (!match) return ''
    const h = parseInt(match[1] || '0', 10)
    const m = parseInt(match[2] || '0', 10)
    const s = parseInt(match[3] || '0', 10)
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${m}:${String(s).padStart(2, '0')}`
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Assign Videos to &ldquo;{categoryName}&rdquo;
          </DialogTitle>
          <DialogDescription>
            Search or browse videos from other categories to assign them here.
          </DialogDescription>
        </DialogHeader>

        {/* Two-column layout */}
        <div className="flex-1 flex gap-0 overflow-hidden min-h-0">
          {/* Left panel: search + browse + results (70%) */}
          <div className="flex-[7] flex flex-col overflow-hidden min-w-0">
            {/* Search bar */}
            <div className="relative px-4 pb-3">
              <Search className="absolute left-7 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title or channel name..."
                className="flex h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* Source category tabs */}
            <div className="px-4 pb-3">
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => handleSourceTab(null)}
                  className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    activeSourceId === null
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  All Videos
                </button>
                {sourceCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleSourceTab(cat.id)}
                    className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium transition-colors truncate max-w-[200px] ${
                      activeSourceId === cat.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Results info bar */}
            <div className="px-4 pb-2 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {isSearching ? (
                  'Searching...'
                ) : (
                  <>
                    {totalResults.toLocaleString()} video
                    {totalResults !== 1 ? 's' : ''} found
                    {query && (
                      <span>
                        {' '}
                        for &ldquo;{query}&rdquo;
                      </span>
                    )}
                  </>
                )}
              </p>
            </div>

            {/* Video list */}
            <ScrollArea className="flex-1 px-4">
              {isSearching && searchResults.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-muted-foreground">
                    {query
                      ? 'No videos found matching your search.'
                      : 'No videos available in this category.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {searchResults.map((video) => {
                    const alreadyInTarget = isAlreadyInTarget(video)
                    const isSelected = selectedVideos.has(video.id)

                    return (
                      <div
                        key={video.id}
                        className={`flex items-center gap-3 rounded-md p-2 text-sm transition-colors ${
                          alreadyInTarget
                            ? 'opacity-50'
                            : isSelected
                            ? 'bg-accent'
                            : 'hover:bg-accent/50'
                        }`}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleVideo(video)}
                          disabled={alreadyInTarget}
                        />

                        {/* Thumbnail */}
                        {video.thumbnailUrl ? (
                          <img
                            src={video.thumbnailUrl}
                            alt=""
                            className="w-10 h-[30px] object-cover rounded-sm shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-[30px] bg-muted rounded-sm shrink-0" />
                        )}

                        {/* Video info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{video.title}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {video.channelTitle && (
                              <span className="truncate">
                                {video.channelTitle}
                              </span>
                            )}
                            {video.duration && (
                              <span className="shrink-0">
                                {formatDuration(video.duration)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Category badges */}
                        <div className="flex items-center gap-1 shrink-0">
                          {alreadyInTarget && (
                            <Badge
                              variant="secondary"
                              className="text-xs shrink-0"
                            >
                              Already added
                            </Badge>
                          )}
                          {video.categoryNames
                            .filter((name) => name !== categoryName)
                            .slice(0, 2)
                            .map((name) => (
                              <Badge
                                key={name}
                                variant="outline"
                                className="text-xs shrink-0 max-w-[120px] truncate"
                              >
                                {name}
                              </Badge>
                            ))}
                          {video.categoryNames.filter(
                            (name) => name !== categoryName
                          ).length > 2 && (
                            <Badge
                              variant="outline"
                              className="text-xs shrink-0"
                            >
                              +
                              {video.categoryNames.filter(
                                (name) => name !== categoryName
                              ).length - 2}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Right panel: selection summary (30%) */}
          <div className="flex-[3] border-l flex flex-col overflow-hidden">
            {/* Selected header */}
            <div className="px-4 py-3 border-b">
              <h3 className="text-sm font-semibold">
                Selected ({selectedCount})
              </h3>
            </div>

            {/* Selected video list */}
            <ScrollArea className="flex-1 px-4 py-2">
              {selectedCount === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  Select videos from the left panel to assign them.
                </p>
              ) : (
                <div className="space-y-1">
                  {Array.from(selectedVideos.values()).map((video) => (
                    <div
                      key={video.id}
                      className="flex items-center gap-2 rounded-md p-1.5 text-xs group hover:bg-accent/50"
                    >
                      <span className="flex-1 truncate">{video.title}</span>
                      <button
                        onClick={() => removeSelected(video.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground shrink-0"
                        aria-label={`Remove ${video.title}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Mode toggle + limit indicator + action */}
            <div className="border-t px-4 py-3 space-y-3">
              {/* Move/Copy toggle -- Move only available when browsing a specific source */}
              {activeSourceId !== null && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Assignment mode
                  </p>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="assign-mode"
                        value="copy"
                        checked={mode === 'copy'}
                        onChange={() => setMode('copy')}
                        className="accent-primary"
                      />
                      Copy (keep in both)
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="assign-mode"
                        value="move"
                        checked={mode === 'move'}
                        onChange={() => setMode('move')}
                        className="accent-primary"
                      />
                      Move (remove from source)
                    </label>
                  </div>
                </div>
              )}

              {/* Video limit indicator */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Video limit</span>
                  <span
                    className={
                      isOverLimit
                        ? 'text-destructive font-semibold'
                        : isNearLimit
                        ? 'text-amber-600 dark:text-amber-400 font-medium'
                        : 'text-muted-foreground'
                    }
                  >
                    {projectedCount.toLocaleString()} / 5,000
                  </span>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isOverLimit
                        ? 'bg-destructive'
                        : isNearLimit
                        ? 'bg-amber-500'
                        : 'bg-primary'
                    }`}
                    style={{
                      width: `${Math.min((projectedCount / 5000) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Warnings */}
              {isNearLimit && (
                <div className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>Approaching 5,000 video limit</span>
                </div>
              )}

              {isOverLimit && (
                <div className="flex items-start gap-1.5 text-xs text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>Exceeds 5,000 video limit</span>
                </div>
              )}

              {/* Error display */}
              {error && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2">
                  <p className="text-xs text-destructive">{error}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isAssigning}
          >
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={!canAssign}>
            {isAssigning ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : null}
            Assign {selectedCount} video{selectedCount !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
