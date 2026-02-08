'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  MagnifyingGlass,
  GitBranch,
  ListChecks,
  CheckCircle,
  Warning,
} from '@phosphor-icons/react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { runAnalysis } from '@/app/actions/analysis'
import { useRouter } from 'next/navigation'
import { AlgorithmModeToggle } from './algorithm-mode-toggle'
import type { AlgorithmMode } from '@/types/analysis'

type LoadingStage = 'idle' | 'duplicates' | 'clustering' | 'proposals' | 'complete' | 'error'

interface AnalysisLoadingProps {
  stage: LoadingStage
  error?: string
  onRetry?: () => void
}

const STAGES: Array<{
  key: LoadingStage
  label: string
  step: string
  icon: typeof MagnifyingGlass
  progress: number
}> = [
  { key: 'duplicates', label: 'Detecting duplicates...', step: '1/3', icon: MagnifyingGlass, progress: 33 },
  { key: 'clustering', label: 'Clustering playlists...', step: '2/3', icon: GitBranch, progress: 66 },
  { key: 'proposals', label: 'Generating proposals...', step: '3/3', icon: ListChecks, progress: 100 },
]

/**
 * Staged loading state display during analysis generation.
 *
 * Shows progress through three stages: duplicate detection, clustering,
 * and proposal generation. Uses a timer-based approach since server
 * actions don't support streaming progress.
 */
export function AnalysisLoading({ stage, error, onRetry }: AnalysisLoadingProps) {
  if (stage === 'idle') {
    return null
  }

  if (stage === 'error') {
    return (
      <Card className="border-destructive/20 bg-destructive/10">
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <Warning className="h-8 w-8 text-destructive" weight="fill" />
          <div>
            <p className="text-sm font-medium text-destructive">
              Analysis Failed
            </p>
            <p className="text-xs text-destructive/80 mt-1">
              {error ?? 'An unexpected error occurred'}
            </p>
          </div>
          {onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry}>
              Retry Analysis
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  if (stage === 'complete') {
    return (
      <Card className="border-success/20 bg-success/10">
        <CardContent className="flex items-center gap-3 p-4">
          <CheckCircle className="h-5 w-5 text-success" weight="fill" />
          <p className="text-sm font-medium text-success">
            Analysis complete!
          </p>
        </CardContent>
      </Card>
    )
  }

  const currentStageInfo = STAGES.find((s) => s.key === stage) ?? STAGES[0]

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 p-6">
        <div className="flex items-center gap-3">
          <Spinner size={20} className="text-primary" />
          <div>
            <p className="text-sm font-medium">{currentStageInfo.label}</p>
            <p className="text-xs text-muted-foreground">
              Step {currentStageInfo.step}
            </p>
          </div>
        </div>

        <Progress value={currentStageInfo.progress} className="h-2 w-full max-w-xs" />

        <div className="flex items-center gap-6 text-xs text-muted-foreground">
          {STAGES.map((s) => {
            const StageIcon = s.icon
            const isActive = s.key === stage
            const stageIndex = STAGES.findIndex((x) => x.key === stage)
            const thisIndex = STAGES.indexOf(s)
            const isDone = thisIndex < stageIndex

            return (
              <div
                key={s.key}
                className={`flex items-center gap-1 ${
                  isActive
                    ? 'text-primary font-medium'
                    : isDone
                      ? 'text-success'
                      : ''
                }`}
              >
                {isDone ? (
                  <CheckCircle size={14} weight="fill" />
                ) : (
                  <StageIcon size={14} />
                )}
                <span>{s.step}</span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// === Stage progression timer ===

const STAGE_ORDER: LoadingStage[] = ['duplicates', 'clustering', 'proposals']
const STAGE_INTERVAL_MS = 2000

function useStageProgression(isRunning: boolean): LoadingStage {
  const [stage, setStage] = useState<LoadingStage>('idle')

  useEffect(() => {
    if (!isRunning) return

    setStage('duplicates')
    let index = 0

    const interval = setInterval(() => {
      index++
      if (index < STAGE_ORDER.length) {
        setStage(STAGE_ORDER[index])
      } else {
        clearInterval(interval)
      }
    }, STAGE_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [isRunning])

  useEffect(() => {
    if (!isRunning) {
      setStage('idle')
    }
  }, [isRunning])

  return stage
}

// === AnalysisRunner wrapper ===

interface AnalysisRunnerProps {
  currentMode?: AlgorithmMode
  onComplete?: () => void
  hasExistingProposals?: boolean
}

/**
 * Wraps the algorithm mode toggle and run button with loading state management.
 *
 * On click: sets loading, starts stage timer, calls runAnalysis server action.
 * On complete: shows success briefly, then calls onComplete.
 * On error: shows error with retry button.
 *
 * Note: The existing RunAnalysisButton (from 02-07) provides a simpler
 * inline alternative. AnalysisRunner adds staged loading feedback.
 */
export function AnalysisRunner({
  currentMode: initialMode,
  onComplete,
  hasExistingProposals = false,
}: AnalysisRunnerProps) {
  const [mode, setMode] = useState<AlgorithmMode>(initialMode ?? 'aggressive')
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showComplete, setShowComplete] = useState(false)
  const router = useRouter()

  const simulatedStage = useStageProgression(isRunning)

  const displayStage: LoadingStage = showComplete
    ? 'complete'
    : error
      ? 'error'
      : isRunning
        ? simulatedStage
        : 'idle'

  const handleRun = useCallback(async () => {
    setIsRunning(true)
    setError(null)
    setShowComplete(false)

    try {
      const result = await runAnalysis(mode)
      setIsRunning(false)

      if (!result.success) {
        setError(result.errors?.join(', ') ?? 'Unknown error')
        return
      }

      // Show success briefly before transitioning to results
      setShowComplete(true)
      setTimeout(() => {
        setShowComplete(false)
        router.refresh()
        onComplete?.()
      }, 1500)
    } catch (err) {
      setIsRunning(false)
      const msg = err instanceof Error ? err.message : 'Failed to run analysis'
      setError(msg)
    }
  }, [mode, router, onComplete])

  const handleRetry = useCallback(() => {
    setError(null)
    handleRun()
  }, [handleRun])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <AlgorithmModeToggle
          currentMode={mode}
          onModeChange={setMode}
          disabled={isRunning}
        />
        <Button
          onClick={handleRun}
          disabled={isRunning || showComplete}
        >
          {isRunning
            ? 'Analysing...'
            : hasExistingProposals
              ? 'Re-analyse'
              : 'Run Analysis'}
        </Button>
      </div>

      <AnalysisLoading
        stage={displayStage}
        error={error ?? undefined}
        onRetry={handleRetry}
      />
    </div>
  )
}
