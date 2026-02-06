'use client'

import { Check, X, Circle } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import type { ConsolidationProposal } from '@/types/analysis'

interface ProgressTrackerProps {
  proposals: ConsolidationProposal[]
}

/**
 * Displays review progress for consolidation proposals.
 *
 * Shows a "Reviewed: X/Y categories" counter, a visual progress bar,
 * and status badges with counts for approved, rejected, and pending proposals.
 * Placed above the split-panel in the analysis dashboard.
 */
export function ProgressTracker({ proposals }: ProgressTrackerProps) {
  const total = proposals.length
  const approved = proposals.filter((p) => p.status === 'approved').length
  const rejected = proposals.filter((p) => p.status === 'rejected').length
  const pending = proposals.filter((p) => p.status === 'pending').length
  const reviewed = approved + rejected
  const percentage = total > 0 ? Math.round((reviewed / total) * 100) : 0

  if (total === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No categories to review yet. Run an analysis to get started.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          Reviewed: {reviewed}/{total} categories
        </span>
        <span className="text-xs text-muted-foreground">{percentage}%</span>
      </div>

      <Progress value={percentage} className="h-2" />

      <div className="flex items-center gap-3">
        <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
          <Check className="h-3 w-3 mr-1" />
          {approved} Approved
        </Badge>
        <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100">
          <X className="h-3 w-3 mr-1" />
          {rejected} Rejected
        </Badge>
        <Badge variant="outline">
          <Circle className="h-3 w-3 mr-1" />
          {pending} Pending
        </Badge>
      </div>
    </div>
  )
}
