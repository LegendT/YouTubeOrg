import { promises as fs } from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  backupSnapshots,
  categories,
  categoryVideos,
  videos,
  mlCategorisations,
} from '@/lib/db/schema';
import type { BackupData } from '@/types/backup';
import { createSnapshot } from './snapshot';

const BACKUP_DIR = path.join(process.cwd(), 'backups');

interface RestoreResult {
  success: boolean;
  error?: string;
  preRestoreBackupId?: number;
  restoredCategories?: number;
  restoredVideos?: number;
  warnings?: string[];
}

/**
 * Restore the category structure from a backup snapshot.
 *
 * Safety protocol:
 * 1. Verify backup file exists and checksum matches
 * 2. Create a pre-restore safety backup
 * 3. Execute restore in a single database transaction
 *
 * Uses YouTube IDs for video lookup (never assumes internal IDs match).
 * Handles missing videos gracefully with warnings instead of failures.
 *
 * @param snapshotId - The ID of the backup snapshot to restore from
 * @returns Result object with success status, pre-restore backup ID, and any warnings
 */
export async function restoreFromSnapshot(snapshotId: number): Promise<RestoreResult> {
  // Look up the backup snapshot metadata
  const [snapshot] = await db
    .select()
    .from(backupSnapshots)
    .where(eq(backupSnapshots.id, snapshotId));

  if (!snapshot) {
    return { success: false, error: 'Backup not found' };
  }

  // Read the backup JSON file
  const filePath = path.join(BACKUP_DIR, snapshot.filename);
  let jsonString: string;
  try {
    jsonString = await fs.readFile(filePath, 'utf-8');
  } catch {
    return { success: false, error: `Backup file not found: ${snapshot.filename}` };
  }

  // Verify checksum integrity
  const checksum = createHash('sha256').update(jsonString).digest('hex');
  if (checksum !== snapshot.checksum) {
    return {
      success: false,
      error: 'Backup integrity check failed — file may be corrupted',
    };
  }

  // Parse backup data
  const backupData: BackupData = JSON.parse(jsonString);

  // Create a pre-restore safety backup first
  const preRestoreBackup = await createSnapshot('pre_restore');

  const warnings: string[] = [];
  let restoredCategories = 0;
  let restoredVideos = 0;

  // Execute restore in a single transaction
  await db.transaction(async (tx) => {
    // Step a: Clear all category-video assignments
    await tx.delete(categoryVideos);

    // Step b: Delete all non-protected categories
    await tx.delete(categories).where(eq(categories.isProtected, false));

    // Step c: Look up the protected "Uncategorised" category (if it exists)
    const [uncategorised] = await tx
      .select()
      .from(categories)
      .where(eq(categories.isProtected, true));

    // Build a video YouTube ID -> internal ID lookup map
    const allVideos = await tx.select({ id: videos.id, youtubeId: videos.youtubeId }).from(videos);
    const videoIdMap = new Map(allVideos.map(v => [v.youtubeId, v.id]));

    // Step d: Restore each category and its video assignments
    for (const backupCat of backupData.data.categories) {
      let categoryId: number;

      if (backupCat.isProtected) {
        // Protected category (e.g. "Uncategorised") — use existing row
        if (uncategorised && uncategorised.name === backupCat.name) {
          categoryId = uncategorised.id;
          // Update video count for the protected category
          await tx
            .update(categories)
            .set({ videoCount: backupCat.videos.length, updatedAt: new Date() })
            .where(eq(categories.id, categoryId));
        } else {
          // Protected category not found by name — create it
          const [newCat] = await tx.insert(categories).values({
            name: backupCat.name,
            isProtected: true,
            videoCount: backupCat.videos.length,
          }).returning();
          categoryId = newCat.id;
        }
      } else {
        // Regular category — insert new
        const [newCat] = await tx.insert(categories).values({
          name: backupCat.name,
          isProtected: false,
          videoCount: backupCat.videos.length,
        }).returning();
        categoryId = newCat.id;
      }

      restoredCategories++;

      // Restore video assignments for this category
      for (const backupVideo of backupCat.videos) {
        const videoId = videoIdMap.get(backupVideo.youtubeId);
        if (!videoId) {
          warnings.push(`Video not found in database: ${backupVideo.youtubeId} (${backupVideo.title})`);
          continue;
        }

        await tx.insert(categoryVideos).values({
          categoryId,
          videoId,
          source: backupVideo.source || 'consolidation',
        });
        restoredVideos++;
      }
    }

    // Step e: Restore ML categorizations if present
    if (backupData.data.mlCategorisations && backupData.data.mlCategorisations.length > 0) {
      // Clear existing ML categorizations
      await tx.delete(mlCategorisations);

      // Build category name -> ID lookup from the newly restored categories
      const restoredCats = await tx.select({ id: categories.id, name: categories.name }).from(categories);
      const catNameMap = new Map(restoredCats.map(c => [c.name, c.id]));

      for (const mlCat of backupData.data.mlCategorisations) {
        const videoId = videoIdMap.get(mlCat.videoYoutubeId);
        const suggestedCategoryId = catNameMap.get(mlCat.suggestedCategoryName);

        if (!videoId) {
          warnings.push(`ML categorization skipped — video not found: ${mlCat.videoYoutubeId}`);
          continue;
        }
        if (!suggestedCategoryId) {
          warnings.push(`ML categorization skipped — category not found: ${mlCat.suggestedCategoryName}`);
          continue;
        }

        const manualCategoryId = mlCat.manualCategoryName
          ? catNameMap.get(mlCat.manualCategoryName) ?? null
          : null;

        await tx.insert(mlCategorisations).values({
          videoId,
          suggestedCategoryId,
          confidence: mlCat.confidence,
          similarityScore: mlCat.similarityScore,
          acceptedAt: mlCat.acceptedAt ? new Date(mlCat.acceptedAt) : null,
          rejectedAt: mlCat.rejectedAt ? new Date(mlCat.rejectedAt) : null,
          manualCategoryId,
        });
      }
    }
  });

  return {
    success: true,
    preRestoreBackupId: preRestoreBackup.snapshotId,
    restoredCategories,
    restoredVideos,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
