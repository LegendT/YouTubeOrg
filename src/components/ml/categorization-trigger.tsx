'use client';

import { useState } from 'react';
import { runMLCategorization } from '@/app/actions/ml-categorization';
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

    try {
      // Note: Server actions don't support progress streaming
      // Progress will be simulated/estimated client-side or moved to client-side engine in future
      onProgressUpdate?.(0, 100, 0, 'Starting categorization...');

      const result = await runMLCategorization();

      if (!result.success) {
        setError(result.error || 'Categorization failed');
      } else {
        onProgressUpdate?.(100, 100, 100, 'Complete');
      }

      onComplete?.(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    } finally {
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
