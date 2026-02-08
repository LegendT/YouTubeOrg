'use client'

import { useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

interface ShortcutEntry {
  keys: string[]
  action: string
}

interface ShortcutGroup {
  title: string
  shortcuts: ShortcutEntry[]
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: 'Global',
    shortcuts: [
      { keys: ['?'], action: 'Show keyboard shortcuts' },
    ],
  },
  {
    title: 'Analysis Page',
    shortcuts: [
      { keys: ['j', '\u2193'], action: 'Next category' },
      { keys: ['k', '\u2191'], action: 'Previous category' },
      { keys: ['Enter'], action: 'Open selected category' },
    ],
  },
  {
    title: 'ML Review Page',
    shortcuts: [
      { keys: ['Tab'], action: 'Next in grid' },
      { keys: ['Shift', 'Tab'], action: 'Previous in grid' },
      { keys: ['Enter'], action: 'Open review modal' },
      { keys: ['a'], action: 'Accept suggestion' },
      { keys: ['r'], action: 'Reject suggestion' },
      { keys: ['\u2190'], action: 'Previous in modal' },
      { keys: ['\u2192'], action: 'Next in modal' },
    ],
  },
  {
    title: 'Videos Page',
    shortcuts: [
      { keys: ['\u2318 / Ctrl', 'Z'], action: 'Undo last action' },
    ],
  },
]

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="bg-muted border border-border rounded px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
      {children}
    </kbd>
  )
}

export function KeyboardShortcutsOverlay() {
  const [open, setOpen] = useState(false)

  useHotkeys(
    'shift+/',
    (e) => {
      e.preventDefault()
      setOpen(true)
    },
    {
      enableOnFormTags: false,
      enableOnContentEditable: false,
    }
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Navigate faster with keyboard shortcuts across all pages.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
          {shortcutGroups.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold text-foreground mb-2">
                {group.title}
              </h3>
              <div className="space-y-1.5">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.action}
                    className="flex items-center justify-between gap-4"
                  >
                    <span className="text-sm text-muted-foreground">
                      {shortcut.action}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {shortcut.keys.map((key, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {i > 0 && (
                            <span className="text-xs text-muted-foreground">
                              +
                            </span>
                          )}
                          <Kbd>{key}</Kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
