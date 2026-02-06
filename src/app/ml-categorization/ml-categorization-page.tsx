'use client';

import { useState } from 'react';
import { CategorizationTrigger } from '@/components/ml/categorization-trigger';
import { ProgressDisplay } from '@/components/ml/progress-display';
import type { RunMLCategorizationResult, MLProgressUpdate } from '@/types/ml';

export function MLCategorizationPage() {
  const [progress, setProgress] = useState<MLProgressUpdate>({
    current: 0,
    total: 0,
    percentage: 0,
    status: 'Ready to categorize',
  });
  const [result, setResult] = useState<RunMLCategorizationResult | null>(null);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <h1 className="text-2xl font-bold text-gray-900">ML Video Categorization</h1>
        <p className="mt-2 text-sm text-gray-600">
          Automatically categorize videos using machine learning. This process analyzes video titles and
          descriptions to suggest the best category match.
        </p>
      </div>

      {/* Main Content */}
      <div className="p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Information Card */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h2 className="font-semibold text-blue-900 mb-2">How it works</h2>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Analyzes video titles and channel names using AI embeddings</li>
              <li>Matches videos to categories based on semantic similarity</li>
              <li>Assigns confidence levels: HIGH, MEDIUM, or LOW</li>
              <li>Processes videos in batches for optimal performance</li>
              <li>Caches embeddings to avoid recomputation on re-runs</li>
            </ul>
          </div>

          {/* Categorization Trigger */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Run Categorization</h2>

            <CategorizationTrigger
              onProgressUpdate={(current, total, percentage, status) => {
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
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-green-900 mb-4">Categorization Complete</h2>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Total Videos:</span>
                  <span className="ml-2 font-semibold text-gray-900">
                    {result.categorizedCount}
                  </span>
                </div>

                <div>
                  <span className="text-gray-600">High Confidence:</span>
                  <span className="ml-2 font-semibold text-green-700">
                    {result.highConfidenceCount}
                  </span>
                </div>

                <div>
                  <span className="text-gray-600">Medium Confidence:</span>
                  <span className="ml-2 font-semibold text-yellow-700">
                    {result.mediumConfidenceCount}
                  </span>
                </div>

                <div>
                  <span className="text-gray-600">Low Confidence:</span>
                  <span className="ml-2 font-semibold text-red-700">
                    {result.lowConfidenceCount}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-green-200">
                <p className="text-sm text-green-800">
                  Next step: Review and approve suggestions in the Review Interface (Phase 6)
                </p>
              </div>
            </div>
          )}

          {/* Error Display */}
          {result && !result.success && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-red-900 mb-2">Error</h2>
              <p className="text-sm text-red-800">{result.error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
