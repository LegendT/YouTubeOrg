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
  ArrowsDownUp,
  MagnifyingGlass,
  Warning,
  PencilSimple,
  Trash,
  Plus,
  FolderOpen,
} from '@phosphor-icons/react'
import type { ConsolidationProposal, ConfidenceLevel } from '@/types/analysis'
import type { CategoryListItem } from '@/types/categories'

type SortField = 'name' | 'videos' | 'playlists' | 'confidence'

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
  // Management mode props
  managementMode?: boolean
  items?: CategoryListItem[]
  onRename?: (id: number, name: string) => void
  onDelete?: (id: number, name: string, videoCount: number) => void
  onAssignVideos?: (id: number, name: string, videoCount: number) => void
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
      return 'text-success'
    case 'MEDIUM':
      return 'text-warning'
    case 'LOW':
      return 'text-destructive'
  }
}

function getStatusBorderClass(status: string): string {
  switch (status) {
    case 'approved':
      return 'border-l-[3px] border-l-[var(--success)]'
    case 'rejected':
      return 'border-l-[3px] border-l-destructive'
    default:
      return 'border-l-[3px] border-l-transparent'
  }
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'approved':
      return (
        <Badge variant="default" className="text-xs">
          <Check size={12} className="mr-1" />
          Approved
        </Badge>
      )
    case 'rejected':
      return (
        <Badge variant="secondary" className="text-xs">
          <X size={12} className="mr-1" />
          Rejected
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="text-xs">
          <Circle size={12} className="mr-1" />
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

type SortOrder = 'asc' | 'desc'

// Management mode sort fields (no confidence)
type ManagementSortField = 'name' | 'videos' | 'playlists'

function sortCategories(
  items: CategoryListItem[],
  field: ManagementSortField,
  order: SortOrder
): CategoryListItem[] {
  // Always put protected (Uncategorised) at the bottom
  const regular = items.filter((c) => !c.isProtected)
  const protectedItems = items.filter((c) => c.isProtected)

  const sorted = [...regular].sort((a, b) => {
    let comparison = 0
    switch (field) {
      case 'name':
        comparison = a.name.localeCompare(b.name)
        break
      case 'videos':
        comparison = a.videoCount - b.videoCount
        break
      case 'playlists':
        comparison = a.sourcePlaylistNames.length - b.sourcePlaylistNames.length
        break
    }
    return order === 'asc' ? comparison : -comparison
  })

  return [...sorted, ...protectedItems]
}

export function CategoryList({
  proposals,
  selectedId,
  onSelect,
  batchSelection,
  focusedIndex,
  managementMode = false,
  items,
  onRename,
  onDelete,
  onAssignVideos,
}: CategoryListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const listRef = useRef<HTMLDivElement>(null)

  // ====================================================================
  // MANAGEMENT MODE
  // ====================================================================
  if (managementMode && items) {
    const managementSortField = (
      sortField === 'confidence' ? 'name' : sortField
    ) as ManagementSortField

    const filtered = searchQuery.trim()
      ? items.filter((c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : items

    const sorted = sortCategories(filtered, managementSortField, sortOrder)

    const allVisibleIds = sorted.map((c) => c.id)

    const managementSortLabels: Record<ManagementSortField, string> = {
      name: 'Name',
      videos: 'Videos',
      playlists: 'Playlists',
    }

    function toggleSort(field: ManagementSortField) {
      if (managementSortField === field) {
        setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortField(field)
        setSortOrder(field === 'name' ? 'asc' : 'desc')
      }
    }

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
              <MagnifyingGlass size={16} className="absolute left-2.5 top-2.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search categories"
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1.5 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>

          {/* Sort buttons */}
          <div className="flex gap-1 flex-wrap">
            {(Object.keys(managementSortLabels) as ManagementSortField[]).map(
              (field) => (
                <Button
                  key={field}
                  variant={managementSortField === field ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => toggleSort(field)}
                >
                  {managementSortLabels[field]}
                  {managementSortField === field && (
                    <ArrowsDownUp size={12} className="ml-1" />
                  )}
                </Button>
              )
            )}
          </div>
        </div>

        {/* Category list */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1" ref={listRef}>
            {sorted.map((category, idx) => {
              const isFocused = focusedIndex === idx
              const isChecked =
                batchSelection?.isSelected(category.id) ?? false

              return (
                <div
                  key={category.id}
                  data-category-item
                  className={`group flex items-start gap-2 rounded-md px-3 py-2.5 transition-colors hover:bg-accent/50 ${
                    selectedId === category.id ? 'bg-accent' : ''
                  } ${isFocused ? 'ring-2 ring-primary' : ''} ${
                    category.isProtected ? 'opacity-70' : ''
                  }`}
                >
                  {batchSelection && (
                    <div className="pt-0.5">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() =>
                          batchSelection.toggle(category.id)
                        }
                        aria-label={`Select ${category.name}`}
                      />
                    </div>
                  )}
                  <button
                    onClick={() => onSelect(category.id)}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <FolderOpen size={14} className="text-muted-foreground shrink-0" />
                          <span className="font-medium text-sm truncate">
                            {category.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{category.videoCount} videos</span>
                          <span>
                            {category.sourcePlaylistNames.length} playlists
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Hover action buttons */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 p-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRename?.(category.id, category.name)
                      }}
                      disabled={category.isProtected}
                      title="Rename category"
                      aria-label="Rename category"
                    >
                      <PencilSimple size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 p-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete?.(
                          category.id,
                          category.name,
                          category.videoCount
                        )
                      }}
                      disabled={category.isProtected}
                      title="Delete category"
                      aria-label="Delete category"
                    >
                      <Trash size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 p-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        onAssignVideos?.(
                          category.id,
                          category.name,
                          category.videoCount
                        )
                      }}
                      title="Assign videos"
                      aria-label="Assign videos"
                    >
                      <Plus size={14} />
                    </Button>
                  </div>
                </div>
              )
            })}

            {sorted.length === 0 && !searchQuery && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No categories to display
              </div>
            )}

            {sorted.length === 0 && searchQuery && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No categories match &quot;{searchQuery}&quot;
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    )
  }

  // ====================================================================
  // ANALYSIS MODE (existing, unchanged)
  // ====================================================================

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
            <MagnifyingGlass size={16} className="absolute left-2.5 top-2.5 text-muted-foreground" />
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
                <ArrowsDownUp size={12} className="ml-1" />
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
                className={`${getStatusBorderClass(proposal.status)} flex items-start gap-2 rounded-md px-3 py-2.5 transition-colors hover:bg-accent/50 ${
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
                      <span className="font-medium text-sm truncate">
                        {proposal.categoryName}
                      </span>
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
              <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-warning">
                <Warning size={16} />
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
                      className={`${getStatusBorderClass(proposal.status)} flex items-start gap-2 rounded-md px-3 py-2.5 transition-colors hover:bg-accent/50 ${
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
                            <span className="font-medium text-sm truncate">
                              {proposal.categoryName}
                            </span>
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
