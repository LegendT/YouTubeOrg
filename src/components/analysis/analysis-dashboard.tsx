'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Columns, Rows, ShieldCheck, GitMerge, Plus } from '@phosphor-icons/react'
import { Spinner } from '@/components/ui/spinner'
import { SummaryCard } from './summary-card'
import { CategoryList } from './category-list'
import { CategoryDetail } from './category-detail'
import { ProgressTracker } from './progress-tracker'
import { FinalReview } from './final-review'
import { DuplicateResolver } from './duplicate-resolver'
import { StalenessBanner } from './staleness-banner'
import { useBatchSelection } from './batch-operations'
import { useCategoryKeyboardNav } from './keyboard-nav'
import { CreateCategoryDialog } from './manual-adjustments'
import { UndoBanner } from './undo-banner'
import { RenameCategoryDialog } from './rename-category-dialog'
import { DeleteCategoryDialog } from './delete-category-dialog'
import { MergeCategoriesDialog } from './merge-categories-dialog'
import { VideoAssignmentDialog } from './video-assignment-dialog'
import { useUndoStack } from '@/lib/categories/undo-stack'
import {
  getCategoryDetail,
  getAllPlaylistsForSelector,
  getDuplicateVideos,
  runAnalysis,
} from '@/app/actions/analysis'
import {
  getCategories,
  getCategoryDetailManagement,
  undoDelete,
  undoMerge,
  createCategory,
} from '@/app/actions/categories'
import { useRouter } from 'next/navigation'
import type {
  ConsolidationProposal,
  AnalysisSummary,
  StalenessCheck,
  CategoryMetrics,
  VideoDetail,
  DuplicateRecord,
} from '@/types/analysis'
import type {
  CategoryListItem,
  DeleteUndoData,
  MergeUndoData,
  VideoSearchResult,
} from '@/types/categories'

type Orientation = 'horizontal' | 'vertical'

interface AnalysisDashboardProps {
  proposals: ConsolidationProposal[]
  summary: AnalysisSummary
  staleness?: StalenessCheck
  allPlaylists?: Array<{ id: number; title: string; itemCount: number }>
  managementMode?: boolean
  categories?: CategoryListItem[]
}

interface CategoryData {
  metrics: CategoryMetrics
  videos: VideoDetail[]
}

interface ManagementDetailData {
  category: {
    id: number
    name: string
    videoCount: number
    isProtected: boolean
    createdAt: Date
    updatedAt: Date
  }
  videos: VideoSearchResult[]
  total: number
}

export function AnalysisDashboard({
  proposals,
  summary,
  staleness,
  allPlaylists: initialPlaylists,
  managementMode = false,
  categories: initialCategories,
}: AnalysisDashboardProps) {
  const [orientation, setOrientation] = useState<Orientation>('horizontal')
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null
  )
  const [categoryData, setCategoryData] = useState<CategoryData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showFinalReview, setShowFinalReview] = useState(false)
  const [allPlaylists, setAllPlaylists] = useState<
    Array<{ id: number; title: string; itemCount: number }>
  >(initialPlaylists ?? [])
  const [duplicates, setDuplicates] = useState<DuplicateRecord[]>([])
  const [duplicatesLoaded, setDuplicatesLoaded] = useState(false)
  const [rightPanelTab, setRightPanelTab] = useState<string>('detail')

  // Management mode state
  const [managedCategories, setManagedCategories] = useState<CategoryListItem[]>(
    initialCategories ?? []
  )
  const [managementDetail, setManagementDetail] =
    useState<ManagementDetailData | null>(null)
  const [renameTarget, setRenameTarget] = useState<{
    id: number
    name: string
  } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number
    name: string
    videoCount: number
  } | null>(null)
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false)
  const [assignTarget, setAssignTarget] = useState<{
    id: number
    name: string
    videoCount: number
  } | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  const undoStack = useUndoStack()

  const router = useRouter()
  const selectedProposal =
    proposals.find((p) => p.id === selectedCategoryId) ?? null

  // Batch selection hook
  const batchSelection = useBatchSelection()

  // Keyboard navigation hook -- in management mode, use categories as navigation source
  const keyboardNav = useCategoryKeyboardNav({
    categories: managementMode
      ? managedCategories.map((c) => ({ id: c.id, categoryName: c.name }))
      : proposals,
    onSelect: setSelectedCategoryId,
  })

  // Fetch all playlists for selectors on mount if not passed as prop
  useEffect(() => {
    if (!initialPlaylists) {
      getAllPlaylistsForSelector().then(setAllPlaylists)
    }
  }, [initialPlaylists])

  // === Analysis mode data fetching ===
  const fetchCategoryData = useCallback(async (proposalId: number) => {
    setIsLoading(true)
    setCategoryData(null)
    try {
      const data = await getCategoryDetail(proposalId)
      setCategoryData(data)
    } catch (error) {
      console.error('Failed to fetch category detail:', error)
      setCategoryData(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // === Management mode data fetching ===
  const fetchManagementDetail = useCallback(async (categoryId: number) => {
    setIsLoading(true)
    setManagementDetail(null)
    try {
      const data = await getCategoryDetailManagement(categoryId)
      setManagementDetail(data)
    } catch (error) {
      console.error('Failed to fetch management detail:', error)
      setManagementDetail(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedCategoryId) {
      if (managementMode) {
        fetchManagementDetail(selectedCategoryId)
      } else {
        fetchCategoryData(selectedCategoryId)
      }
    } else {
      setCategoryData(null)
      setManagementDetail(null)
    }
  }, [selectedCategoryId, fetchCategoryData, fetchManagementDetail, managementMode])

  // === Refresh pattern for management mode ===
  const refreshManagementData = useCallback(async () => {
    const updated = await getCategories()
    setManagedCategories(updated)
    if (selectedCategoryId) {
      fetchManagementDetail(selectedCategoryId)
    }
    router.refresh()
  }, [selectedCategoryId, fetchManagementDetail, router])

  const handleStatusChange = useCallback(() => {
    if (managementMode) {
      refreshManagementData()
    } else {
      if (selectedCategoryId) {
        fetchCategoryData(selectedCategoryId)
      }
      router.refresh()
    }
  }, [selectedCategoryId, fetchCategoryData, router, managementMode, refreshManagementData])

  // Load duplicates when switching to duplicates tab
  useEffect(() => {
    if (rightPanelTab === 'duplicates' && !duplicatesLoaded) {
      getDuplicateVideos().then((result) => {
        if (result.success) {
          setDuplicates(result.duplicates)
        }
        setDuplicatesLoaded(true)
      })
    }
  }, [rightPanelTab, duplicatesLoaded])

  // Handle re-analyze from staleness banner
  const handleReAnalyze = useCallback(() => {
    router.refresh()
  }, [router])

  // Count approved proposals
  const approvedCount = useMemo(
    () => proposals.filter((p) => p.status === 'approved').length,
    [proposals]
  )

  const handleFinalizeComplete = useCallback(() => {
    setShowFinalReview(false)
    router.refresh()
  }, [router])

  // === Management mode handlers ===

  const handleRename = useCallback(
    (id: number, name: string) => {
      setRenameTarget({ id, name })
    },
    []
  )

  const handleDelete = useCallback(
    (id: number, name: string, videoCount: number) => {
      setDeleteTarget({ id, name, videoCount })
    },
    []
  )

  const handleAssignVideos = useCallback(
    (id: number, name: string, videoCount: number) => {
      setAssignTarget({ id, name, videoCount })
    },
    []
  )

  const handleDeleteCompleted = useCallback(
    (undoData: DeleteUndoData) => {
      undoStack.push({
        type: 'delete',
        label: `Deleted "${undoData.categoryName}"`,
        undoAction: () => undoDelete(undoData),
      })
      setDeleteTarget(null)
      // If the deleted category was selected, clear selection
      if (selectedCategoryId === undoData.categoryId) {
        setSelectedCategoryId(null)
      }
      refreshManagementData()
    },
    [undoStack, selectedCategoryId, refreshManagementData]
  )

  const handleMergeCompleted = useCallback(
    (undoData: MergeUndoData) => {
      undoStack.push({
        type: 'merge',
        label: `Merged ${undoData.originalCategories.length} categories`,
        undoAction: () => undoMerge(undoData),
      })
      setMergeDialogOpen(false)
      batchSelection.clearAll()
      setSelectedCategoryId(null)
      refreshManagementData()
    },
    [undoStack, batchSelection, refreshManagementData]
  )

  const handleUndoAction = useCallback(async () => {
    const result = await undoStack.undo()
    if (result.success) {
      refreshManagementData()
    }
  }, [undoStack, refreshManagementData])

  const handleCreateCategorySubmit = useCallback(async (name: string) => {
    setIsCreating(true)
    try {
      const result = await createCategory(name.trim())
      if (result.success) {
        setCreateDialogOpen(false)
        refreshManagementData()
      }
      return result
    } finally {
      setIsCreating(false)
    }
  }, [refreshManagementData])

  // Build merge dialog source categories from batch selection
  const mergeCandidates = useMemo(() => {
    if (!managementMode) return []
    return managedCategories
      .filter((c) => batchSelection.isSelected(c.id))
      .map((c) => ({ id: c.id, name: c.name, videoCount: c.videoCount }))
  }, [managementMode, managedCategories, batchSelection])

  // Get all categories for video assignment dialog (excluding target)
  const allCategoriesForAssignment = useMemo(
    () => managedCategories.map((c) => ({ id: c.id, name: c.name })),
    [managedCategories]
  )

  // Get selected managed category for detail panel
  const selectedManagedCategory = useMemo(
    () => managedCategories.find((c) => c.id === selectedCategoryId) ?? null,
    [managedCategories, selectedCategoryId]
  )

  // ====================================================================
  // MANAGEMENT MODE RENDERING
  // ====================================================================
  if (managementMode) {
    return (
      <div className="space-y-4">
        {/* Toolbar row: Summary + actions */}
        <div className="flex items-center justify-between gap-4">
          <SummaryCard summary={summary} />
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateDialogOpen(true)}
              disabled={isCreating}
            >
              {isCreating ? (
                <Spinner size={16} className="mr-1.5" />
              ) : (
                <Plus size={16} className="mr-1.5" />
              )}
              New Category
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setOrientation((o) =>
                  o === 'horizontal' ? 'vertical' : 'horizontal'
                )
              }
              title={`Switch to ${orientation === 'horizontal' ? 'vertical' : 'horizontal'} layout`}
            >
              {orientation === 'horizontal' ? (
                <Rows size={16} />
              ) : (
                <Columns size={16} />
              )}
            </Button>
          </div>
        </div>

        {/* Split panel layout */}
        <div className="h-[calc(100vh-320px)] rounded-lg border">
          <ResizablePanelGroup direction={orientation}>
            {/* Left panel: Category list with batch operations */}
            <ResizablePanel defaultSize={35} minSize={25}>
              <div className="relative flex flex-col h-full">
                <div className="flex-1 overflow-hidden">
                  <CategoryList
                    proposals={proposals}
                    selectedId={selectedCategoryId}
                    onSelect={setSelectedCategoryId}
                    batchSelection={batchSelection}
                    focusedIndex={keyboardNav.focusedIndex}
                    managementMode={true}
                    items={managedCategories}
                    onRename={handleRename}
                    onDelete={handleDelete}
                    onAssignVideos={handleAssignVideos}
                  />
                </div>

                {/* Keyboard shortcut hint */}
                {batchSelection.selectedIds.size === 0 && (
                  <div className="border-t border-border px-3 py-2">
                    <p className="text-xs text-muted-foreground">
                      <kbd className="bg-muted border border-border rounded px-1.5 py-0.5 text-xs font-mono text-muted-foreground">j</kbd>
                      {' '}<kbd className="bg-muted border border-border rounded px-1.5 py-0.5 text-xs font-mono text-muted-foreground">k</kbd>
                      {' '}to navigate{' \u00B7 '}
                      <kbd className="bg-muted border border-border rounded px-1.5 py-0.5 text-xs font-mono text-muted-foreground">?</kbd>
                      {' '}for all shortcuts
                    </p>
                  </div>
                )}

                {/* Batch operations toolbar with Merge button */}
                {batchSelection.selectedIds.size > 0 && (
                  <ManagementBatchToolbar
                    selectedIds={batchSelection.selectedIds}
                    clearAll={batchSelection.clearAll}
                    onMerge={() => setMergeDialogOpen(true)}
                  />
                )}
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />

            {/* Right panel: Detail */}
            <ResizablePanel defaultSize={65} minSize={30}>
              <div className="h-full overflow-hidden">
                {selectedCategoryId && selectedManagedCategory ? (
                  isLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Spinner size={20} />
                        <span>Loading category details...</span>
                      </div>
                    </div>
                  ) : managementDetail ? (
                    <CategoryDetail
                      proposal={null as unknown as ConsolidationProposal}
                      metrics={null as unknown as CategoryMetrics}
                      videos={[]}
                      allPlaylists={allPlaylists}
                      onStatusChange={handleStatusChange}
                      managementMode={true}
                      category={selectedManagedCategory}
                      managementVideos={managementDetail.videos}
                      onRename={handleRename}
                      onDelete={handleDelete}
                      onAssignVideos={handleAssignVideos}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      Failed to load category details
                    </div>
                  )
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Select a category to view details
                  </div>
                )}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        {/* Management mode dialogs */}
        {renameTarget && (
          <RenameCategoryDialog
            categoryId={renameTarget.id}
            currentName={renameTarget.name}
            open={true}
            onOpenChange={(open) => {
              if (!open) setRenameTarget(null)
            }}
            onRenamed={() => {
              setRenameTarget(null)
              refreshManagementData()
            }}
          />
        )}

        {deleteTarget && (
          <DeleteCategoryDialog
            categoryId={deleteTarget.id}
            categoryName={deleteTarget.name}
            videoCount={deleteTarget.videoCount}
            open={true}
            onOpenChange={(open) => {
              if (!open) setDeleteTarget(null)
            }}
            onDeleted={handleDeleteCompleted}
          />
        )}

        {mergeDialogOpen && mergeCandidates.length >= 2 && (
          <MergeCategoriesDialog
            categories={mergeCandidates}
            open={true}
            onOpenChange={(open) => {
              if (!open) setMergeDialogOpen(false)
            }}
            onMerged={handleMergeCompleted}
          />
        )}

        {assignTarget && (
          <VideoAssignmentDialog
            categoryId={assignTarget.id}
            categoryName={assignTarget.name}
            currentVideoCount={assignTarget.videoCount}
            open={true}
            onOpenChange={(open) => {
              if (!open) setAssignTarget(null)
            }}
            onAssigned={() => {
              setAssignTarget(null)
              refreshManagementData()
            }}
            allCategories={allCategoriesForAssignment}
          />
        )}

        {/* Create new category dialog */}
        <CreateNewCategoryDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSubmit={handleCreateCategorySubmit}
          isCreating={isCreating}
        />

        {/* Undo banner */}
        <UndoBanner
          canUndo={undoStack.canUndo}
          latest={undoStack.latest}
          onUndo={handleUndoAction}
          isUndoing={undoStack.isUndoing}
        />
      </div>
    )
  }

  // ====================================================================
  // ANALYSIS MODE RENDERING (existing, unchanged)
  // ====================================================================
  return (
    <div className="space-y-4">
      {/* Staleness banner */}
      {staleness && staleness.isStale && (
        <StalenessBanner staleness={staleness} onReAnalyze={handleReAnalyze} />
      )}

      {/* Progress tracker */}
      <ProgressTracker proposals={proposals} />

      {/* Toolbar row: Summary + actions */}
      <div className="flex items-center justify-between gap-4">
        <SummaryCard summary={summary} />
        <div className="flex items-center gap-2">
          <CreateCategoryDialog
            allPlaylists={allPlaylists}
            onCreated={handleStatusChange}
          />
          <Button
            variant="default"
            size="sm"
            onClick={() => setShowFinalReview(true)}
            disabled={approvedCount === 0}
            title={
              approvedCount === 0
                ? 'Approve at least one category to review'
                : undefined
            }
          >
            <ShieldCheck size={16} className="mr-1.5" />
            Review &amp; Execute
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setOrientation((o) =>
                o === 'horizontal' ? 'vertical' : 'horizontal'
              )
            }
            title={`Switch to ${orientation === 'horizontal' ? 'vertical' : 'horizontal'} layout`}
          >
            {orientation === 'horizontal' ? (
              <Rows size={16} />
            ) : (
              <Columns size={16} />
            )}
          </Button>
        </div>
      </div>

      {/* Split panel layout */}
      <div className="h-[calc(100vh-380px)] rounded-lg border">
        <ResizablePanelGroup direction={orientation}>
          {/* Left panel: Category list with batch operations */}
          <ResizablePanel defaultSize={35} minSize={25}>
            <div className="relative flex flex-col h-full">
              <div className="flex-1 overflow-hidden">
                <CategoryList
                  proposals={proposals}
                  selectedId={selectedCategoryId}
                  onSelect={setSelectedCategoryId}
                  batchSelection={batchSelection}
                  focusedIndex={keyboardNav.focusedIndex}
                />
              </div>

              {/* Keyboard shortcut hint */}
              {batchSelection.selectedIds.size === 0 && (
                <div className="border-t border-border px-3 py-2">
                  <p className="text-xs text-muted-foreground">
                    <kbd className="bg-muted border border-border rounded px-1.5 py-0.5 text-xs font-mono text-muted-foreground">j</kbd>
                    {' '}<kbd className="bg-muted border border-border rounded px-1.5 py-0.5 text-xs font-mono text-muted-foreground">k</kbd>
                    {' '}to navigate{' \u00B7 '}
                    <kbd className="bg-muted border border-border rounded px-1.5 py-0.5 text-xs font-mono text-muted-foreground">?</kbd>
                    {' '}for all shortcuts
                  </p>
                </div>
              )}

              {/* Batch operations floating toolbar */}
              {batchSelection.selectedIds.size > 0 && (
                <BatchToolbar
                  selectedIds={batchSelection.selectedIds}
                  clearAll={batchSelection.clearAll}
                  onComplete={handleStatusChange}
                />
              )}
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />

          {/* Right panel: Detail or Duplicates */}
          <ResizablePanel defaultSize={65} minSize={30}>
            <Tabs
              value={rightPanelTab}
              onValueChange={setRightPanelTab}
              className="h-full flex flex-col"
            >
              <div className="border-b px-4">
                <TabsList className="h-10">
                  <TabsTrigger value="detail">Category Detail</TabsTrigger>
                  <TabsTrigger value="duplicates">Duplicates</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="detail" className="flex-1 m-0 overflow-hidden">
                {selectedCategoryId && selectedProposal ? (
                  isLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Spinner size={20} />
                        <span>Loading category details...</span>
                      </div>
                    </div>
                  ) : categoryData ? (
                    <CategoryDetail
                      proposal={selectedProposal}
                      metrics={categoryData.metrics}
                      videos={categoryData.videos}
                      allPlaylists={allPlaylists}
                      onStatusChange={handleStatusChange}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      Failed to load category details
                    </div>
                  )
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Select a category to view details
                  </div>
                )}
              </TabsContent>

              <TabsContent
                value="duplicates"
                className="flex-1 m-0 overflow-auto p-4"
              >
                {duplicatesLoaded ? (
                  <DuplicateResolver duplicates={duplicates} />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Spinner size={20} />
                      <span>Loading duplicates...</span>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Final review dialog */}
      <FinalReview
        proposals={proposals}
        summary={summary}
        open={showFinalReview}
        onOpenChange={setShowFinalReview}
        onExecute={handleFinalizeComplete}
      />
    </div>
  )
}

// === Analysis mode batch toolbar (inline, unchanged) ===

import { useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Check, X, ArrowCounterClockwise } from '@phosphor-icons/react'
import { bulkUpdateStatus } from '@/app/actions/analysis'

function BatchToolbar({
  selectedIds,
  clearAll,
  onComplete,
}: {
  selectedIds: Set<number>
  clearAll: () => void
  onComplete: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const handleBatchAction = (status: 'approved' | 'rejected' | 'pending') => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return

    startTransition(async () => {
      const result = await bulkUpdateStatus(ids, status)
      if (result.success) {
        const label = status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'reset to pending'
        setFeedback({
          type: 'success',
          message: `${result.updatedCount} ${result.updatedCount === 1 ? 'category' : 'categories'} ${label}`,
        })
        clearAll()
        onComplete()
      } else {
        setFeedback({
          type: 'error',
          message: result.error ?? 'Batch action failed',
        })
      }
      setTimeout(() => setFeedback(null), 4000)
    })
  }

  return (
    <div className="sticky bottom-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">
          {selectedIds.size}{' '}
          {selectedIds.size === 1 ? 'category' : 'categories'} selected
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleBatchAction('pending')}
            disabled={isPending}
          >
            {isPending ? (
              <Spinner size={16} className="mr-1.5" />
            ) : (
              <ArrowCounterClockwise size={16} className="mr-1.5" />
            )}
            Reset
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleBatchAction('rejected')}
            disabled={isPending}
          >
            {isPending ? (
              <Spinner size={16} className="mr-1.5" />
            ) : (
              <X size={16} className="mr-1.5" />
            )}
            Reject
          </Button>
          <Button
            size="sm"
            onClick={() => handleBatchAction('approved')}
            disabled={isPending}
          >
            {isPending ? (
              <Spinner size={16} className="mr-1.5" />
            ) : (
              <Check size={16} className="mr-1.5" />
            )}
            Approve
          </Button>
        </div>
      </div>

      {feedback && (
        <div className="mt-2">
          <Badge
            variant={feedback.type === 'success' ? 'default' : 'destructive'}
          >
            {feedback.message}
          </Badge>
        </div>
      )}
    </div>
  )
}

// === Management mode batch toolbar ===

function ManagementBatchToolbar({
  selectedIds,
  clearAll,
  onMerge,
}: {
  selectedIds: Set<number>
  clearAll: () => void
  onMerge: () => void
}) {
  return (
    <div className="sticky bottom-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">
          {selectedIds.size}{' '}
          {selectedIds.size === 1 ? 'category' : 'categories'} selected
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={clearAll}
          >
            <X size={16} className="mr-1.5" />
            Clear
          </Button>
          {selectedIds.size >= 2 && (
            <Button
              size="sm"
              onClick={onMerge}
            >
              <GitMerge size={16} className="mr-1.5" />
              Merge {selectedIds.size} categories
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// === Create new category dialog ===

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

function CreateNewCategoryDialog({
  open,
  onOpenChange,
  onSubmit,
  isCreating,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (name: string) => Promise<{ success: boolean; error?: string }>
  isCreating: boolean
}) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setName('')
      setError(null)
    }
  }, [open])

  const handleSubmit = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Category name cannot be empty')
      return
    }
    if (trimmed.length > 150) {
      setError('Category name must be 150 characters or less')
      return
    }
    setError(null)
    const result = await onSubmit(trimmed)
    if (!result.success) {
      setError(result.error ?? 'Failed to create category')
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
          <DialogTitle>New Category</DialogTitle>
          <DialogDescription>
            Create an empty category. You can assign videos to it afterward.
          </DialogDescription>
        </DialogHeader>

        <div>
          <label
            htmlFor="new-category-name"
            className="block text-sm font-medium mb-1"
          >
            Category name
          </label>
          <input
            id="new-category-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError(null)
            }}
            onKeyDown={handleKeyDown}
            autoFocus
            placeholder="e.g. Machine Learning Tutorials"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {error && (
            <p className="text-sm text-destructive mt-1">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isCreating || !name.trim()}
          >
            {isCreating ? (
              <>
                <Spinner size={16} />
                Creating...
              </>
            ) : (
              'Create'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
