'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Columns, Rows, Loader2, Shield } from 'lucide-react'
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
import {
  getCategoryDetail,
  getAllPlaylistsForSelector,
  getDuplicateVideos,
  runAnalysis,
} from '@/app/actions/analysis'
import { useRouter } from 'next/navigation'
import type {
  ConsolidationProposal,
  AnalysisSummary,
  StalenessCheck,
  CategoryMetrics,
  VideoDetail,
  DuplicateRecord,
} from '@/types/analysis'

type Orientation = 'horizontal' | 'vertical'

interface AnalysisDashboardProps {
  proposals: ConsolidationProposal[]
  summary: AnalysisSummary
  staleness?: StalenessCheck
  allPlaylists?: Array<{ id: number; title: string; itemCount: number }>
}

interface CategoryData {
  metrics: CategoryMetrics
  videos: VideoDetail[]
}

export function AnalysisDashboard({
  proposals,
  summary,
  staleness,
  allPlaylists: initialPlaylists,
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

  const router = useRouter()
  const selectedProposal =
    proposals.find((p) => p.id === selectedCategoryId) ?? null

  // Batch selection hook
  const batchSelection = useBatchSelection()

  // Keyboard navigation hook
  const keyboardNav = useCategoryKeyboardNav({
    categories: proposals,
    onSelect: setSelectedCategoryId,
  })

  // Fetch all playlists for selectors on mount if not passed as prop
  useEffect(() => {
    if (!initialPlaylists) {
      getAllPlaylistsForSelector().then(setAllPlaylists)
    }
  }, [initialPlaylists])

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

  useEffect(() => {
    if (selectedCategoryId) {
      fetchCategoryData(selectedCategoryId)
    } else {
      setCategoryData(null)
    }
  }, [selectedCategoryId, fetchCategoryData])

  const handleStatusChange = useCallback(() => {
    if (selectedCategoryId) {
      fetchCategoryData(selectedCategoryId)
    }
    router.refresh()
  }, [selectedCategoryId, fetchCategoryData, router])

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
            <Shield className="h-4 w-4 mr-1.5" />
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
              <Rows className="h-4 w-4" />
            ) : (
              <Columns className="h-4 w-4" />
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
                        <Loader2 className="h-5 w-5 animate-spin" />
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
                      <Loader2 className="h-5 w-5 animate-spin" />
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

// === Batch toolbar (inline) ===

import { useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Check, X } from 'lucide-react'
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

  const handleBatchAction = (status: 'approved' | 'rejected') => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return

    startTransition(async () => {
      const result = await bulkUpdateStatus(ids, status)
      if (result.success) {
        const label = status === 'approved' ? 'approved' : 'rejected'
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
            variant="outline"
            onClick={() => handleBatchAction('rejected')}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <X className="h-4 w-4 mr-1.5" />
            )}
            Reject
          </Button>
          <Button
            size="sm"
            onClick={() => handleBatchAction('approved')}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-1.5" />
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
