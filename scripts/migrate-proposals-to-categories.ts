/**
 * One-time migration script: Convert finalized Phase 2 proposals into Phase 3 categories.
 *
 * Usage:
 *   DATABASE_URL=<url> npx tsx scripts/migrate-proposals-to-categories.ts
 *
 * This script:
 * 1. Checks for a finalized analysis session
 * 2. Creates an "Uncategorized" protected category
 * 3. Converts approved proposals to categories with video associations
 * 4. Assigns orphaned videos to "Uncategorized"
 *
 * Safe to re-run: exits early if categories already exist.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

// Create db connection directly instead of importing @/lib/db,
// because that module reads DATABASE_URL at import time (before dotenv runs).
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../src/lib/db/schema';
import {
  analysisSessions,
  consolidationProposals,
  playlistVideos,
  videos,
  categories,
  categoryVideos,
} from '../src/lib/db/schema';
import { eq, isNotNull, inArray } from 'drizzle-orm';

// Create db connection directly (bypasses the @/lib/db module which may read env too early)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  max: 1,
});
const db = drizzle(pool, { schema });

async function main() {
  console.log('=== Phase 2 -> Phase 3 Category Migration ===\n');

  // 1. Check prerequisites: finalized session exists
  const finalizedSessions = await db
    .select()
    .from(analysisSessions)
    .where(isNotNull(analysisSessions.finalizedAt));

  if (finalizedSessions.length === 0) {
    console.log('No finalized session found. Run Phase 2 finalization first.');
    process.exit(0);
  }

  console.log(`Found ${finalizedSessions.length} finalized session(s).`);

  // 2. Idempotency check: categories already migrated?
  const existingCategories = await db.select().from(categories);
  if (existingCategories.length > 0) {
    console.log('Categories already migrated. Skipping.');
    process.exit(0);
  }

  // 3. Run the migration in a transaction
  await db.transaction(async (tx) => {
    // 3a. Create "Uncategorized" category first
    const [uncategorized] = await tx
      .insert(categories)
      .values({
        name: 'Uncategorized',
        isProtected: true,
        videoCount: 0,
        sourceProposalId: null,
      })
      .returning();

    console.log(`Created "Uncategorized" category (id: ${uncategorized.id})`);

    // 3b. Get all approved proposals
    const approvedProposals = await tx
      .select()
      .from(consolidationProposals)
      .where(eq(consolidationProposals.status, 'approved'));

    console.log(`Found ${approvedProposals.length} approved proposals to migrate.\n`);

    let totalCategories = 0;
    let totalVideoAssignments = 0;

    // 3c. Migrate each proposal to a category
    for (const proposal of approvedProposals) {
      const sourcePlaylistIds = proposal.sourcePlaylistIds as number[];

      // Insert category
      const [newCategory] = await tx
        .insert(categories)
        .values({
          name: proposal.categoryName,
          sourceProposalId: proposal.id,
          isProtected: false,
          videoCount: 0,
        })
        .returning();

      // Get all video IDs from source playlists
      let videoIds: number[] = [];
      if (sourcePlaylistIds.length > 0) {
        const playlistVideoRows = await tx
          .select({ videoId: playlistVideos.videoId })
          .from(playlistVideos)
          .where(inArray(playlistVideos.playlistId, sourcePlaylistIds));

        // Deduplicate video IDs (a video may appear in multiple source playlists)
        const uniqueVideoIds = [...new Set(playlistVideoRows.map((r) => r.videoId))];
        videoIds = uniqueVideoIds;
      }

      // Batch insert into categoryVideos
      if (videoIds.length > 0) {
        const insertValues = videoIds.map((videoId) => ({
          categoryId: newCategory.id,
          videoId,
          source: 'consolidation' as const,
        }));

        await tx.insert(categoryVideos).values(insertValues);
      }

      // Update videoCount
      await tx
        .update(categories)
        .set({ videoCount: videoIds.length })
        .where(eq(categories.id, newCategory.id));

      totalCategories++;
      totalVideoAssignments += videoIds.length;

      console.log(
        `  [${totalCategories}] "${proposal.categoryName}" -> ${videoIds.length} videos (from ${sourcePlaylistIds.length} playlists)`
      );
    }

    // 4. Handle orphaned videos
    // Find all video IDs that are NOT in any category
    const assignedVideoIds = await tx
      .select({ videoId: categoryVideos.videoId })
      .from(categoryVideos);

    const assignedSet = new Set(assignedVideoIds.map((r) => r.videoId));

    const allVideos = await tx.select({ id: videos.id }).from(videos);

    const orphanedVideoIds = allVideos
      .filter((v) => !assignedSet.has(v.id))
      .map((v) => v.id);

    if (orphanedVideoIds.length > 0) {
      const orphanValues = orphanedVideoIds.map((videoId) => ({
        categoryId: uncategorized.id,
        videoId,
        source: 'orphan' as const,
      }));

      await tx.insert(categoryVideos).values(orphanValues);

      // Update Uncategorized videoCount
      await tx
        .update(categories)
        .set({ videoCount: orphanedVideoIds.length })
        .where(eq(categories.id, uncategorized.id));
    }

    console.log('\n=== Migration Summary ===');
    console.log(`Migrated ${totalCategories} categories with ${totalVideoAssignments} total video assignments`);
    console.log(`${orphanedVideoIds.length} orphaned videos assigned to Uncategorized`);
  });

  console.log('\nMigration complete!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
