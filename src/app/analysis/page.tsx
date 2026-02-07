import { getServerSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { AnalysisDashboard } from '@/components/analysis/analysis-dashboard'
import { AnalysisRunner } from '@/components/analysis/analysis-loading'
import { RunAnalysisButton } from '@/components/analysis/run-analysis-button'
import {
  getProposals,
  getAnalysisSummary,
  checkStaleness,
  getAllPlaylistsForSelector,
  getLatestSession,
} from '@/app/actions/analysis'
import { getCategories } from '@/app/actions/categories'

export default async function AnalysisPage() {
  // Check authentication
  const authSession = await getServerSession()

  if (!authSession?.access_token || authSession?.error === 'RefreshAccessTokenError') {
    redirect('/api/auth/signin')
  }

  const [proposalsResult, summary, staleness, allPlaylists, session] =
    await Promise.all([
      getProposals(),
      getAnalysisSummary(),
      checkStaleness(),
      getAllPlaylistsForSelector(),
      getLatestSession(),
    ])

  const proposals = proposalsResult.proposals
  const hasProposals = proposals.length > 0

  // Detect if analysis has been finalized -> switch to management mode
  const managementMode = session?.finalizedAt != null
  const categories = managementMode ? await getCategories() : []

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {managementMode
              ? 'Category Management'
              : 'Playlist Analysis & Consolidation'}
          </h1>
          <p className="text-muted-foreground mt-2">
            {managementMode
              ? 'Manage your approved category structure'
              : summary.totalPlaylists > 0
                ? `Analyze your ${summary.totalPlaylists} playlists and propose a consolidated category structure`
                : 'Sync your playlists first, then analyze and consolidate them into categories'}
          </p>
        </div>
        {!managementMode && hasProposals && (
          <RunAnalysisButton hasExistingProposals={true} />
        )}
      </div>

      {/* Dashboard or empty state */}
      {hasProposals || managementMode ? (
        <AnalysisDashboard
          proposals={proposals}
          summary={summary}
          staleness={staleness}
          allPlaylists={allPlaylists}
          managementMode={managementMode}
          categories={categories}
        />
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="space-y-6 w-full max-w-md">
            <div className="text-muted-foreground space-y-2">
              <p className="text-lg font-medium">
                No consolidation proposals yet
              </p>
              <p className="text-sm">
                Choose an algorithm mode and run analysis to create
                category recommendations from your playlists.
              </p>
            </div>
            <AnalysisRunner
              currentMode={session?.mode ?? 'aggressive'}
              hasExistingProposals={false}
            />
          </div>
        </div>
      )}
    </div>
  )
}
