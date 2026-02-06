'use client'

import { Button } from '@/components/ui/button'
import type { AlgorithmMode } from '@/types/analysis'

interface AlgorithmModeToggleProps {
  currentMode: AlgorithmMode
  onModeChange: (mode: AlgorithmMode) => void
  disabled?: boolean
}

const MODE_DESCRIPTIONS: Record<AlgorithmMode, string> = {
  conservative: 'Fewer merges, higher confidence threshold (~35 categories)',
  aggressive: 'More merges, lower threshold (~25 categories)',
}

/**
 * Segmented control for switching between Conservative and Aggressive
 * algorithm modes. Parent is responsible for triggering re-analysis
 * when the mode changes.
 */
export function AlgorithmModeToggle({
  currentMode,
  onModeChange,
  disabled = false,
}: AlgorithmModeToggleProps) {
  return (
    <div className="space-y-1.5">
      <div className="inline-flex rounded-md border">
        <Button
          variant={currentMode === 'conservative' ? 'default' : 'outline'}
          size="sm"
          className="rounded-r-none border-0"
          onClick={() => onModeChange('conservative')}
          disabled={disabled}
        >
          Conservative
        </Button>
        <Button
          variant={currentMode === 'aggressive' ? 'default' : 'outline'}
          size="sm"
          className="rounded-l-none border-0"
          onClick={() => onModeChange('aggressive')}
          disabled={disabled}
        >
          Aggressive
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {MODE_DESCRIPTIONS[currentMode]}
      </p>
    </div>
  )
}
