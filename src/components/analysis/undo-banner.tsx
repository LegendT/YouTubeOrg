'use client'

import { useState, useEffect } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { Button } from '@/components/ui/button'
import { ArrowCounterClockwise } from '@phosphor-icons/react'
import { Spinner } from '@/components/ui/spinner'
import type { UndoEntry } from '@/lib/categories/undo-stack'

interface UndoBannerProps {
  canUndo: boolean
  latest: UndoEntry | null
  onUndo: () => void
  isUndoing: boolean
  /** TTL in milliseconds, used to calculate countdown. Defaults to 30000. */
  ttlMs?: number
}

/**
 * Floating undo notification banner.
 *
 * Appears at the bottom-center of the viewport when undo entries exist.
 * Shows the latest undo entry label, a countdown timer, and an Undo button.
 * Supports Cmd/Ctrl+Z keyboard shortcut (only when no dialog is open).
 */
export function UndoBanner({
  canUndo,
  latest,
  onUndo,
  isUndoing,
  ttlMs = 30_000,
}: UndoBannerProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(0)

  // Calculate countdown from latest entry timestamp
  useEffect(() => {
    if (!latest) {
      setSecondsRemaining(0)
      return
    }

    const updateCountdown = () => {
      const elapsed = Date.now() - latest.timestamp
      const remaining = Math.max(0, Math.ceil((ttlMs - elapsed) / 1000))
      setSecondsRemaining(remaining)
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)
    return () => clearInterval(interval)
  }, [latest, ttlMs])

  // Cmd/Ctrl+Z keyboard shortcut
  useHotkeys(
    'mod+z',
    (e) => {
      // Don't trigger undo if a dialog is open
      if (document.querySelector('[role="dialog"]')) return
      e.preventDefault()
      onUndo()
    },
    { enabled: canUndo && !isUndoing, enableOnFormTags: false },
    [canUndo, isUndoing, onUndo]
  )

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-lg border bg-background px-4 py-3 shadow-lg transition-all duration-200 ${
        canUndo
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
      role="status"
      aria-live="polite"
    >
      {latest && (
        <>
          <span className="text-sm">{latest.label}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {secondsRemaining}s
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={onUndo}
            disabled={isUndoing}
          >
            {isUndoing ? (
              <Spinner size={16} />
            ) : (
              <ArrowCounterClockwise size={16} />
            )}
            Undo
          </Button>
        </>
      )}
    </div>
  )
}
