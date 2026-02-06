'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { Button } from '@/components/ui/button'
import { Columns, Rows, Loader2 } from 'lucide-react'
import { SummaryCard } from './summary-card'
import { CategoryList } from './category-list'
import { CategoryDetail } from './category-detail'
import { getCategoryDetail } from '@/app/actions/analysis'
import type {
  ConsolidationProposal,
  AnalysisSummary,
  CategoryMetrics,
  VideoDetail,
} from '@/types/analysis'

type Orientation = 'horizontal' | 'vertical'

interface AnalysisDashboardProps {
  proposals: ConsolidationProposal[]
  summary: AnalysisSummary
}

interface CategoryData {
  metrics: CategoryMetrics
  videos: VideoDetail[]
}

export function AnalysisDashboard({
  proposals,
  summary,
}: AnalysisDashboardProps) {
  const [orientation, setOrientation] = useState<Orientation>('horizontal')
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null
  )
  const [categoryData, setCategoryData] = useState<CategoryData | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const selectedProposal = proposals.find((p) => p.id === selectedCategoryId) ?? null

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
    // Re-fetch category data after status change to reflect updated state
    if (selectedCategoryId) {
      fetchCategoryData(selectedCategoryId)
    }
  }, [selectedCategoryId, fetchCategoryData])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <SummaryCard summary={summary} />
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

      <div className="h-[calc(100vh-280px)] rounded-lg border">
        <ResizablePanelGroup direction={orientation}>
          <ResizablePanel defaultSize={35} minSize={25}>
            <CategoryList
              proposals={proposals}
              selectedId={selectedCategoryId}
              onSelect={setSelectedCategoryId}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={65} minSize={30}>
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
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  )
}
