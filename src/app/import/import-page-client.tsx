'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { CSVUpload } from '@/components/import/csv-upload';
import { ImportProgress } from '@/components/import/import-progress';
import { ImportSummary } from '@/components/import/import-summary';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  parseAndInitialiseImport,
  importMetadataBatch,
  createPlaylistRelationships,
} from '@/app/actions/import';
import type { ParsedCSVRow } from '@/lib/import/csv-parser';
import { ArrowClockwise, Play, Warning } from '@phosphor-icons/react';

type ImportStage = 'idle' | 'parsing' | 'enriching' | 'linking' | 'complete' | 'error';

interface EnrichProgress {
  processed: number;
  unavailable: number;
  skipped: number;
  currentBatch: number;
  totalBatches: number;
}

interface LinkResult {
  created: number;
  skipped: number;
}

/**
 * Client orchestrator for the /import page.
 *
 * Manages the full import lifecycle as a state machine:
 * idle -> parsing -> enriching -> linking -> complete
 *
 * The client drives the metadata enrichment batch loop, calling
 * importMetadataBatch sequentially (one await at a time) to avoid
 * server action serialisation issues and enable real-time progress.
 */
export function ImportPageClient() {
  const [stage, setStage] = useState<ImportStage>('idle');
  const [parsedRows, setParsedRows] = useState<ParsedCSVRow[]>([]);
  const [csvText, setCsvText] = useState<string>('');
  const [totalCount, setTotalCount] = useState(0);
  const [playlistDbId, setPlaylistDbId] = useState<number | null>(null);
  const [enrichProgress, setEnrichProgress] = useState<EnrichProgress | null>(null);
  const [linkResult, setLinkResult] = useState<LinkResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileSelected, setFileSelected] = useState(false);

  const BATCH_SIZE = 50;

  /**
   * Callback from CSVUpload when a file is successfully parsed client-side.
   */
  function handleParsed(text: string, rows: ParsedCSVRow[], count: number) {
    setCsvText(text);
    setParsedRows(rows);
    setTotalCount(count);
    setFileSelected(true);
  }

  /**
   * Reset all state back to idle for a fresh import attempt.
   */
  function resetToIdle() {
    setStage('idle');
    setParsedRows([]);
    setCsvText('');
    setTotalCount(0);
    setPlaylistDbId(null);
    setEnrichProgress(null);
    setLinkResult(null);
    setError(null);
    setFileSelected(false);
  }

  /**
   * Run the full import pipeline: parse -> enrich -> link.
   *
   * Each stage transitions sequentially. Metadata enrichment runs as a
   * batch loop with progress updates between each iteration.
   */
  async function handleStartImport() {
    try {
      // Stage 1: Parse CSV and initialise import on the server
      setStage('parsing');
      setError(null);

      const initResult = await parseAndInitialiseImport(csvText);
      if (!initResult.success || !initResult.playlistDbId) {
        throw new Error(initResult.error ?? 'Failed to initialise import');
      }

      const dbId = initResult.playlistDbId;
      setPlaylistDbId(dbId);

      // Stage 2: Metadata enrichment — client-driven batch loop
      setStage('enriching');
      const videoIds = parsedRows.map((r) => r.videoId);
      const totalBatches = Math.ceil(videoIds.length / BATCH_SIZE);

      let cumulativeProcessed = 0;
      let cumulativeUnavailable = 0;
      let cumulativeSkipped = 0;

      let startIndex = 0;
      let currentBatch = 0;

      while (startIndex < videoIds.length) {
        currentBatch++;

        // Update progress before each batch so the UI shows current state
        setEnrichProgress({
          processed: cumulativeProcessed,
          unavailable: cumulativeUnavailable,
          skipped: cumulativeSkipped,
          currentBatch,
          totalBatches,
        });

        const batchResult = await importMetadataBatch(videoIds, startIndex, BATCH_SIZE);

        if (!batchResult.success) {
          throw new Error(batchResult.error ?? 'Metadata enrichment failed');
        }

        cumulativeProcessed += batchResult.processed;
        cumulativeUnavailable += batchResult.unavailable;
        cumulativeSkipped += batchResult.skipped;
        startIndex += BATCH_SIZE;
      }

      // Final progress update after all batches
      setEnrichProgress({
        processed: cumulativeProcessed,
        unavailable: cumulativeUnavailable,
        skipped: cumulativeSkipped,
        currentBatch: totalBatches,
        totalBatches,
      });

      // Stage 3: Create playlist-video relationships
      setStage('linking');
      const relResult = await createPlaylistRelationships(dbId, parsedRows);

      if (!relResult.success) {
        throw new Error(relResult.error ?? 'Failed to create playlist relationships');
      }

      setLinkResult({ created: relResult.created, skipped: relResult.skipped });

      // Done
      setStage('complete');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(message);
      setStage('error');
      toast.error(message);
    }
  }

  // Idle state: show file upload and start button
  if (stage === 'idle') {
    return (
      <div className="space-y-6">
        <CSVUpload onParsed={handleParsed} disabled={false} />

        {fileSelected && (
          <Button onClick={handleStartImport} size="lg" className="w-full sm:w-auto">
            <Play size={18} weight="fill" />
            Start Import
          </Button>
        )}
      </div>
    );
  }

  // Parsing state: spinner with message
  if (stage === 'parsing') {
    return (
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Spinner size={24} className="text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">Initialising import...</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Parsing CSV and setting up Watch Later playlist
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Enriching state: progress component
  if (stage === 'enriching') {
    return (
      <ImportProgress
        stage="enriching"
        enrichProgress={enrichProgress}
        totalCount={totalCount}
      />
    );
  }

  // Linking state: spinner with message
  if (stage === 'linking') {
    return (
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Spinner size={24} className="text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Creating playlist relationships...
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Linking {totalCount.toLocaleString()} videos to Watch Later playlist
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Complete state: summary
  if (stage === 'complete' && enrichProgress && linkResult) {
    return (
      <div className="space-y-6">
        <ImportSummary
          totalCount={totalCount}
          processed={enrichProgress.processed}
          unavailable={enrichProgress.unavailable}
          skipped={enrichProgress.skipped}
          relationshipsCreated={linkResult.created}
          relationshipsSkipped={linkResult.skipped}
        />

        <Button onClick={resetToIdle} variant="outline">
          <ArrowClockwise size={18} />
          Import Another File
        </Button>
      </div>
    );
  }

  // Error state: error card with retry
  if (stage === 'error') {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-6">
          <div className="flex items-center gap-2 mb-2">
            <Warning size={20} className="text-destructive" />
            <h2 className="text-lg font-medium text-destructive">Import Failed</h2>
          </div>
          <p className="text-sm text-destructive/80">{error}</p>
        </div>

        <Button onClick={resetToIdle} variant="outline">
          <ArrowClockwise size={18} />
          Try Again
        </Button>
      </div>
    );
  }

  return null;
}
