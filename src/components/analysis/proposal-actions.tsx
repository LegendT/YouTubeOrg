'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, X, RotateCcw } from 'lucide-react'
import { approveProposal, rejectProposal, resetProposal } from '@/app/actions/analysis'
import type { ProposalStatus } from '@/types/analysis'

interface ProposalActionsProps {
  proposalId: number
  status: ProposalStatus
  videoCount: number
  categoryName: string
  playlistNames: string[]
  onStatusChange?: () => void
}

const statusBadgeStyles: Record<ProposalStatus, string> = {
  pending: 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-100',
  approved: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100',
  rejected: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100',
}

export function ProposalActions({
  proposalId,
  status,
  videoCount,
  categoryName,
  playlistNames,
  onStatusChange,
}: ProposalActionsProps) {
  const [isPending, startTransition] = useTransition()

  function handleApprove() {
    startTransition(async () => {
      await approveProposal(proposalId)
      onStatusChange?.()
    })
  }

  function handleReject() {
    startTransition(async () => {
      await rejectProposal(proposalId)
      onStatusChange?.()
    })
  }

  function handleReset() {
    startTransition(async () => {
      await resetProposal(proposalId)
      onStatusChange?.()
    })
  }

  // Build natural language summary
  const playlistList =
    playlistNames.length <= 2
      ? playlistNames.map((n) => `'${n}'`).join(' and ')
      : playlistNames
          .slice(0, -1)
          .map((n) => `'${n}'`)
          .join(', ') + `, and '${playlistNames[playlistNames.length - 1]}'`

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        This category combines {playlistList} into &apos;{categoryName}&apos;
      </p>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleApprove}
          disabled={isPending || status === 'approved' || videoCount > 4500}
          className="gap-1"
        >
          <Check className="h-4 w-4" />
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleReject}
          disabled={isPending || status === 'rejected'}
          className="gap-1"
        >
          <X className="h-4 w-4" />
          Reject
        </Button>
        {status !== 'pending' && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleReset}
            disabled={isPending}
            className="gap-1"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        )}
        <Badge className={statusBadgeStyles[status]}>
          {status}
        </Badge>
      </div>
    </div>
  )
}
