'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, X, AlertTriangle } from 'lucide-react'
import { approveProposal, rejectProposal } from '@/app/actions/analysis'
import type { ConsolidationProposal } from '@/types/analysis'

interface ConsolidationProposalTableProps {
  proposals: ConsolidationProposal[]
}

export function ConsolidationProposalTable({
  proposals,
}: ConsolidationProposalTableProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleApprove = (proposalId: number) => {
    startTransition(async () => {
      const result = await approveProposal(proposalId)
      if (result.success) {
        router.refresh()
      }
    })
  }

  const handleReject = (proposalId: number) => {
    startTransition(async () => {
      const result = await rejectProposal(proposalId)
      if (result.success) {
        router.refresh()
      }
    })
  }

  const getStatusVariant = (
    status: string
  ): 'default' | 'secondary' | 'outline' => {
    switch (status) {
      case 'approved':
        return 'default'
      case 'rejected':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const VIDEO_LIMIT = 4500
  const VIDEO_WARNING_THRESHOLD = 4000

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[250px]">Proposed Category</TableHead>
            <TableHead>Source Playlists</TableHead>
            <TableHead className="text-right">Total Videos</TableHead>
            <TableHead className="w-[100px]">Confidence</TableHead>
            <TableHead className="w-[100px]">Status</TableHead>
            <TableHead className="w-[180px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {proposals.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="h-24 text-center text-muted-foreground"
              >
                No proposals to display.
              </TableCell>
            </TableRow>
          ) : (
            proposals.map((proposal) => {
              const isOverLimit = proposal.totalVideos > VIDEO_LIMIT
              const isNearLimit =
                proposal.totalVideos > VIDEO_WARNING_THRESHOLD &&
                proposal.totalVideos <= VIDEO_LIMIT

              return (
                <TableRow key={proposal.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>{proposal.categoryName}</span>
                      {isOverLimit && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Over Limit
                        </Badge>
                      )}
                      {isNearLimit && (
                        <Badge variant="secondary" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Near Limit
                        </Badge>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="text-sm text-muted-foreground">
                      {proposal.playlists
                        .slice(0, 3)
                        .map((p) => p.title)
                        .join(', ')}
                      {proposal.playlists.length > 3 && (
                        <span className="ml-1 font-medium">
                          +{proposal.playlists.length - 3} more
                        </span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="text-right tabular-nums">
                    {proposal.totalVideos.toLocaleString()}
                  </TableCell>

                  <TableCell>
                    {proposal.confidenceScore != null && (
                      <Badge
                        variant={
                          proposal.confidenceScore >= 70
                            ? 'default'
                            : proposal.confidenceScore >= 40
                              ? 'secondary'
                              : 'outline'
                        }
                      >
                        {proposal.confidenceScore}%
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell>
                    <Badge variant={getStatusVariant(proposal.status)}>
                      {proposal.status}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(proposal.id)}
                        disabled={
                          isOverLimit ||
                          proposal.status === 'approved' ||
                          isPending
                        }
                        title={
                          isOverLimit
                            ? `Cannot approve: ${proposal.totalVideos.toLocaleString()} videos exceeds ${VIDEO_LIMIT.toLocaleString()} limit`
                            : 'Approve this consolidation proposal'
                        }
                      >
                        <Check className="h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(proposal.id)}
                        disabled={
                          proposal.status === 'rejected' || isPending
                        }
                        title="Reject this consolidation proposal"
                      >
                        <X className="h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
