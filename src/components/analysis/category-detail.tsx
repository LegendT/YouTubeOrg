'use client'

import { useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConfidenceBadge } from './confidence-badge'
import { ValidationBadge } from './validation-badge'
import { VideoListPaginated } from './video-list-paginated'
import { ProposalActions } from './proposal-actions'
import { SplitWizard } from './split-wizard'
import { ManualAdjustments } from './manual-adjustments'
import { Pencil, Trash2, Plus } from 'lucide-react'
import type {
  ConsolidationProposal,
  CategoryMetrics,
  VideoDetail,
} from '@/types/analysis'
import type { CategoryListItem, VideoSearchResult } from '@/types/categories'

interface CategoryDetailProps {
  proposal: ConsolidationProposal
  metrics: CategoryMetrics
  videos: VideoDetail[]
  allPlaylists: Array<{ id: number; title: string; itemCount: number }>
  onStatusChange?: () => void
  // Management mode props
  managementMode?: boolean
  category?: CategoryListItem
  managementVideos?: VideoSearchResult[]
  onRename?: (id: number, name: string) => void
  onDelete?: (id: number, name: string, videoCount: number) => void
  onAssignVideos?: (id: number, name: string, videoCount: number) => void
}

// Parse ISO 8601 duration to readable format
function formatDuration(duration: string | null): string {
  if (!duration) return ''
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return ''
  const h = parseInt(match[1] || '0', 10)
  const m = parseInt(match[2] || '0', 10)
  const s = parseInt(match[3] || '0', 10)
  if (h > 0)
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

// Format relative date
function formatRelativeDate(date?: Date | string): string {
  if (!date) return '--'
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays < 1) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 30) return `${diffDays} days ago`
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    return `${months} month${months > 1 ? 's' : ''} ago`
  }
  const years = Math.floor(diffDays / 365)
  return `${years} year${years > 1 ? 's' : ''} ago`
}

export function CategoryDetail({
  proposal,
  metrics,
  videos,
  allPlaylists,
  onStatusChange,
  managementMode = false,
  category,
  managementVideos,
  onRename,
  onDelete,
  onAssignVideos,
}: CategoryDetailProps) {
  const [splitWizardOpen, setSplitWizardOpen] = useState(false)

  // ====================================================================
  // MANAGEMENT MODE
  // ====================================================================
  if (managementMode && category) {
    // Map VideoSearchResult to VideoDetail for VideoListPaginated
    const mappedVideos: VideoDetail[] = (managementVideos ?? []).map((v) => ({
      id: v.id,
      youtubeId: v.youtubeId,
      title: v.title,
      thumbnailUrl: v.thumbnailUrl ?? undefined,
      duration: v.duration ?? undefined,
      channelName: v.channelTitle ?? undefined,
      sourcePlaylistId: 0,
      sourcePlaylistTitle: v.categoryNames.join(', '),
    }))

    return (
      <ScrollArea className="h-full">
        <div className="p-4 space-y-4">
          {/* Category name */}
          <h2 className="text-xl font-semibold tracking-tight">
            {category.name}
          </h2>

          <Separator />

          {/* Metrics card */}
          <Card>
            <CardContent className="pt-4 space-y-2">
              <h3 className="text-sm font-medium">Category Info</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Videos</span>
                  <p className="font-semibold text-lg">
                    {category.videoCount.toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">
                    Source Playlists
                  </span>
                  <p className="font-semibold text-lg">
                    {category.sourcePlaylistNames.length}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Last Updated</span>
                  <p className="font-semibold text-sm mt-1">
                    {formatRelativeDate(category.updatedAt)}
                  </p>
                </div>
              </div>
              {category.sourcePlaylistNames.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-1">
                    Source playlists:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {category.sourcePlaylistNames.map((name) => (
                      <Badge
                        key={name}
                        variant="outline"
                        className="text-xs"
                      >
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {category.isProtected && (
                <div className="pt-2 border-t">
                  <Badge variant="secondary" className="text-xs">
                    Protected category
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          <Separator />

          {/* Management action buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onRename?.(category.id, category.name)
              }
              disabled={category.isProtected}
            >
              <Pencil className="h-4 w-4 mr-1.5" />
              Rename
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() =>
                onDelete?.(
                  category.id,
                  category.name,
                  category.videoCount
                )
              }
              disabled={category.isProtected}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Delete
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onAssignVideos?.(
                  category.id,
                  category.name,
                  category.videoCount
                )
              }
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Assign Videos
            </Button>
          </div>

          <Separator />

          {/* Video list */}
          <div>
            <h3 className="text-sm font-medium mb-2 text-muted-foreground">
              Videos ({(managementVideos ?? []).length})
            </h3>
            {mappedVideos.length > 0 ? (
              <VideoListPaginated
                videos={mappedVideos}
                sourcePlaylists={[]}
              />
            ) : (
              <p className="text-sm text-muted-foreground py-4">
                No videos in this category.
              </p>
            )}
          </div>
        </div>
      </ScrollArea>
    )
  }

  // ====================================================================
  // ANALYSIS MODE (existing, unchanged)
  // ====================================================================

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
