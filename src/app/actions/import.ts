'use server';

/**
 * Import Server Actions
 *
 * Orchestrates CSV parsing and Watch Later playlist creation for the
 * Google Takeout import flow. Receives CSV text (already read client-side
 * via FileReader), validates it, creates the playlist entry, and returns
 * parsed data for downstream batch processing.
 *
 * Follows the established server action pattern: never throws, always
 * returns structured { success, error? } responses.
 */

import { auth } from '@/lib/auth/config';
import { parseWatchLaterCSV } from '@/lib/import/csv-parser';
import type { ParsedCSVRow } from '@/lib/import/csv-parser';
import { ensureWatchLaterPlaylist } from '@/lib/import/watch-later';

/**
 * Parse a Watch Later CSV export and initialise the import.
 *
 * Steps:
 * 1. Verify the user is authenticated
 * 2. Parse the CSV text and validate its format
 * 3. Upsert the Watch Later playlist in the database
 * 4. Return parsed rows + playlist DB ID for batch metadata enrichment
 *
 * @param csvText - Raw CSV content read by the client via FileReader.readAsText()
 * @returns Structured result with parsed rows and playlist ID, or error message
 */
export async function parseAndInitialiseImport(csvText: string): Promise<{
  success: boolean;
  error?: string;
  playlistDbId?: number;
  rows?: ParsedCSVRow[];
  totalCount?: number;
}> {
  // Step 1: Authentication check
  const session = await auth();
  if (!session?.access_token) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    // Step 2: Parse and validate CSV
    const result = parseWatchLaterCSV(csvText);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Step 3: Create or update the Watch Later playlist entry
    const playlistDbId = await ensureWatchLaterPlaylist(result.totalCount);

    // Step 4: Return parsed data for downstream batch processing
    return {
      success: true,
      playlistDbId,
      rows: result.rows,
      totalCount: result.totalCount,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Import failed: ${message}` };
  }
}
