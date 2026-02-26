import Bottleneck from 'bottleneck';

/**
 * YouTube API Rate Limiter
 *
 * Controls request pacing to avoid hitting YouTube's per-second rate limits.
 * Daily quota management is handled separately by getRemainingQuota() in
 * quota.ts, which the sync engine checks before each batch.
 *
 * Key features:
 * - Max 5 concurrent requests
 * - Minimum 200ms between requests
 * - Retry logic for 429 rate limit errors
 * - No retry for 403 quotaExceeded errors
 *
 * NOTE: No reservoir is used. Previously, a 10,000-unit reservoir with a
 * 24-hour auto-refresh caused the sync to get stuck (reservoir depleted but
 * YouTube quota hadn't actually reset yet) and allowed operations to exceed
 * the real daily quota (reservoir refreshed on a timer from server start,
 * not midnight Pacific Time). The DB-based getRemainingQuota() is now the
 * sole quota gate.
 */

export const youtubeRateLimiter = new Bottleneck({
  maxConcurrent: 5,
  minTime: 200,
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
 * Wrapper function for making YouTube API calls with rate limiting
 *
 * Schedules the API call through Bottleneck for pacing control.
 * Quota tracking is handled by trackQuotaUsage() in the calling functions
 * and getRemainingQuota() checks in the sync engine.
 *
 * @param apiCall - The YouTube API operation to execute
 * @param quotaCost - Number of quota units this operation costs (for logging only)
 * @param operationType - Optional description for logging (e.g., "playlists.list")
 * @returns The result of the API call
 */
export async function callYouTubeAPI<T>(
  apiCall: () => Promise<T>,
  quotaCost: number = 1,
  operationType?: string
): Promise<T> {
  return youtubeRateLimiter.schedule(async () => {
    try {
      const result = await apiCall();

      const operationLog = operationType ? ` (${operationType}, ${quotaCost} units)` : '';
      console.log(`[Rate Limiter] API call succeeded${operationLog}`);

      return result;
    } catch (error) {
      console.error('[Rate Limiter] API call failed:', error);
      throw error;
    }
  });
}
