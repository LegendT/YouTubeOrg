'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export interface UndoEntry {
  id: string
  type: 'delete' | 'merge'
  label: string
  /** Closure that calls the server action with serializable snapshot data captured at push time. */
  undoAction: () => Promise<{ success: boolean; error?: string }>
  timestamp: number
}

/**
 * In-memory undo stack with auto-expiry.
 *
 * Stores undo entries with a configurable TTL (default 30s).
 * Entries auto-expire via a 5s polling interval.
 * The undoAction closure captures serializable snapshot data at push time
 * to avoid stale closure bugs (per RESEARCH pitfall #4).
 */
export function useUndoStack(maxSize = 10, ttlMs = 30_000) {
  const [stack, setStack] = useState<UndoEntry[]>([])
  const [isUndoing, setIsUndoing] = useState(false)
  const stackRef = useRef(stack)
  stackRef.current = stack

  const push = useCallback(
    (entry: Omit<UndoEntry, 'id' | 'timestamp'>) => {
      const newEntry: UndoEntry = {
        ...entry,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      }
      setStack((prev) => [newEntry, ...prev].slice(0, maxSize))
    },
    [maxSize]
  )

  const undo = useCallback(async () => {
    const current = stackRef.current
    if (current.length === 0) return { success: false, error: 'Nothing to undo' }

    const [latest, ...rest] = current
    setStack(rest)
    setIsUndoing(true)

    try {
      const result = await latest.undoAction()
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Undo failed'
      return { success: false, error: message }
    } finally {
      setIsUndoing(false)
    }
  }, [])

  // Auto-expire entries older than TTL
  useEffect(() => {
    const interval = setInterval(() => {
      setStack((prev) => {
        const now = Date.now()
        const filtered = prev.filter((entry) => now - entry.timestamp < ttlMs)
        // Only update state if something actually expired
        if (filtered.length === prev.length) return prev
        return filtered
      })
    }, 5_000)

    return () => clearInterval(interval)
  }, [ttlMs])

  return {
    stack,
    push,
    undo,
    canUndo: stack.length > 0,
    latest: stack[0] ?? null,
    isUndoing,
  }
}
