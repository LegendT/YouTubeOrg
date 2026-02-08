'use client';

import { useState } from 'react';
import { Brain, Info } from '@phosphor-icons/react';
import { CategorisationTrigger } from '@/components/ml/categorisation-trigger';
import { ProgressDisplay } from '@/components/ml/progress-display';
import { EmptyState } from '@/components/ui/empty-state';
import type { RunMLCategorisationResult, MLProgressUpdate } from '@/types/ml';

export function MLCategorisationPage() {
  const [progress, setProgress] = useState<MLProgressUpdate>({
    current: 0,
    total: 0,
    percentage: 0,
    status: 'Ready to categorise',
  });
  const [result, setResult] = useState<RunMLCategorisationResult | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border px-8 py-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">ML Video Categorisation</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Automatically categorise videos using machine learning. This process analyses video titles and
          descriptions to suggest the best category match.
        </p>
      </div>

      {/* Main Content */}
      <div className="p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Information Card */}
          <div className="bg-info/10 border border-info/20 rounded-lg p-4">
            <h2 className="flex items-center gap-2 font-semibold text-info mb-2">
              <Info size={18} weight="fill" />
              How it works
            </h2>
            <ul className="text-sm text-info/80 space-y-1 list-disc list-inside">
              <li>Analyses video titles and channel names using AI embeddings</li>
              <li>Matches videos to categories based on semantic similarity</li>
              <li>Assigns confidence levels: HIGH, MEDIUM, or LOW</li>
              <li>Processes videos in batches for optimal performance</li>
              <li>Caches embeddings to avoid recomputation on re-runs</li>
            </ul>
          </div>

          {/* Categorisation Trigger */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Run Categorisation</h2>

            <CategorisationTrigger
              onProgressUpdate={(current, total, percentage, status) => {
                if (!hasStarted) setHasStarted(true);
                setProgress({ current, total, percentage, status });
              }}
              onComplete={(result) => {
                setResult(result);
              }}
            />

            {/* Progress Display */}
            {progress.total > 0 && (
              <div className="mt-6">
                <ProgressDisplay
                  current={progress.current}
                  total={progress.total}
                  percentage={progress.percentage}
                  status={progress.status}
                />
              </div>
            )}
          </div>

          {/* Results Display */}
          {result && result.success && (
            <div className="bg-success/10 border border-success/20 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-success mb-4">Categorisation Complete</h2>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Total Videos:</span>
                  <span className="ml-2 font-semibold text-foreground">
                    {result.categorisedCount}
                  </span>
                </div>

                <div>
                  <span className="text-muted-foreground">High Confidence:</span>
                  <span className="ml-2 font-semibold text-success">
                    {result.highConfidenceCount}
                  </span>
                </div>

                <div>
                  <span className="text-muted-foreground">Medium Confidence:</span>
                  <span className="ml-2 font-semibold text-warning">
                    {result.mediumConfidenceCount}
                  </span>
                </div>

                <div>
                  <span className="text-muted-foreground">Low Confidence:</span>
                  <span className="ml-2 font-semibold text-destructive">
                    {result.lowConfidenceCount}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-success/20">
                <p className="text-sm text-success/80">
                  Next step: Review and approve suggestions in the Review Interface
                </p>
              </div>
            </div>
          )}

          {/* Error Display */}
          {result && !result.success && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-destructive mb-2">Error</h2>
              <p className="text-sm text-destructive/80">{result.error}</p>
            </div>
          )}

          {/* Empty State - shown when no categorisation has been run */}
          {!hasStarted && !result && (
            <EmptyState
              icon={Brain}
              title="No categorisation results yet"
              description="Run ML categorisation to automatically assign categories to your uncategorised videos."
            />
          )}
        </div>
      </div>
    </div>
  );
}
