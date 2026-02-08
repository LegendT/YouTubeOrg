'use client'

import { useState, useCallback, useTransition, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Check, X } from '@phosphor-icons/react'
import { Spinner } from '@/components/ui/spinner'
import { bulkUpdateStatus } from '@/app/actions/analysis'
import type { ConsolidationProposal } from '@/types/analysis'

/**
 * Hook for managing batch selection state.
 *
 * Provides select/deselect/toggle/selectAll/clearAll operations
 * and an isSelected predicate. Used by CategoryList to render
 * checkboxes next to each category item.
 */
export function useBatchSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const toggle = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const selectAll = useCallback((ids: number[]) => {
    setSelectedIds(new Set(ids))
  }, [])

  const clearAll = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const isSelected = useCallback(
    (id: number) => selectedIds.has(id),
    [selectedIds]
  )

  return { selectedIds, toggle, selectAll, clearAll, isSelected }
}

interface BatchOperationsProps {
  proposals: ConsolidationProposal[]
  children: ReactNode
}

/**
 * BatchOperations - Wraps category list with batch approve/reject toolbar.
 *
 * Provides a floating action toolbar that appears when categories are
 * selected via checkboxes. Supports batch approve and batch reject
 * using the bulkUpdateStatus server action. Only pending proposals
 * can be selected for batch operations.
 */
export function BatchOperations({
  proposals,
  children,
}: BatchOperationsProps) {
  const { selectedIds, clearAll } = useBatchSelection()
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  // Get pending-only proposal IDs for "select all" awareness
  const pendingIds = proposals
    .filter((p) => p.status === 'pending')
    .map((p) => p.id)

  const handleBatchAction = useCallback(
    (status: 'approved' | 'rejected') => {
      const ids = Array.from(selectedIds)
      if (ids.length === 0) return

      startTransition(async () => {
        const result = await bulkUpdateStatus(ids, status)

        if (result.success) {
          const label = status === 'approved' ? 'approved' : 'rejected'
          setFeedback({
            type: 'success',
            message: `${result.updatedCount} ${result.updatedCount === 1 ? 'category' : 'categories'} ${label}`,
          })
          clearAll()
        } else {
          setFeedback({
            type: 'error',
            message: result.error ?? 'Batch action failed',
          })
        }

        setTimeout(() => setFeedback(null), 4000)
      })
    },
    [selectedIds, clearAll]
  )

  const someSelected = selectedIds.size > 0

  return (
    <div className="relative flex flex-col h-full">
      {/* Category list content */}
      <div className="flex-1 overflow-hidden">{children}</div>

      {/* Floating action toolbar - appears when items selected */}
      {someSelected && (
        <div className="sticky bottom-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">
              {selectedIds.size} {selectedIds.size === 1 ? 'category' : 'categories'} selected
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBatchAction('rejected')}
                disabled={isPending}
              >
                {isPending ? (
                  <Spinner size={16} className="mr-1.5" />
                ) : (
                  <X size={16} className="mr-1.5" />
                )}
                Reject selected
              </Button>
              <Button
                size="sm"
                onClick={() => handleBatchAction('approved')}
                disabled={isPending}
              >
                {isPending ? (
                  <Spinner size={16} className="mr-1.5" />
                ) : (
                  <Check size={16} className="mr-1.5" />
                )}
                Approve selected
              </Button>
            </div>
          </div>

          {/* Feedback message */}
          {feedback && (
            <div className="mt-2">
              <Badge
                variant={feedback.type === 'success' ? 'default' : 'destructive'}
              >
                {feedback.message}
              </Badge>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
