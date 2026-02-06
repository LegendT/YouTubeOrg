/**
 * Format utilities for video durations and dates.
 * Extracted from Phase 2 components for shared use across video display.
 */

/**
 * Parse ISO 8601 duration (PT1H2M3S) to seconds.
 * @param isoDuration - YouTube API duration format (e.g., "PT15M33S", "PT1H2M3S")
 * @returns Total seconds, or 0 if invalid/missing
 */
export function parseDurationToSeconds(isoDuration?: string | null): number {
  if (!isoDuration) return 0;
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Format ISO 8601 duration to human-readable MM:SS or H:MM:SS.
 * @param isoDuration - YouTube API duration format
 * @returns Formatted duration (e.g., "15:33", "1:02:03"), or "--" if invalid
 */
export function formatDuration(isoDuration?: string | null): string {
  if (!isoDuration) return '--';
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return isoDuration;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Format date as relative time (e.g., "2 days ago", "3 months ago").
 * @param date - Date to format (Date object or ISO string)
 * @returns Relative time string, or "--" if invalid
 */
export function formatRelativeDate(date?: Date | string | null): string {
  if (!date) return '--';
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 1) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months > 1 ? 's' : ''} ago`;
  }
  const years = Math.floor(diffDays / 365);
  return `${years} year${years > 1 ? 's' : ''} ago`;
}
