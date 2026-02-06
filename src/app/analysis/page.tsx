import { AnalysisDashboard } from '@/components/analysis/analysis-dashboard'
import { DuplicateReport } from '@/components/analysis/duplicate-report'
import { RunAnalysisButton } from '@/components/analysis/run-analysis-button'
import {
  getProposals,
  getDuplicateStats,
  getAnalysisSummary,
  checkStaleness,
} from '@/app/actions/analysis'
import { AlertTriangle } from 'lucide-react'

export default async function AnalysisPage() {
  const [proposalsResult, statsResult, summary, staleness] = await Promise.all([
    getProposals(),
    getDuplicateStats(),
    getAnalysisSummary(),
    checkStaleness(),
  ])

  const proposals = proposalsResult.proposals
  const duplicateStats = statsResult.stats
  const hasProposals = proposals.length > 0

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Playlist Analysis &amp; Consolidation
          </h1>
          <p className="text-muted-foreground mt-2">
            {summary.totalPlaylists > 0
              ? `Analyze your ${summary.totalPlaylists} playlists and propose a consolidated category structure`
              : 'Sync your playlists first, then analyze and consolidate them into categories'}
          </p>
        </div>
        <RunAnalysisButton hasExistingProposals={hasProposals} />
      </div>

      {/* Staleness warning */}
      {staleness.isStale && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">{staleness.message}</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              Click &quot;Re-analyze&quot; to update proposals with latest playlist data.
            </p>
          </div>
        </div>
      )}

      {/* Dashboard or empty state */}
      {hasProposals ? (
        <AnalysisDashboard proposals={proposals} summary={summary} />
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-muted-foreground space-y-2">
            <p className="text-lg font-medium">
              No consolidation proposals yet
            </p>
            <p className="text-sm">
              Click &quot;Run Analysis&quot; to analyze your playlists and create
              category recommendations.
            </p>
          </div>
        </div>
      )}

      {/* Duplicate statistics below dashboard */}
      {duplicateStats && duplicateStats.totalUniqueVideos > 0 && (
        <DuplicateReport stats={duplicateStats} />
      )}
    </div>
  )
}
