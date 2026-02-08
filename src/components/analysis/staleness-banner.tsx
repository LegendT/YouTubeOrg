'use client'

import { useState } from 'react'
import { Warning, X } from '@phosphor-icons/react'
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
    <Card className="border-warning/20 bg-warning/10">
      <CardContent className="flex items-start gap-3 p-4">
        <Warning className="h-5 w-5 text-warning shrink-0 mt-0.5" weight="fill" />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium text-warning">
            {staleness.message ?? 'Playlist data has changed since last analysis.'}
          </p>
          <p className="text-xs text-warning/80">
            Last analysed: {formatDate(staleness.lastAnalysisDate)} | Last sync:{' '}
            {formatDate(staleness.lastSyncDate)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="border-warning/30 text-warning hover:bg-warning/20"
            onClick={onReAnalyze}
          >
            Re-analyse
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-warning hover:text-warning hover:bg-warning/20"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss staleness warning"
          >
            <X size={16} />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
