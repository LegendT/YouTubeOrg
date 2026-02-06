'use client'

import { useHotkeys } from 'react-hotkeys-hook'
import { useState, useCallback } from 'react'

interface UseCategoryKeyboardNavOptions {
  categories: Array<{ id: number }>
  onSelect: (id: number) => void
  enabled?: boolean
}

/**
 * Keyboard navigation hook for the category list.
 *
 * Supports:
 * - Arrow Up / k: Move focus to previous category
 * - Arrow Down / j: Move focus to next category
 * - Enter: Select the focused category
 *
 * Returns focusedIndex for visual highlighting and focusedId for the
 * currently focused category. CategoryList uses focusedIndex to apply
 * a focus ring to the highlighted item.
 */
export function useCategoryKeyboardNav({
  categories,
  onSelect,
  enabled = true,
}: UseCategoryKeyboardNavOptions) {
  const [focusedIndex, setFocusedIndex] = useState(0)

  // Up arrow / k: Move focus up
  useHotkeys(
    'up, k',
    (e) => {
      e.preventDefault()
      setFocusedIndex((prev) => Math.max(0, prev - 1))
    },
    { enabled }
  )

  // Down arrow / j: Move focus down
  useHotkeys(
    'down, j',
    (e) => {
      e.preventDefault()
      setFocusedIndex((prev) => Math.min(categories.length - 1, prev + 1))
    },
    { enabled }
  )

  // Enter: Select focused category
  useHotkeys(
    'enter',
    (e) => {
      e.preventDefault()
      if (categories[focusedIndex]) {
        onSelect(categories[focusedIndex].id)
      }
    },
    { enabled }
  )

  const resetFocus = useCallback(() => {
    setFocusedIndex(0)
  }, [])

  return {
    focusedIndex,
    setFocusedIndex,
    focusedId: categories[focusedIndex]?.id ?? null,
    resetFocus,
  }
}

/** Keyboard shortcut hints for contextual display in the UI. */
export const KEYBOARD_HINTS = [
  { key: 'Arrow Up / k', action: 'Previous category' },
  { key: 'Arrow Down / j', action: 'Next category' },
  { key: 'Enter', action: 'Select category' },
] as const
