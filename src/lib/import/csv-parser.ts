/**
 * Watch Later CSV Parser
 *
 * Parses Google Takeout Watch Later CSV exports into structured data.
 * The CSV format is simple: two columns with no quoting or escaping.
 *
 * Expected format:
 *   Video ID,Playlist Video Creation Timestamp
 *   dQw4w9WgXcQ,2024-01-15 10:30:00 UTC
 *
 * Invalid video IDs are silently skipped (not treated as errors),
 * allowing partial imports from slightly malformed exports.
 */

/** A single parsed row from the Watch Later CSV */
export interface ParsedCSVRow {
  videoId: string;
  addedAt: string; // ISO 8601 timestamp
}

/** Discriminated union result type for CSV parsing */
export type CSVParseResult =
  | { success: true; rows: ParsedCSVRow[]; totalCount: number }
  | { success: false; error: string };

/**
 * Parse a Google Takeout Watch Later CSV export into structured rows.
 *
 * Validates the header line matches the expected format, extracts video IDs
 * and timestamps from data rows, and skips any rows with invalid video IDs.
 *
 * @param csvText - Raw CSV text content (read via FileReader on the client)
 * @returns Discriminated union with parsed rows on success, or error message on failure
 */
export function parseWatchLaterCSV(csvText: string): CSVParseResult {
  const lines = csvText.trim().split('\n');

  // Must have at least a header and one data row
  if (lines.length < 2) {
    return { success: false, error: 'CSV file is empty or has no data rows' };
  }

  // Validate the header matches Google Takeout Watch Later format exactly
  const header = lines[0].trim();
  if (header !== 'Video ID,Playlist Video Creation Timestamp') {
    return {
      success: false,
      error:
        'Invalid CSV format. Expected Google Takeout Watch Later export with headers: Video ID, Playlist Video Creation Timestamp',
    };
  }

  // YouTube video IDs are exactly 11 characters: alphanumeric, hyphens, underscores
  const videoIdPattern = /^[\w-]{11}$/;

  const rows: ParsedCSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines (e.g. trailing newline)

    // Split on the first comma only (timestamp may theoretically contain commas)
    const commaIndex = line.indexOf(',');
    if (commaIndex === -1) continue;

    const videoId = line.substring(0, commaIndex).trim();
    const timestamp = line.substring(commaIndex + 1).trim();

    // Silently skip rows with invalid video IDs rather than erroring
    if (!videoIdPattern.test(videoId)) continue;

    rows.push({ videoId, addedAt: timestamp });
  }

  return { success: true, rows, totalCount: rows.length };
}
