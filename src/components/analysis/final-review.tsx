'use client'

import { useState, useMemo, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle,
  AlertTriangle,
  Loader2,
  ArrowRight,
  ArrowDown,
} from 'lucide-react'
import { finalizeConsolidation } from '@/app/actions/analysis'
import type { ConsolidationProposal, AnalysisSummary } from '@/types/analysis'

interface FinalReviewProps {
  proposals: ConsolidationProposal[]
  summary: AnalysisSummary
  open: boolean
  onOpenChange: (open: boolean) => void
  onExecute: () => void
}

/**
 * Pre-execution comprehensive review screen.
 *
 * Shows summary statistics, detailed change list, before/after impact
 * visualization, and the "Execute consolidation" button. Displayed as
 * a large dialog before finalizing the consolidation structure.
 */
export function FinalReview({
  proposals,
  summary,
  open,
  onOpenChange,
  onExecute,
}: FinalReviewProps) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const approved = useMemo(
    () => proposals.filter((p) => p.status === 'approved'),
    [proposals]
  )

  const rejected = useMemo(
    () => proposals.filter((p) => p.status === 'rejected'),
    [proposals]
  )

  const pending = useMemo(
    () => proposals.filter((p) => p.status === 'pending'),
    [proposals]
  )

  // Total playlists being merged across approved proposals
  const totalPlaylistsMerged = useMemo(
    () => approved.reduce((sum, p) => sum + p.playlists.length, 0),
    [approved]
  )

  // Net consolidation percentage
  const consolidationPercent =
    summary.totalPlaylists > 0
      ? Math.round(
          ((summary.totalPlaylists - approved.length) /
            summary.totalPlaylists) *
            100
        )
      : 0

  const handleExecute = () => {
    startTransition(async () => {
      const res = await finalizeConsolidation()
      if (res.success) {
        setResult({
          type: 'success',
          message: `Consolidation structure saved. ${res.categoryCount} categories ready for Phase 3.`,
        })
        // Delay so user can see success message
        setTimeout(() => {
          onExecute()
        }, 2000)
      } else {
        setResult({
          type: 'error',
          message: res.errors?.join(', ') ?? 'Failed to finalize',
        })
      }
    })
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isPending) {
      onOpenChange(nextOpen)
      if (!nextOpen) {
        setResult(null)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Final Review &amp; Execute
          </DialogTitle>
          <DialogDescription>
            Review the consolidation plan before executing. This locks in the
            approved structure as final.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 pb-4">
            {/* Section 1: Summary Statistics */}
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Summary
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <div className="text-2xl font-bold">{approved.length}</div>
                  <div className="text-xs text-muted-foreground">
                    categories to create
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-2xl font-bold">
                    {totalPlaylistsMerged}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    playlists to merge
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-2xl font-bold">
                    {summary.duplicatesFound}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    duplicates to remove
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-sm space-y-0.5">
                    <div className="text-green-600 font-medium">
                      {approved.length} approved
                    </div>
                    <div className="text-red-600 font-medium">
                      {rejected.length} rejected
                    </div>
                    <div className="text-muted-foreground">
                      {pending.length} pending
                    </div>
                  </div>
                </div>
              </div>

              {pending.length > 0 && (
                <div className="flex items-center gap-2 mt-3 text-sm text-amber-600">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    Note: {pending.length} categor{pending.length === 1 ? 'y is' : 'ies are'} still pending review
                  </span>
                </div>
              )}
            </div>

            <Separator />

            {/* Section 2: Detailed Change List */}
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Detailed Changes
              </h3>
              <div className="space-y-2">
                {approved.map((proposal) => (
                  <div
                    key={proposal.id}
                    className="rounded-md border p-3 space-y-1"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                      <span className="font-medium text-sm">
                        {proposal.categoryName}
                      </span>
                      <Badge variant="secondary" className="text-xs ml-auto">
                        {proposal.totalVideos} videos
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground pl-6 flex-wrap">
                      {proposal.playlists.map((pl, i) => (
                        <span key={pl.id} className="flex items-center gap-1">
                          {i > 0 && <span className="text-muted-foreground">+</span>}
                          <span>{pl.title}</span>
                        </span>
                      ))}
                      <ArrowRight className="h-3 w-3 mx-1 shrink-0" />
                      <span className="font-medium text-foreground">
                        {proposal.totalVideos} unique videos
                      </span>
                    </div>
                  </div>
                ))}

                {rejected.length > 0 && (
                  <>
                    <div className="text-xs font-medium text-muted-foreground mt-4 mb-2 uppercase tracking-wider">
                      Rejected ({rejected.length})
                    </div>
                    {rejected.map((proposal) => (
                      <div
                        key={proposal.id}
                        className="rounded-md border border-dashed p-3 opacity-50 line-through"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm">
                            {proposal.categoryName}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-xs ml-auto"
                          >
                            {proposal.totalVideos} videos
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {approved.length === 0 && (
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    No approved categories to execute
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Section 3: Impact Visualization */}
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Impact
              </h3>
              <div className="flex items-center gap-4 justify-center py-4">
                <div className="text-center">
                  <div className="text-3xl font-bold">
                    {summary.totalPlaylists}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    playlists (before)
                  </div>
                </div>
                <ArrowDown className="h-6 w-6 text-muted-foreground rotate-[-90deg]" />
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">
                    {approved.length}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    categories (after)
                  </div>
                </div>
              </div>
              <div className="text-center text-sm text-muted-foreground">
                Reducing from {summary.totalPlaylists} to {approved.length}{' '}
                playlists ({consolidationPercent}% consolidation)
              </div>
            </div>
          </div>
        </ScrollArea>

        <Separator />

        {/* Section 4: Execution */}
        <div className="pt-4 space-y-3">
          {result && (
            <div
              className={`flex items-center gap-2 text-sm rounded-md p-3 ${
                result.type === 'success'
                  ? 'bg-green-50 text-green-800 dark:bg-green-950/20 dark:text-green-200'
                  : 'bg-red-50 text-red-800 dark:bg-red-950/20 dark:text-red-200'
              }`}
            >
              {result.type === 'success' ? (
                <CheckCircle className="h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              )}
              <span>{result.message}</span>
            </div>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={handleExecute}
            disabled={approved.length === 0 || isPending || result?.type === 'success'}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Executing...
              </>
            ) : result?.type === 'success' ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Consolidation saved
              </>
            ) : (
              'Execute consolidation'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
