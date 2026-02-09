'use client';

import { useRef, useState } from 'react';
import { UploadSimple, FileText, Warning } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { parseWatchLaterCSV } from '@/lib/import/csv-parser';
import type { ParsedCSVRow } from '@/lib/import/csv-parser';

interface CSVUploadProps {
  onParsed: (csvText: string, rows: ParsedCSVRow[], totalCount: number) => void;
  disabled?: boolean;
}

/**
 * CSV file upload component with instant client-side validation.
 *
 * Uses FileReader to read the file as text, then validates it via
 * parseWatchLaterCSV before passing the data up to the parent.
 * Shows the file name and video count on success, or an error on failure.
 */
export function CSVUpload({ onParsed, disabled = false }: CSVUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [videoCount, setVideoCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleButtonClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset previous state
    setError(null);
    setFileName(null);
    setVideoCount(null);

    // Validate file extension
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please select a CSV file. The file must have a .csv extension.');
      // Reset the input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

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
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      setFileName(file.name);
      setVideoCount(result.totalCount);
      onParsed(text, result.rows, result.totalCount);
    };

    reader.onerror = () => {
      setError('Failed to read the file. Please try again.');
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.readAsText(file);
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-4">
      <div>
        <h2 className="text-sm font-medium text-foreground">Upload CSV</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Select a Google Takeout Watch Later CSV export
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Select CSV file"
      />

      <Button
        variant="outline"
        onClick={handleButtonClick}
        disabled={disabled}
        className="w-full sm:w-auto"
      >
        <UploadSimple size={18} />
        Select CSV File
      </Button>

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
