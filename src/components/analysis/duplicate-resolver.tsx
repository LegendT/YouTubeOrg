'use client'

import { useState, useMemo, useTransition, useCallback } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog'
import { CheckCircle2, ListChecks, Loader2, AlertCircle } from 'lucide-react'
import { resolveDuplicates } from '@/app/actions/analysis'
import type { DuplicateRecord, DuplicateResolution } from '@/types/analysis'

interface DuplicateResolverProps {
  duplicates: DuplicateRecord[]
}

/**
 * Compute the "most specific playlist" for a duplicate video.
 *
 * Specificity heuristic per CONTEXT.md and RESEARCH.md:
 * 1. Playlist with the LONGEST title (more descriptive = more specific)
 * 2. Tiebreaker: playlist with fewer total videos (more focused)
 */
function getMostSpecificPlaylist(
  playlists: Array<{ playlistId: number; playlistTitle: string; itemCount: number }>
): number {
  if (playlists.length === 0) return -1

  const sorted = [...playlists].sort((a, b) => {
    // Primary: longest title first
    const titleDiff = b.playlistTitle.length - a.playlistTitle.length
    if (titleDiff !== 0) return titleDiff
    // Tiebreaker: fewest videos first
    return a.itemCount - b.itemCount
  })

  return sorted[0].playlistId
}

/**
 * DuplicateResolver - Bulk conflict resolution for duplicate videos.
 *
 * Shows a table of duplicate videos with multi-select checkboxes,
 * smart default resolution (keep from most specific playlist),
 * and a preview dialog before applying bulk resolutions.
 */
export function DuplicateResolver({ duplicates }: DuplicateResolverProps) {
  // Filter to unresolved duplicates
  const unresolvedDuplicates = useMemo(
    () => duplicates.filter((d) => d.resolvedPlaylistId === null),
    [duplicates]
  )

  const resolvedDuplicates = useMemo(
    () => duplicates.filter((d) => d.resolvedPlaylistId !== null),
    [duplicates]
  )

  // Smart defaults: map duplicateRecordId -> resolvedPlaylistId
  const defaultResolutions = useMemo(() => {
    const map = new Map<number, number>()
    for (const dup of unresolvedDuplicates) {
      const bestPlaylistId = getMostSpecificPlaylist(dup.playlists)
      if (bestPlaylistId !== -1) {
        map.set(dup.id, bestPlaylistId)
      }
    }
    return map
  }, [unresolvedDuplicates])

  // User overrides (initially empty, falls back to defaults)
  const [overrides, setOverrides] = useState<Map<number, number>>(new Map())

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  // Action states
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  // Get the effective resolution for a duplicate (override > default)
  const getResolution = useCallback(
    (dupId: number): number | undefined => {
      return overrides.get(dupId) ?? defaultResolutions.get(dupId)
    },
    [overrides, defaultResolutions]
  )

  // Set override for a specific duplicate
  const setResolution = useCallback((dupId: number, playlistId: number) => {
    setOverrides((prev) => {
      const next = new Map(prev)
      next.set(dupId, playlistId)
      return next
    })
  }, [])

  // Selection handlers
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

  const selectAll = useCallback(() => {
    if (selectedIds.size === unresolvedDuplicates.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(unresolvedDuplicates.map((d) => d.id)))
    }
  }, [selectedIds.size, unresolvedDuplicates])

  // Build preview data: group by target playlist
  const previewData = useMemo(() => {
    const groups = new Map<
      number,
      { playlistTitle: string; videos: string[]; count: number }
    >()

    for (const dupId of selectedIds) {
      const dup = unresolvedDuplicates.find((d) => d.id === dupId)
      if (!dup) continue

      const targetPlaylistId = getResolution(dupId)
      if (targetPlaylistId === undefined) continue

      const targetPlaylist = dup.playlists.find(
        (p) => p.playlistId === targetPlaylistId
      )
      if (!targetPlaylist) continue

      if (!groups.has(targetPlaylistId)) {
        groups.set(targetPlaylistId, {
          playlistTitle: targetPlaylist.playlistTitle,
          videos: [],
          count: 0,
        })
      }

      const group = groups.get(targetPlaylistId)!
      group.videos.push(dup.videoTitle)
      group.count++
    }

    return Array.from(groups.entries()).map(([playlistId, data]) => ({
      playlistId,
      ...data,
    }))
  }, [selectedIds, unresolvedDuplicates, getResolution])

  // Apply resolutions
  const handleApply = useCallback(() => {
    const resolutions: DuplicateResolution[] = []

    for (const dupId of selectedIds) {
      const targetPlaylistId = getResolution(dupId)
      if (targetPlaylistId !== undefined) {
        resolutions.push({
          duplicateRecordId: dupId,
          resolvedPlaylistId: targetPlaylistId,
        })
      }
    }

    if (resolutions.length === 0) return

    startTransition(async () => {
      const result = await resolveDuplicates(resolutions)

      if (result.success) {
        setFeedback({
          type: 'success',
          message: `Resolved ${result.resolvedCount} duplicate${result.resolvedCount === 1 ? '' : 's'}`,
        })
        setSelectedIds(new Set())
        setOverrides(new Map())
        setPreviewOpen(false)
      } else {
        setFeedback({
          type: 'error',
          message: result.error ?? 'Failed to resolve duplicates',
        })
      }

      // Clear feedback after a delay
      setTimeout(() => setFeedback(null), 4000)
    })
  }, [selectedIds, getResolution])

  const allSelected =
    unresolvedDuplicates.length > 0 &&
    selectedIds.size === unresolvedDuplicates.length
  const someSelected = selectedIds.size > 0

  if (duplicates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <CheckCircle2 className="h-10 w-10 mb-3" />
        <p className="text-sm font-medium">No duplicate videos found</p>
        <p className="text-xs mt-1">All videos are unique across playlists</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ListChecks className="h-5 w-5 text-muted-foreground" />
          <div>
            <h3 className="text-sm font-semibold">Duplicate Videos</h3>
            <p className="text-xs text-muted-foreground">
              {unresolvedDuplicates.length} unresolved
              {resolvedDuplicates.length > 0 && (
                <span>
                  {' '}
                  / {resolvedDuplicates.length} resolved
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Feedback message */}
        {feedback && (
          <Badge
            variant={feedback.type === 'success' ? 'default' : 'destructive'}
          >
            {feedback.message}
          </Badge>
        )}
      </div>

      {/* Bulk action toolbar */}
      {someSelected && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
          <span className="text-sm font-medium">
            {selectedIds.size} selected
          </span>
          <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Apply default resolution to selected
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Confirm Resolution</DialogTitle>
                <DialogDescription>
                  Review how duplicates will be resolved before applying.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {previewData.map((group) => (
                  <div
                    key={group.playlistId}
                    className="rounded-md border p-3 space-y-1"
                  >
                    <p className="text-sm font-medium">
                      Keep {group.count} video{group.count !== 1 ? 's' : ''} in{' '}
                      <span className="text-primary">
                        &quot;{group.playlistTitle}&quot;
                      </span>
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      {group.videos.slice(0, 5).map((title, i) => (
                        <li key={i} className="truncate">
                          {title}
                        </li>
                      ))}
                      {group.videos.length > 5 && (
                        <li className="text-xs italic">
                          ...and {group.videos.length - 5} more
                        </li>
                      )}
                    </ul>
                  </div>
                ))}
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" size="sm">
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  size="sm"
                  onClick={handleApply}
                  disabled={isPending}
                >
                  {isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Apply resolution
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Duplicates table */}
      {unresolvedDuplicates.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={selectAll}
                  aria-label="Select all duplicates"
                />
              </TableHead>
              <TableHead>Video Title</TableHead>
              <TableHead className="w-20 text-center">In Playlists</TableHead>
              <TableHead>Source Playlists</TableHead>
              <TableHead className="w-48">Resolve To</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {unresolvedDuplicates.map((dup) => {
              const currentResolution = getResolution(dup.id)
              return (
                <TableRow key={dup.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(dup.id)}
                      onCheckedChange={() => toggleSelect(dup.id)}
                      aria-label={`Select ${dup.videoTitle}`}
                    />
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium line-clamp-2">
                      {dup.videoTitle}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{dup.playlistCount}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {dup.playlists.map((p) => (
                        <Badge
                          key={p.playlistId}
                          variant={
                            currentResolution === p.playlistId
                              ? 'default'
                              : 'outline'
                          }
                          className="text-xs"
                        >
                          {p.playlistTitle}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <select
                      value={currentResolution ?? ''}
                      onChange={(e) =>
                        setResolution(dup.id, Number(e.target.value))
                      }
                      className="w-full rounded-md border bg-transparent px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="" disabled>
                        Select playlist...
                      </option>
                      {dup.playlists.map((p) => (
                        <option key={p.playlistId} value={p.playlistId}>
                          {p.playlistTitle}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      {/* Already resolved section */}
      {resolvedDuplicates.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Resolved ({resolvedDuplicates.length})
          </h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Video Title</TableHead>
                <TableHead className="w-20 text-center">In Playlists</TableHead>
                <TableHead className="w-48">Resolved To</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resolvedDuplicates.map((dup) => {
                const resolvedPlaylist = dup.playlists.find(
                  (p) => p.playlistId === dup.resolvedPlaylistId
                )
                return (
                  <TableRow key={dup.id} className="opacity-60">
                    <TableCell>
                      <span className="text-sm line-clamp-1">
                        {dup.videoTitle}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{dup.playlistCount}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                        <span className="text-xs truncate">
                          {resolvedPlaylist?.playlistTitle ?? 'Unknown'}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
