import { db } from '@/lib/db';
import { quotaUsage } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

/**
 * YouTube API Quota Tracking Utilities
 *
 * Centralizes quota cost definitions and provides utilities for tracking
 * and monitoring YouTube API quota consumption.
 *
 * Daily limit: 10,000 units per project
 * Reset: Midnight Pacific Time (PST/PDT)
 *
 * Critical costs from YouTube API documentation:
 * - Read operations (list): 1 unit
 * - Write operations (insert/update/delete): 50 units
 *
 * With 4,000 videos, aggressive caching is essential to stay under daily limit.
 */

/**
 * Official YouTube API quota costs
 *
 * Source: https://developers.google.com/youtube/v3/determine_quota_cost
 *
 * Read operations cost 1 unit:
 * - playlists.list: Fetch user's playlists
 * - playlistItems.list: Fetch videos in a playlist
 * - videos.list: Fetch video metadata
 *
 * Write operations cost 50 units:
 * - playlists.insert: Create new playlist
 * - playlists.update: Update playlist metadata
 * - playlists.delete: Delete playlist
 * - playlistItems.insert: Add video to playlist
 * - playlistItems.delete: Remove video from playlist
 */
export const QUOTA_COSTS = {
  'playlists.list': 1,
  'playlistItems.list': 1,
  'videos.list': 1,
  'playlists.insert': 50,
  'playlists.update': 50,
  'playlists.delete': 50,
  'playlistItems.insert': 50,
  'playlistItems.delete': 50,
} as const;

/**
 * Track YouTube API quota usage in database
 *
 * Called by operation functions (in playlists.ts, videos.ts) after successful
 * API calls to maintain historical quota consumption data.
 *
 * This enables:
 * - Daily quota monitoring dashboard (Plan 05)
 * - Historical usage trends
 * - Quota optimization analysis
 * - Warning alerts when approaching limit
 *
 * @param operation - YouTube API operation type (must match QUOTA_COSTS keys)
 * @param details - Optional metadata about the operation (params, result counts, etc.)
 *
 * Example usage:
 * ```typescript
 * const playlists = await youtube.playlists.list({ mine: true });
 * await trackQuotaUsage('playlists.list', { mine: true, resultCount: playlists.data.items?.length });
 * ```
 */
export async function trackQuotaUsage(
  operation: keyof typeof QUOTA_COSTS,
  details?: Record<string, any>
): Promise<void> {
  const cost = QUOTA_COSTS[operation];

  await db.insert(quotaUsage).values({
    date: new Date(),
    unitsUsed: cost,
    operation,
    details: details ? JSON.stringify(details) : null,
  });

}

/**
 * Calculate remaining quota for the current YouTube quota day.
 *
 * YouTube resets quota at midnight Pacific Time (PST/PDT). This function
 * sums all usage since the most recent midnight PT and subtracts from the
 * 10,000-unit daily limit.
 *
 * This is the authoritative quota check used by the sync engine before
 * each batch. Rate limiting (request pacing) is handled separately by
 * Bottleneck in rate-limiter.ts.
 *
 * @returns Number of quota units remaining today (0-10000)
 */
export async function getRemainingQuota(): Promise<number> {
  // Calculate the most recent midnight Pacific Time as a UTC Date
  const now = new Date();
  const ptNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const ptMidnight = new Date(ptNow);
  ptMidnight.setHours(0, 0, 0, 0);
  // Convert midnight PT back to real UTC by reversing the timezone offset
  const ptOffsetMs = ptNow.getTime() - now.getTime();
  const quotaDayStart = new Date(ptMidnight.getTime() - ptOffsetMs);

  // Sum all quota units used since midnight PT
  const result = await db
    .select({ total: sql<number>`COALESCE(SUM(${quotaUsage.unitsUsed}), 0)` })
    .from(quotaUsage)
    .where(sql`${quotaUsage.date} >= ${quotaDayStart}`);

  const used = Number(result[0]?.total || 0);
  const remaining = 10000 - used;

  return Math.max(0, remaining);
}

/**
 * Get quota usage summary for a date range
 *
 * Useful for analytics and trend monitoring in future dashboard improvements.
 *
 * @param startDate - Start of date range
 * @param endDate - End of date range (defaults to now)
 * @returns Total units used and breakdown by operation
 */
export async function getQuotaUsageSummary(
  startDate: Date,
  endDate: Date = new Date()
): Promise<{ totalUsed: number; byOperation: Record<string, number> }> {
  const records = await db
    .select()
    .from(quotaUsage)
    .where(sql`${quotaUsage.date} >= ${startDate} AND ${quotaUsage.date} <= ${endDate}`);

  const totalUsed = records.reduce((sum, record) => sum + record.unitsUsed, 0);

  // Aggregate by operation type
  const byOperation: Record<string, number> = {};
  records.forEach((record) => {
    byOperation[record.operation] = (byOperation[record.operation] || 0) + record.unitsUsed;
  });

  return { totalUsed, byOperation };
}
