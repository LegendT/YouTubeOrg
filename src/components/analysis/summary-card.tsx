'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AnalysisSummary } from '@/types/analysis'

interface SummaryCardProps {
  summary: AnalysisSummary
}

export function SummaryCard({ summary }: SummaryCardProps) {
  return (
    <Card className="flex-1">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Analysis Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-6 text-sm">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold">{summary.totalPlaylists}</span>
            <span className="text-muted-foreground">playlists</span>
            <span className="mx-2 text-muted-foreground">&rarr;</span>
            <span className="text-2xl font-bold">{summary.proposedCategories}</span>
            <span className="text-muted-foreground">proposed categories</span>
          </div>
          <div className="text-muted-foreground">
            {summary.duplicatesFound} duplicates found
          </div>
          <div className="text-muted-foreground">
            {summary.approvedCount} approved, {summary.rejectedCount} rejected, {summary.pendingCount} pending
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
