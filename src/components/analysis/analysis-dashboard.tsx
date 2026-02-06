'use client'

import { useState } from 'react'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { Button } from '@/components/ui/button'
import { Columns, Rows } from 'lucide-react'
import { SummaryCard } from './summary-card'
import { CategoryList } from './category-list'
import type { ConsolidationProposal, AnalysisSummary } from '@/types/analysis'

type Orientation = 'horizontal' | 'vertical'

interface AnalysisDashboardProps {
  proposals: ConsolidationProposal[]
  summary: AnalysisSummary
}

export function AnalysisDashboard({
  proposals,
  summary,
}: AnalysisDashboardProps) {
  const [orientation, setOrientation] = useState<Orientation>('horizontal')
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null
  )

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
            {selectedCategoryId ? (
              <div className="flex items-center justify-center h-full p-4 text-muted-foreground">
                {/* CategoryDetail component will be added by Plan 02-08 */}
                <div className="text-center space-y-2">
                  <p className="text-lg font-medium">
                    Category #{selectedCategoryId}
                  </p>
                  <p className="text-sm">
                    Detail view coming in next plan
                  </p>
                </div>
              </div>
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
