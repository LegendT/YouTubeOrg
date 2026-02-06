'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Check,
  X,
  Circle,
  ArrowUpDown,
  Search,
  AlertTriangle,
} from 'lucide-react'
import type { ConsolidationProposal, ConfidenceLevel } from '@/types/analysis'

type SortField = 'name' | 'videos' | 'playlists' | 'confidence'
type SortOrder = 'asc' | 'desc'

interface CategoryListProps {
  proposals: ConsolidationProposal[]
  selectedId: number | null
  onSelect: (id: number) => void
  batchSelection?: {
    selectedIds: Set<number>
    toggle: (id: number) => void
    isSelected: (id: number) => boolean
    selectAll: (ids: number[]) => void
  }
  focusedIndex?: number
}

function getConfidenceLevel(score: number | null | undefined): ConfidenceLevel {
  if (score == null) return 'LOW'
  if (score >= 70) return 'HIGH'
  if (score >= 40) return 'MEDIUM'
  return 'LOW'
}

function getConfidenceColor(level: ConfidenceLevel): string {
  switch (level) {
    case 'HIGH':
      return 'text-green-600'
    case 'MEDIUM':
      return 'text-yellow-600'
    case 'LOW':
      return 'text-red-600'
  }
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'approved':
      return <Check className="h-3.5 w-3.5 text-green-600" />
    case 'rejected':
      return <X className="h-3.5 w-3.5 text-red-600" />
    default:
      return <Circle className="h-3.5 w-3.5 text-muted-foreground" />
  }
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'approved':
      return (
        <Badge variant="default" className="text-xs">
          <Check className="h-3 w-3 mr-1" />
          Approved
        </Badge>
      )
    case 'rejected':
      return (
        <Badge variant="secondary" className="text-xs">
          <X className="h-3 w-3 mr-1" />
          Rejected
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="text-xs">
          <Circle className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      )
  }
}

function sortProposals(
  proposals: ConsolidationProposal[],
  field: SortField,
  order: SortOrder
): ConsolidationProposal[] {
  return [...proposals].sort((a, b) => {
    let comparison = 0

    switch (field) {
      case 'name':
        comparison = a.categoryName.localeCompare(b.categoryName)
        break
      case 'videos':
        comparison = a.totalVideos - b.totalVideos
        break
      case 'playlists':
        comparison = a.playlists.length - b.playlists.length
        break
      case 'confidence':
        comparison = (a.confidenceScore ?? 0) - (b.confidenceScore ?? 0)
        break
    }

    return order === 'asc' ? comparison : -comparison
  })
}

export function CategoryList({
  proposals,
  selectedId,
  onSelect,
  batchSelection,
  focusedIndex,
}: CategoryListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const listRef = useRef<HTMLDivElement>(null)

  // Separate main list from "review needed"
  const { mainProposals, reviewNeeded } = useMemo(() => {
    const main: ConsolidationProposal[] = []
    const review: ConsolidationProposal[] = []

    for (const proposal of proposals) {
      const confidenceLevel = proposal.confidence?.level ?? getConfidenceLevel(proposal.confidenceScore)
      const needsReview =
        proposal.status === 'rejected' ||
        (confidenceLevel === 'LOW' && proposal.status === 'pending')

      if (needsReview) {
        review.push(proposal)
      } else {
        main.push(proposal)
      }
    }

    return { mainProposals: main, reviewNeeded: review }
  }, [proposals])

  // Filter by search
  const filteredMain = useMemo(() => {
    if (!searchQuery.trim()) return mainProposals
    const q = searchQuery.toLowerCase()
    return mainProposals.filter((p) =>
      p.categoryName.toLowerCase().includes(q)
    )
  }, [mainProposals, searchQuery])

  const filteredReview = useMemo(() => {
    if (!searchQuery.trim()) return reviewNeeded
    const q = searchQuery.toLowerCase()
    return reviewNeeded.filter((p) =>
      p.categoryName.toLowerCase().includes(q)
    )
  }, [reviewNeeded, searchQuery])

  // Sort
  const sortedMain = useMemo(
    () => sortProposals(filteredMain, sortField, sortOrder),
    [filteredMain, sortField, sortOrder]
  )

  const sortedReview = useMemo(
    () => sortProposals(filteredReview, sortField, sortOrder),
    [filteredReview, sortField, sortOrder]
  )

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder(field === 'name' ? 'asc' : 'desc')
    }
  }

  const sortLabels: Record<SortField, string> = {
    name: 'Name',
    videos: 'Videos',
    playlists: 'Playlists',
    confidence: 'Confidence',
  }

  // All visible proposal IDs (for select-all)
  const allVisibleIds = useMemo(
    () => [...sortedMain, ...sortedReview].map((p) => p.id),
    [sortedMain, sortedReview]
  )

  const allVisibleProposals = useMemo(
    () => [...sortedMain, ...sortedReview],
    [sortedMain, sortedReview]
  )

  // Auto-scroll focused item into view
  useEffect(() => {
    if (focusedIndex == null || !listRef.current) return
    const items = listRef.current.querySelectorAll('[data-category-item]')
    const item = items[focusedIndex] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [focusedIndex])

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 space-y-2 border-b">
        <div className="flex items-center gap-2">
          {batchSelection && (
            <Checkbox
              checked={
                allVisibleIds.length > 0 &&
                allVisibleIds.every((id) => batchSelection.isSelected(id))
              }
              onCheckedChange={() => {
                const allSelected =
                  allVisibleIds.length > 0 &&
                  allVisibleIds.every((id) => batchSelection.isSelected(id))
                if (allSelected) {
                  batchSelection.selectAll([])
                } else {
                  batchSelection.selectAll(allVisibleIds)
                }
              }}
              aria-label="Select all categories"
            />
          )}
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border bg-transparent py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        {/* Sort buttons */}
        <div className="flex gap-1 flex-wrap">
          {(Object.keys(sortLabels) as SortField[]).map((field) => (
            <Button
              key={field}
              variant={sortField === field ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => toggleSort(field)}
            >
              {sortLabels[field]}
              {sortField === field && (
                <ArrowUpDown className="h-3 w-3 ml-1" />
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Category list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1" ref={listRef}>
          {sortedMain.map((proposal, idx) => {
            const confidenceLevel =
              proposal.confidence?.level ??
              getConfidenceLevel(proposal.confidenceScore)
            const confidenceScore =
              proposal.confidence?.score ?? proposal.confidenceScore
            const isFocused = focusedIndex === idx
            const isChecked = batchSelection?.isSelected(proposal.id) ?? false

            return (
              <div
                key={proposal.id}
                data-category-item
                className={`flex items-start gap-2 rounded-md px-3 py-2.5 transition-colors hover:bg-accent/50 ${
                  selectedId === proposal.id ? 'bg-accent' : ''
                } ${isFocused ? 'ring-2 ring-primary' : ''}`}
              >
                {batchSelection && (
                  <div className="pt-0.5">
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => batchSelection.toggle(proposal.id)}
                      aria-label={`Select ${proposal.categoryName}`}
                    />
                  </div>
                )}
                <button
                  onClick={() => onSelect(proposal.id)}
                  className="flex-1 text-left min-w-0"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <StatusIcon status={proposal.status} />
                        <span className="font-medium text-sm truncate">
                          {proposal.categoryName}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{proposal.totalVideos} videos</span>
                        <span>{proposal.playlists.length} playlists</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <StatusBadge status={proposal.status} />
                      {confidenceScore != null && (
                        <span
                          className={`text-xs font-medium ${getConfidenceColor(confidenceLevel)}`}
                        >
                          {Math.round(confidenceScore)}%
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </div>
            )
          })}

          {sortedMain.length === 0 && !searchQuery && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No categories to display
            </div>
          )}

          {sortedMain.length === 0 && searchQuery && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No categories match &quot;{searchQuery}&quot;
            </div>
          )}

          {/* Review needed section */}
          {sortedReview.length > 0 && (
            <>
              <Separator className="my-2" />
              <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                Review needed ({sortedReview.length})
              </div>
              <div className="space-y-1">
                {sortedReview.map((proposal, reviewIdx) => {
                  const confidenceLevel =
                    proposal.confidence?.level ??
                    getConfidenceLevel(proposal.confidenceScore)
                  const confidenceScore =
                    proposal.confidence?.score ?? proposal.confidenceScore
                  const globalIdx = sortedMain.length + reviewIdx
                  const isFocused = focusedIndex === globalIdx
                  const isChecked = batchSelection?.isSelected(proposal.id) ?? false

                  return (
                    <div
                      key={proposal.id}
                      data-category-item
                      className={`flex items-start gap-2 rounded-md px-3 py-2.5 transition-colors hover:bg-accent/50 ${
                        selectedId === proposal.id ? 'bg-accent' : ''
                      } ${isFocused ? 'ring-2 ring-primary' : ''}`}
                    >
                      {batchSelection && (
                        <div className="pt-0.5">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() =>
                              batchSelection.toggle(proposal.id)
                            }
                            aria-label={`Select ${proposal.categoryName}`}
                          />
                        </div>
                      )}
                      <button
                        onClick={() => onSelect(proposal.id)}
                        className="flex-1 text-left min-w-0"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <StatusIcon status={proposal.status} />
                              <span className="font-medium text-sm truncate">
                                {proposal.categoryName}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span>{proposal.totalVideos} videos</span>
                              <span>
                                {proposal.playlists.length} playlists
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <StatusBadge status={proposal.status} />
                            {confidenceScore != null && (
                              <span
                                className={`text-xs font-medium ${getConfidenceColor(confidenceLevel)}`}
                              >
                                {Math.round(confidenceScore)}%
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
