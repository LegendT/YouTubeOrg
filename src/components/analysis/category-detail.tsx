'use client'

import { useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent } from '@/components/ui/card'
import { ConfidenceBadge } from './confidence-badge'
import { ValidationBadge } from './validation-badge'
import { VideoListPaginated } from './video-list-paginated'
import { ProposalActions } from './proposal-actions'
import { SplitWizard } from './split-wizard'
import { ManualAdjustments } from './manual-adjustments'
import type {
  ConsolidationProposal,
  CategoryMetrics,
  VideoDetail,
} from '@/types/analysis'

interface CategoryDetailProps {
  proposal: ConsolidationProposal
  metrics: CategoryMetrics
  videos: VideoDetail[]
  allPlaylists: Array<{ id: number; title: string; itemCount: number }>
  onStatusChange?: () => void
}

export function CategoryDetail({
  proposal,
  metrics,
  videos,
  allPlaylists,
  onStatusChange,
}: CategoryDetailProps) {
  const [splitWizardOpen, setSplitWizardOpen] = useState(false)

  const sourcePlaylists = metrics.sourcePlaylistBreakdown.map((s) => ({
    id: s.playlistId,
    title: s.playlistTitle,
  }))

  // Build the metrics summary line per CONTEXT.md format:
  // "JavaScript: 247 unique videos from 3 playlists (JS Basics: 87, JS Advanced: 120, Web Dev: 42), 15 duplicates removed"
  const breakdownText = metrics.sourcePlaylistBreakdown
    .map((s) => `${s.playlistTitle}: ${s.videoCount.toLocaleString()}`)
    .join(', ')

  const isPending = proposal.status === 'pending'
  const currentPlaylistIds = proposal.playlists.map((p) => p.id)

  const handleAdjustmentUpdate = () => {
    // Re-fetch detail data via parent callback
    onStatusChange?.()
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Category name */}
        <h2 className="text-xl font-semibold tracking-tight">
          {proposal.categoryName}
        </h2>

        <Separator />

        {/* Confidence badge */}
        <div>
          <h3 className="text-sm font-medium mb-2 text-muted-foreground">
            Confidence
          </h3>
          <ConfidenceBadge
            score={metrics.confidence.score}
            level={metrics.confidence.level}
            reason={metrics.confidence.reason}
          />
        </div>

        <Separator />

        {/* Validation badge */}
        <div>
          <h3 className="text-sm font-medium mb-2 text-muted-foreground">
            Category Size
          </h3>
          <ValidationBadge videoCount={metrics.uniqueVideoCount} />
        </div>

        <Separator />

        {/* Metrics section */}
        <Card>
          <CardContent className="pt-4 space-y-2">
            <h3 className="text-sm font-medium">Metrics</h3>
            <p className="text-sm">
              <span className="font-medium">
                {metrics.uniqueVideoCount.toLocaleString()}
              </span>{' '}
              unique videos from{' '}
              <span className="font-medium">
                {metrics.sourcePlaylistBreakdown.length}
              </span>{' '}
              playlist{metrics.sourcePlaylistBreakdown.length !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-muted-foreground">({breakdownText})</p>
            {metrics.duplicateVideoCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {metrics.duplicateVideoCount.toLocaleString()} duplicate
                {metrics.duplicateVideoCount !== 1 ? 's' : ''} removed
              </p>
            )}
          </CardContent>
        </Card>

        {/* Manual adjustments section - only for pending proposals */}
        {isPending && (
          <>
            <Separator />
            <ManualAdjustments
              proposalId={proposal.id}
              currentPlaylistIds={currentPlaylistIds}
              allPlaylists={allPlaylists}
              sourcePlaylists={metrics.sourcePlaylistBreakdown.map((s) => ({
                playlistId: s.playlistId,
                playlistTitle: s.playlistTitle,
              }))}
              onUpdate={handleAdjustmentUpdate}
              onSplitClick={() => setSplitWizardOpen(true)}
            />
          </>
        )}

        <Separator />

        {/* Video list */}
        <div>
          <h3 className="text-sm font-medium mb-2 text-muted-foreground">
            Videos
          </h3>
          <VideoListPaginated
            videos={videos}
            sourcePlaylists={sourcePlaylists}
          />
        </div>

        <Separator />

        {/* Proposal actions at bottom */}
        <ProposalActions
          proposalId={proposal.id}
          status={proposal.status}
          videoCount={metrics.uniqueVideoCount}
          categoryName={proposal.categoryName}
          playlistNames={proposal.playlists.map((p) => p.title)}
          onStatusChange={onStatusChange}
        />
      </div>

      {/* Split wizard dialog */}
      {isPending && (
        <SplitWizard
          proposal={proposal}
          open={splitWizardOpen}
          onOpenChange={setSplitWizardOpen}
          onComplete={handleAdjustmentUpdate}
        />
      )}
    </ScrollArea>
  )
}
