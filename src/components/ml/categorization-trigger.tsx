'use client';

import { useState } from 'react';
import { getDataForCategorization, saveCategorizationResults } from '@/app/actions/ml-categorization';
import { MLCategorizationEngine } from '@/lib/ml/categorization-engine';
import type { RunMLCategorizationResult } from '@/types/ml';

interface CategorizationTriggerProps {
  onProgressUpdate?: (current: number, total: number, percentage: number, status: string) => void;
  onComplete?: (result: RunMLCategorizationResult) => void;
}

export function CategorizationTrigger({ onProgressUpdate, onComplete }: CategorizationTriggerProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRunCategorization = async () => {
    setIsRunning(true);
    setError(null);

    let engine: MLCategorizationEngine | null = null;

    try {
      // Step 1: Fetch data from server
      onProgressUpdate?.(0, 100, 0, 'Loading data...');
      const data = await getDataForCategorization();

      if (!data.success || !data.videos || !data.categories) {
        setError(data.error || 'Failed to load data');
        onComplete?.({ success: false, error: data.error });
        return;
      }

      // Step 2: Run ML categorization client-side
      engine = new MLCategorizationEngine();

      const results = await engine.categorizeVideos(
        data.videos,
        data.categories,
        (current, total, percentage, status) => {
          onProgressUpdate?.(current, total, percentage, status);
        }
      );

      // Step 3: Save results to database
      onProgressUpdate?.(100, 100, 95, 'Saving results...');
      const saveResult = await saveCategorizationResults(results);

      if (!saveResult.success) {
        setError(saveResult.error || 'Failed to save results');
      } else {
        onProgressUpdate?.(100, 100, 100, 'Complete');
      }

      onComplete?.(saveResult);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      onComplete?.({ success: false, error: errorMessage });
    } finally {
      // Cleanup: terminate worker
      if (engine) {
        engine.terminate();
      }
      setIsRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleRunCategorization}
        disabled={isRunning}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {isRunning ? 'Categorizing...' : 'Run ML Categorization'}
      </button>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">
          Error: {error}
        </div>
      )}
    </div>
  );
}
