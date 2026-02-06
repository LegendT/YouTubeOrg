import { ConsolidationProposalTable } from '@/components/analysis/proposal-table'
import { DuplicateReport } from '@/components/analysis/duplicate-report'
import { GenerateProposalButton } from '@/components/analysis/generate-button'
import {
  getProposals,
  getDuplicateStats,
  getAnalysisSummary,
} from '@/app/actions/analysis'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default async function AnalysisPage() {
  const [proposalsResult, statsResult, summary] = await Promise.all([
    getProposals(),
    getDuplicateStats(),
    getAnalysisSummary(),
  ])

  const proposals = proposalsResult.proposals
  const duplicateStats = statsResult.stats

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Playlist Analysis & Consolidation
          </h1>
          <p className="text-muted-foreground mt-2">
            {summary.totalPlaylists > 0
              ? `Analyze your ${summary.totalPlaylists} playlists and propose a consolidated category structure`
              : 'Sync your playlists first, then analyze and consolidate them into categories'}
          </p>
        </div>
        <GenerateProposalButton />
      </div>

      {/* Summary cards */}
      {summary.proposedCategories > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Proposed Categories</CardDescription>
              <CardTitle className="text-2xl">
                {summary.proposedCategories}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                From {summary.totalPlaylists} playlists
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Reviewed</CardDescription>
              <CardTitle className="text-2xl">
                {summary.reviewedCount}/{summary.proposedCategories}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {summary.pendingCount} pending review
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Approved</CardDescription>
              <CardTitle className="text-2xl text-green-600">
                {summary.approvedCount}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Categories confirmed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Duplicates Found</CardDescription>
              <CardTitle className="text-2xl">
                {summary.duplicatesFound}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Videos in multiple playlists
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Duplicate statistics */}
      {duplicateStats && duplicateStats.totalUniqueVideos > 0 && (
        <DuplicateReport stats={duplicateStats} />
      )}

      {/* Proposal table or empty state */}
      {proposals.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Proposed Consolidations
              </h2>
              <p className="text-sm text-muted-foreground">
                Review and approve proposed category consolidations below.
                Categories over 4,500 videos cannot be approved.
              </p>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline">{summary.pendingCount} pending</Badge>
              <Badge variant="default">{summary.approvedCount} approved</Badge>
              <Badge variant="secondary">
                {summary.rejectedCount} rejected
              </Badge>
            </div>
          </div>
          <ConsolidationProposalTable proposals={proposals} />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-muted-foreground space-y-2">
            <p className="text-lg font-medium">
              No consolidation proposals yet
            </p>
            <p className="text-sm">
              Click &quot;Generate Consolidation Proposal&quot; to analyze your
              playlists and create category recommendations.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
