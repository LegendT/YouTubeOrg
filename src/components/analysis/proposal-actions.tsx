'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, X, ArrowCounterClockwise } from '@phosphor-icons/react'
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
  pending: 'bg-muted text-muted-foreground border-border hover:bg-muted',
  approved: 'bg-success/10 text-success border-success/20 hover:bg-success/10',
  rejected: 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/10',
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
          <Check size={16} weight="bold" />
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleReject}
          disabled={isPending || status === 'rejected'}
          className="gap-1"
        >
          <X size={16} weight="bold" />
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
            <ArrowCounterClockwise size={16} />
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
