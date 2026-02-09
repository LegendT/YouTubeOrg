'use client';

import { useRef, useState } from 'react';
import JSZip from 'jszip';
import { UploadSimple, FileText, Warning } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { parseWatchLaterCSV } from '@/lib/import/csv-parser';
import type { ParsedCSVRow } from '@/lib/import/csv-parser';

interface CSVUploadProps {
  onParsed: (csvText: string, rows: ParsedCSVRow[], totalCount: number) => void;
  disabled?: boolean;
}

/**
 * Known paths where the Watch Later CSV lives in Google Takeout exports.
 * Google may use "YouTube and YouTube Music" or "YouTube" as the folder name.
 */
const KNOWN_CSV_PATHS = [
  'Takeout/YouTube and YouTube Music/playlists/Watch later-videos.csv',
  'YouTube and YouTube Music/playlists/Watch later-videos.csv',
  'Takeout/YouTube/playlists/Watch later-videos.csv',
  'YouTube/playlists/Watch later-videos.csv',
];

/**
 * File upload component with instant client-side validation.
 *
 * Accepts both .csv and .zip files. For zip archives, uses JSZip to
 * locate and extract the Watch Later CSV automatically. Validates the
 * CSV via parseWatchLaterCSV before passing the data up to the parent.
 */
export function CSVUpload({ onParsed, disabled = false }: CSVUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [videoCount, setVideoCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);

  function handleButtonClick() {
    fileInputRef.current?.click();
  }

  function resetState() {
    setError(null);
    setFileName(null);
    setVideoCount(null);
    setExtracting(false);
  }

  function resetInput() {
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleCsvFile(file: File) {
    const reader = new FileReader();

    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text !== 'string') {
        setError('Failed to read file contents.');
        return;
      }

      const result = parseWatchLaterCSV(text);

      if (!result.success) {
        setError(result.error);
        resetInput();
        return;
      }

      setFileName(file.name);
      setVideoCount(result.totalCount);
      onParsed(text, result.rows, result.totalCount);
    };

    reader.onerror = () => {
      setError('Failed to read the file. Please try again.');
      resetInput();
    };

    reader.readAsText(file);
  }

  async function handleZipFile(file: File) {
    setExtracting(true);

    try {
      const zip = await JSZip.loadAsync(file);

      // Try known Takeout paths first
      let csvEntry: JSZip.JSZipObject | null = null;
      for (const path of KNOWN_CSV_PATHS) {
        csvEntry = zip.file(path);
        if (csvEntry) break;
      }

      // Fallback: search for any file ending with "Watch later-videos.csv"
      if (!csvEntry) {
        zip.forEach((relativePath, entry) => {
          if (!csvEntry && relativePath.endsWith('Watch later-videos.csv')) {
            csvEntry = entry;
          }
        });
      }

      if (!csvEntry) {
        setError(
          'Could not find "Watch later-videos.csv" in the archive. ' +
            'Make sure you exported the Watch Later playlist from Google Takeout.'
        );
        resetInput();
        return;
      }

      const text = await csvEntry.async('string');
      const result = parseWatchLaterCSV(text);

      if (!result.success) {
        setError(result.error);
        resetInput();
        return;
      }

      setFileName(`${file.name} → Watch later-videos.csv`);
      setVideoCount(result.totalCount);
      onParsed(text, result.rows, result.totalCount);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to read the archive';
      setError(`Failed to extract CSV from zip: ${message}`);
      resetInput();
    } finally {
      setExtracting(false);
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    resetState();

    const name = file.name.toLowerCase();
    const isZip = name.endsWith('.zip');
    const isCsv = name.endsWith('.csv');

    if (!isZip && !isCsv) {
      setError('Please select a .csv or .zip file.');
      resetInput();
      return;
    }

    if (isZip) {
      await handleZipFile(file);
    } else {
      handleCsvFile(file);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-4">
      <div>
        <h2 className="text-sm font-medium text-foreground">Upload File</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Select a Google Takeout .zip archive or the Watch Later CSV directly
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.zip"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Select CSV or ZIP file"
      />

      <Button
        variant="outline"
        onClick={handleButtonClick}
        disabled={disabled || extracting}
        className="w-full sm:w-auto"
      >
        <UploadSimple size={18} />
        Select File
      </Button>

      {/* Extracting state */}
      {extracting && (
        <div className="flex items-center gap-3 rounded-md bg-info/10 border border-info/20 p-3">
          <Spinner size={18} className="text-info flex-shrink-0" />
          <p className="text-sm text-info">Extracting CSV from archive...</p>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-3">
          <Warning size={18} className="text-destructive mt-0.5 flex-shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Success display: file name and video count */}
      {fileName && videoCount !== null && (
        <div className="flex items-center gap-3 rounded-md bg-success/10 border border-success/20 p-3">
          <FileText size={20} className="text-success flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">{fileName}</p>
            <p className="text-xs text-muted-foreground">
              {videoCount.toLocaleString()} videos found
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
