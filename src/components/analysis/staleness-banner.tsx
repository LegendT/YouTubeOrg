'use client'

import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { StalenessCheck } from '@/types/analysis'

interface StalenessBannerProps {
  staleness: StalenessCheck
  onReAnalyze: () => void
}

/**
 * Warning banner shown when analysis data is stale relative to
 * the latest playlist sync. Dismissible via close button; reappears
 * on page reload.
 */
export function StalenessBanner({ staleness, onReAnalyze }: StalenessBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (!staleness.isStale || dismissed) {
    return null
  }

  const formatDate = (date?: Date) => {
    if (!date) return 'Unknown'
    return new Date(date).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
      <CardContent className="flex items-start gap-3 p-4">
        <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            {staleness.message ?? 'Playlist data has changed since last analysis.'}
          </p>
          <p className="text-xs text-yellow-700 dark:text-yellow-300">
            Last analyzed: {formatDate(staleness.lastAnalysisDate)} | Last sync:{' '}
            {formatDate(staleness.lastSyncDate)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="border-yellow-500 text-yellow-800 hover:bg-yellow-100 dark:text-yellow-200 dark:hover:bg-yellow-900"
            onClick={onReAnalyze}
          >
            Re-analyze
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-yellow-600 hover:text-yellow-800 hover:bg-yellow-100 dark:hover:bg-yellow-900"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss staleness warning"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
