'use client';

import { CheckCircle, Circle } from '@phosphor-icons/react';
import { Spinner } from '@/components/ui/spinner';

interface EnrichProgress {
  processed: number;
  unavailable: number;
  skipped: number;
  currentBatch: number;
  totalBatches: number;
}

interface ImportProgressProps {
  stage: 'parsing' | 'enriching' | 'linking';
  enrichProgress: EnrichProgress | null;
  totalCount: number;
}

type StageStatus = 'completed' | 'current' | 'future';

interface PipelineStage {
  key: string;
  label: string;
}

const PIPELINE_STAGES: PipelineStage[] = [
  { key: 'parsing', label: 'Parsing CSV' },
  { key: 'enriching', label: 'Fetching Metadata' },
  { key: 'linking', label: 'Creating Relationships' },
];

/**
 * Determine the display status of a pipeline stage relative to the current stage.
 */
function getStageStatus(currentStage: string, stageKey: string): StageStatus {
  const stageOrder = PIPELINE_STAGES.map((s) => s.key);
  const currentIdx = stageOrder.indexOf(currentStage);
  const stageIdx = stageOrder.indexOf(stageKey);

  if (stageIdx < currentIdx) return 'completed';
  if (stageIdx === currentIdx) return 'current';
  return 'future';
}

/**
 * Three-stage pipeline progress display for the import flow.
 *
 * Shows parsing, metadata enrichment, and relationship creation stages
 * with batch-level progress during the enriching phase.
 */
export function ImportProgress({ stage, enrichProgress, totalCount }: ImportProgressProps) {
  const progressPercent =
    enrichProgress && enrichProgress.totalBatches > 0
      ? Math.round((enrichProgress.currentBatch / enrichProgress.totalBatches) * 100)
      : 0;

  const videosProcessedSoFar =
    enrichProgress
      ? enrichProgress.processed + enrichProgress.unavailable + enrichProgress.skipped
      : 0;

  return (
    <div className="space-y-6">
      {/* Pipeline stages */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
          Import Progress
        </h3>

        <div className="space-y-3">
          {PIPELINE_STAGES.map((pipelineStage) => {
            const status = getStageStatus(stage, pipelineStage.key);

            return (
              <div
                key={pipelineStage.key}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 ${
                  status === 'current'
                    ? 'bg-info/10 border border-info/20'
                    : status === 'completed'
                      ? 'bg-success/10 border border-success/20'
                      : 'bg-muted border border-border'
                }`}
              >
                {/* Stage icon */}
                {status === 'completed' && (
                  <CheckCircle size={20} className="text-success flex-shrink-0" weight="fill" />
                )}
                {status === 'current' && (
                  <Spinner size={20} className="text-info flex-shrink-0" />
                )}
                {status === 'future' && (
                  <Circle size={20} className="text-muted-foreground/40 flex-shrink-0" />
                )}

                {/* Stage label */}
                <span
                  className={`text-sm font-medium flex-1 ${
                    status === 'current'
                      ? 'text-info'
                      : status === 'completed'
                        ? 'text-success'
                        : 'text-muted-foreground'
                  }`}
                >
                  {pipelineStage.label}
                </span>

                {/* Batch counter for enriching stage */}
                {pipelineStage.key === 'enriching' && status === 'current' && enrichProgress && (
                  <span className="text-sm text-info">
                    {enrichProgress.currentBatch.toLocaleString()}/{enrichProgress.totalBatches.toLocaleString()} batches
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed progress for enriching stage */}
      {stage === 'enriching' && enrichProgress && (
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>
              Fetching {videosProcessedSoFar.toLocaleString()}/{totalCount.toLocaleString()} videos...
            </span>
            <span className="font-medium">{progressPercent}%</span>
          </div>

          {/* Progress bar */}
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Stats row */}
          <div className="flex gap-6 text-xs text-muted-foreground">
            <span>
              Processed: <span className="font-medium text-foreground">{enrichProgress.processed.toLocaleString()}</span>
            </span>
            <span>
              Skipped: <span className="font-medium text-foreground">{enrichProgress.skipped.toLocaleString()}</span>
            </span>
            <span>
              Unavailable: <span className="font-medium text-foreground">{enrichProgress.unavailable.toLocaleString()}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
