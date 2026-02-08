'use client'

import { useState, useCallback, useMemo } from 'react'
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
import { ArrowLeft, ArrowRight, Scissors } from '@phosphor-icons/react'
import { Spinner } from '@/components/ui/spinner'
import { splitProposal } from '@/app/actions/analysis'
import type { ConsolidationProposal } from '@/types/analysis'

interface SplitWizardProps {
  proposal: ConsolidationProposal
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
}

type WizardStep = 'count' | 'name' | 'assign'

interface WizardState {
  step: WizardStep
  splitCount: number
  names: string[]
  assignments: Map<number, number> // playlistId -> categoryIndex
}

const STEP_LABELS: Record<WizardStep, string> = {
  count: 'Choose count',
  name: 'Name categories',
  assign: 'Assign playlists',
}

const STEP_ORDER: WizardStep[] = ['count', 'name', 'assign']

function getStepNumber(step: WizardStep): number {
  return STEP_ORDER.indexOf(step) + 1
}

/**
 * Pick the two most dissimilar playlist names as default split names.
 * Uses a simple heuristic: shortest vs longest title by word count.
 */
function getDefaultNames(
  playlists: Array<{ id: number; title: string }>,
  count: number
): string[] {
  if (playlists.length === 0) return Array.from({ length: count }, (_, i) => `Category ${i + 1}`)

  // Sort by title length (word count) to get dissimilar names
  const sorted = [...playlists].sort(
    (a, b) => a.title.split(/\s+/).length - b.title.split(/\s+/).length
  )

  const defaults: string[] = []
  for (let i = 0; i < count; i++) {
    if (i === 0) {
      defaults.push(sorted[sorted.length - 1]?.title ?? `Category ${i + 1}`)
    } else if (i === 1) {
      defaults.push(sorted[0]?.title ?? `Category ${i + 1}`)
    } else {
      // For 3+ splits, pick from middle
      const midIndex = Math.floor((sorted.length * i) / count)
      defaults.push(sorted[midIndex]?.title ?? `Category ${i + 1}`)
    }
  }

  return defaults
}

export function SplitWizard({
  proposal,
  open,
  onOpenChange,
  onComplete,
}: SplitWizardProps) {
  const maxSplit = Math.max(2, proposal.playlists.length)

  const [state, setState] = useState<WizardState>({
    step: 'count',
    splitCount: 2,
    names: getDefaultNames(proposal.playlists, 2),
    assignments: new Map(),
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetWizard = useCallback(() => {
    setState({
      step: 'count',
      splitCount: 2,
      names: getDefaultNames(proposal.playlists, 2),
      assignments: new Map(),
    })
    setError(null)
    setIsSubmitting(false)
  }, [proposal.playlists])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        resetWizard()
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange, resetWizard]
  )

  const handleCountChange = useCallback(
    (newCount: number) => {
      const clamped = Math.min(Math.max(2, newCount), maxSplit)
      setState((prev) => ({
        ...prev,
        splitCount: clamped,
        names: getDefaultNames(proposal.playlists, clamped),
        assignments: new Map(),
      }))
    },
    [maxSplit, proposal.playlists]
  )

  const handleNameChange = useCallback((index: number, name: string) => {
    setState((prev) => {
      const names = [...prev.names]
      names[index] = name
      return { ...prev, names }
    })
  }, [])

  const handleAssign = useCallback((playlistId: number, categoryIndex: number) => {
    setState((prev) => {
      const assignments = new Map(prev.assignments)
      // If already assigned to this category, unassign
      if (assignments.get(playlistId) === categoryIndex) {
        assignments.delete(playlistId)
      } else {
        assignments.set(playlistId, categoryIndex)
      }
      return { ...prev, assignments }
    })
  }, [])

  // Calculate estimated video counts per category
  const categoryVideoCounts = useMemo(() => {
    const counts: number[] = Array.from({ length: state.splitCount }, () => 0)
    for (const [playlistId, categoryIndex] of state.assignments) {
      const playlist = proposal.playlists.find((p) => p.id === playlistId)
      if (playlist) {
        // Use totalVideos / playlists.length as rough per-playlist estimate
        // if we don't have individual itemCounts
        counts[categoryIndex] += Math.round(
          proposal.totalVideos / proposal.playlists.length
        )
      }
    }
    return counts
  }, [state.assignments, state.splitCount, proposal])

  // Validation for assign step: all playlists must be assigned
  const allAssigned = proposal.playlists.every((p) =>
    state.assignments.has(p.id)
  )

  // Validation for name step: all names must be non-empty
  const allNamed = state.names
    .slice(0, state.splitCount)
    .every((n) => n.trim().length > 0)

  const goNext = useCallback(() => {
    setState((prev) => {
      const currentIndex = STEP_ORDER.indexOf(prev.step)
      if (currentIndex < STEP_ORDER.length - 1) {
        return { ...prev, step: STEP_ORDER[currentIndex + 1] }
      }
      return prev
    })
  }, [])

  const goBack = useCallback(() => {
    setState((prev) => {
      const currentIndex = STEP_ORDER.indexOf(prev.step)
      if (currentIndex > 0) {
        return { ...prev, step: STEP_ORDER[currentIndex - 1] }
      }
      return prev
    })
  }, [])

  const handleSplit = useCallback(async () => {
    setError(null)
    setIsSubmitting(true)

    try {
      // Build SplitInput[] from wizard state
      const categoryMap = new Map<number, number[]>()
      for (const [playlistId, categoryIndex] of state.assignments) {
        const existing = categoryMap.get(categoryIndex) ?? []
        existing.push(playlistId)
        categoryMap.set(categoryIndex, existing)
      }

      const newCategories = Array.from(categoryMap.entries()).map(
        ([index, playlistIds]) => ({
          name: state.names[index].trim(),
          playlistIds,
        })
      )

      const result = await splitProposal(proposal.id, newCategories)

      if (!result.success) {
        setError(result.error ?? 'Failed to split proposal')
        setIsSubmitting(false)
        return
      }

      handleOpenChange(false)
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error')
      setIsSubmitting(false)
    }
  }, [state, proposal.id, handleOpenChange, onComplete])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Split Category</DialogTitle>
          <DialogDescription>
            Step {getStepNumber(state.step)} of 3:{' '}
            {STEP_LABELS[state.step]}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex gap-1">
          {STEP_ORDER.map((step, i) => (
            <div
              key={step}
              className={`h-1 flex-1 rounded-full ${
                i <= STEP_ORDER.indexOf(state.step)
                  ? 'bg-primary'
                  : 'bg-muted'
              }`}
            />
          ))}
        </div>

        <div className="py-2">
          {/* Step 1: Count */}
          {state.step === 'count' && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  Current category
                </p>
                <p className="font-medium">{proposal.categoryName}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {proposal.playlists.length} source playlist
                  {proposal.playlists.length !== 1 ? 's' : ''},{' '}
                  {proposal.totalVideos.toLocaleString()} videos
                </p>
              </div>

              <div>
                <label
                  htmlFor="split-count"
                  className="block text-sm font-medium mb-2"
                >
                  Split into how many categories?
                </label>
                <input
                  id="split-count"
                  type="number"
                  min={2}
                  max={maxSplit}
                  value={state.splitCount}
                  onChange={(e) => handleCountChange(Number(e.target.value))}
                  className="flex h-9 w-24 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Min 2, max {maxSplit} (number of source playlists)
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Name */}
          {state.step === 'name' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Name each new category:
              </p>
              {Array.from({ length: state.splitCount }, (_, i) => (
                <div key={i}>
                  <label
                    htmlFor={`cat-name-${i}`}
                    className="block text-xs font-medium mb-1 text-muted-foreground"
                  >
                    Category {i + 1}
                  </label>
                  <input
                    id={`cat-name-${i}`}
                    type="text"
                    value={state.names[i] ?? ''}
                    onChange={(e) => handleNameChange(i, e.target.value)}
                    placeholder={`Category ${i + 1} name`}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Step 3: Assign */}
          {state.step === 'assign' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Assign each playlist to a category. Each playlist can only
                belong to one category.
              </p>

              {Array.from({ length: state.splitCount }, (_, catIndex) => (
                <div
                  key={catIndex}
                  className="rounded-lg border p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">
                      {state.names[catIndex]}
                    </h4>
                    <span className="text-xs text-muted-foreground">
                      ~{categoryVideoCounts[catIndex].toLocaleString()} videos
                    </span>
                  </div>

                  {proposal.playlists.map((playlist) => {
                    const assignedTo = state.assignments.get(playlist.id)
                    const isAssignedHere = assignedTo === catIndex
                    const isAssignedElsewhere =
                      assignedTo !== undefined && assignedTo !== catIndex

                    return (
                      <label
                        key={playlist.id}
                        className={`flex items-center gap-2 text-sm py-1 px-2 rounded cursor-pointer hover:bg-muted/50 ${
                          isAssignedElsewhere
                            ? 'opacity-40'
                            : ''
                        }`}
                      >
                        <Checkbox
                          checked={isAssignedHere}
                          onCheckedChange={() =>
                            handleAssign(playlist.id, catIndex)
                          }
                          disabled={isAssignedElsewhere}
                        />
                        <span>{playlist.title}</span>
                      </label>
                    )
                  })}
                </div>
              ))}

              {!allAssigned && (
                <p className="text-xs text-warning">
                  All playlists must be assigned to a category before splitting.
                </p>
              )}
            </div>
          )}

          {/* Error display */}
          {error && (
            <p className="text-sm text-destructive mt-3">{error}</p>
          )}
        </div>

        <DialogFooter>
          {state.step !== 'count' && (
            <Button
              variant="outline"
              onClick={goBack}
              disabled={isSubmitting}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          )}

          {state.step === 'assign' ? (
            <Button
              onClick={handleSplit}
              disabled={!allAssigned || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Spinner size={16} />
                  Splitting...
                </>
              ) : (
                <>
                  <Scissors className="h-4 w-4" />
                  Split
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={goNext}
              disabled={state.step === 'name' && !allNamed}
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
