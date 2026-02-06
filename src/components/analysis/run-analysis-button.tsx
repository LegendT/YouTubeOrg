'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { runAnalysis } from '@/app/actions/analysis'
import { useRouter } from 'next/navigation'
import { Play, ChevronDown } from 'lucide-react'
import type { AlgorithmMode } from '@/types/analysis'

interface RunAnalysisButtonProps {
  hasExistingProposals: boolean
}

export function RunAnalysisButton({
  hasExistingProposals,
}: RunAnalysisButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<AlgorithmMode>('aggressive')
  const [showModeMenu, setShowModeMenu] = useState(false)
  const router = useRouter()

  async function handleRun() {
    setIsLoading(true)
    setError(null)
    try {
      const result = await runAnalysis(mode)
      if (!result.success) {
        setError(result.errors?.join(', ') ?? 'Unknown error')
      }
      router.refresh()
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to run analysis'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-1">
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => setShowModeMenu((v) => !v)}
            disabled={isLoading}
          >
            {mode === 'aggressive' ? 'Aggressive' : 'Conservative'}
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
          {showModeMenu && (
            <div className="absolute right-0 top-full mt-1 z-50 rounded-md border bg-popover p-1 shadow-md">
              <button
                className={`block w-full text-left rounded-sm px-3 py-1.5 text-sm hover:bg-accent ${
                  mode === 'aggressive' ? 'bg-accent' : ''
                }`}
                onClick={() => {
                  setMode('aggressive')
                  setShowModeMenu(false)
                }}
              >
                Aggressive
                <span className="block text-xs text-muted-foreground">
                  Fewer categories, more merging
                </span>
              </button>
              <button
                className={`block w-full text-left rounded-sm px-3 py-1.5 text-sm hover:bg-accent ${
                  mode === 'conservative' ? 'bg-accent' : ''
                }`}
                onClick={() => {
                  setMode('conservative')
                  setShowModeMenu(false)
                }}
              >
                Conservative
                <span className="block text-xs text-muted-foreground">
                  More categories, less merging
                </span>
              </button>
            </div>
          )}
        </div>
        <Button onClick={handleRun} disabled={isLoading}>
          <Play className="h-4 w-4 mr-2" />
          {isLoading
            ? 'Analyzing...'
            : hasExistingProposals
              ? 'Re-analyze'
              : 'Run Analysis'}
        </Button>
      </div>
      {error && (
        <p className="text-sm text-red-500 max-w-md text-right">{error}</p>
      )}
    </div>
  )
}
