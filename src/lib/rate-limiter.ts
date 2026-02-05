import Bottleneck from 'bottleneck';

/**
 * YouTube API Rate Limiter with Quota Reservoir
 *
 * Implements Pattern 3 from research: Rate Limiting with Quota Tracking
 * Uses Bottleneck's reservoir feature to track daily quota consumption.
 *
 * Key features:
 * - 10,000 unit daily quota limit
 * - Automatic reset at midnight (24-hour interval)
 * - Max 5 concurrent requests
 * - Minimum 200ms between requests
 * - Retry logic for 429 rate limit errors
 * - No retry for 403 quotaExceeded errors
 */

export const youtubeRateLimiter = new Bottleneck({
  reservoir: 10000,                          // Daily quota limit
  reservoirRefreshAmount: 10000,             // Reset to 10k units
  reservoirRefreshInterval: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  maxConcurrent: 5,                          // Max 5 concurrent API requests
  minTime: 200,                              // Minimum 200ms between requests
});

// Event listener: Log when quota is depleted
youtubeRateLimiter.on('depleted', () => {
  console.warn('[Rate Limiter] Quota reservoir depleted. Waiting for next scheduled job or reservoir refresh.');
});

// Event listener: Retry logic for rate limit errors
youtubeRateLimiter.on('failed', async (error: any, jobInfo) => {
  const retryAfter = error?.response?.headers?.['retry-after'];

  // Handle 429 Rate Limit errors with exponential backoff
  if (error?.response?.status === 429 || error?.code === 429) {
    // If server provides retry-after header, use it; otherwise exponential backoff
    const delay = retryAfter
      ? parseInt(retryAfter, 10) * 1000
      : Math.min(1000 * Math.pow(2, jobInfo.retryCount), 30000);

    console.warn(`[Rate Limiter] 429 Rate Limit hit. Retrying after ${delay}ms (attempt ${jobInfo.retryCount + 1})`);
    return delay;
  }

  // Handle 403 Quota Exceeded - do NOT retry (fatal error)
  if (error?.response?.status === 403 && error?.response?.data?.error?.errors?.[0]?.reason === 'quotaExceeded') {
    console.error('[Rate Limiter] 403 Quota Exceeded - daily limit reached. No retry.');
    return; // undefined = don't retry
  }

  // For other errors, let them bubble up (don't retry)
  return;
});

/**
 * Wrapper function for making YouTube API calls with quota tracking
 *
 * Automatically consumes quota units from the reservoir based on operation cost.
 * Logs remaining quota after each successful call.
 *
 * @param apiCall - The YouTube API operation to execute
 * @param quotaCost - Number of quota units this operation costs (default: 1)
 * @param operationType - Optional description for logging (e.g., "playlists.list")
 * @returns The result of the API call
 *
 * Note: This wrapper handles quota reservation via Bottleneck's reservoir.
 * Actual quota tracking to database is done by the specific operation functions
 * (in playlists.ts, videos.ts) via trackQuotaUsage() after successful API calls.
 */
export async function callYouTubeAPI<T>(
  apiCall: () => Promise<T>,
  quotaCost: number = 1,
  operationType?: string
): Promise<T> {
  return youtubeRateLimiter.schedule({ weight: quotaCost }, async () => {
    try {
      const result = await apiCall();

      // Log remaining quota after successful operation
      const remaining = await youtubeRateLimiter.currentReservoir();
      const operationLog = operationType ? ` (${operationType})` : '';
      console.log(`[Rate Limiter] Quota remaining: ${remaining} / 10,000 units${operationLog}`);

      return result;
    } catch (error) {
      // Log error for debugging but let it propagate
      console.error('[Rate Limiter] API call failed:', error);
      throw error;
    }
  });
}
