'use client';

import { useState } from 'react';
import { getDataForCategorisation, saveCategorisationResults } from '@/app/actions/ml-categorisation';
import { MLCategorisationEngine } from '@/lib/ml/categorisation-engine';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import type { RunMLCategorisationResult } from '@/types/ml';

interface CategorisationTriggerProps {
  onProgressUpdate?: (current: number, total: number, percentage: number, status: string) => void;
  onComplete?: (result: RunMLCategorisationResult) => void;
}

export function CategorisationTrigger({ onProgressUpdate, onComplete }: CategorisationTriggerProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRunCategorisation = async () => {
    setIsRunning(true);
    setError(null);

    let engine: MLCategorisationEngine | null = null;

    try {
      // Step 1: Fetch data from server
      onProgressUpdate?.(0, 100, 0, 'Loading data...');
      const data = await getDataForCategorisation();

      if (!data.success || !data.videos || !data.categories) {
        setError(data.error || 'Failed to load data');
        onComplete?.({ success: false, error: data.error });
        return;
      }

      // Step 2: Run ML categorisation client-side
      engine = new MLCategorisationEngine();

      const results = await engine.categoriseVideos(
        data.videos,
        data.categories,
        (current, total, percentage, status) => {
          onProgressUpdate?.(current, total, percentage, status);
        }
      );

      // Step 3: Save results to database
      onProgressUpdate?.(100, 100, 95, 'Saving results...');
      const saveResult = await saveCategorisationResults(results);

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
      <Button
        onClick={handleRunCategorisation}
        disabled={isRunning}
      >
        {isRunning ? (
          <>
            <Spinner size={16} className="mr-2" />
            Categorising...
          </>
        ) : (
          'Run ML Categorisation'
        )}
      </Button>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          Error: {error}
        </div>
      )}
    </div>
  );
}
