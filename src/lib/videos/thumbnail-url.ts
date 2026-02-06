/**
 * YouTube thumbnail URL constructor.
 * Builds mqdefault (medium quality) thumbnail URLs from YouTube video IDs.
 */

/**
 * Construct a YouTube thumbnail URL from a video ID.
 * Uses mqdefault quality (320x180) which is available for all videos.
 * @param youtubeId - The YouTube video ID (e.g., "dQw4w9WgXcQ")
 * @returns Full thumbnail URL, or null if no ID provided
 */
export function getThumbnailUrl(youtubeId?: string | null): string | null {
  if (!youtubeId) return null;
  return `https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`;
}
