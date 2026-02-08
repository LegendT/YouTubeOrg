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
import type { BackupData, BackupCategory, BackupCategoryVideo, BackupMLCategorization } from '@/types/backup';

const BACKUP_DIR = path.join(process.cwd(), 'backups');

/**
 * Gather all data for the backup snapshot.
 * Uses stable identifiers (YouTube IDs, category names) instead of internal serial IDs.
 */
async function gatherSnapshotData(scope: string): Promise<BackupData['data']> {
  // For category-specific scope (e.g. 'category:Gaming'), gather only that category
  const isCategoryScope = scope.startsWith('category:');
  const scopeCategoryName = isCategoryScope ? scope.slice('category:'.length) : null;

  // Fetch categories (optionally filtered by scope)
  const allCategories = isCategoryScope
    ? await db.select().from(categories).where(eq(categories.name, scopeCategoryName!))
    : await db.select().from(categories);

  // Build a map of categoryId -> category info for quick lookup
  const categoryMap = new Map(allCategories.map(c => [c.id, c]));
  const categoryIds = allCategories.map(c => c.id);

  // Fetch all category-video assignments with video details
  const assignments = await db
    .select({
      categoryId: categoryVideos.categoryId,
      youtubeId: videos.youtubeId,
      title: videos.title,
      source: categoryVideos.source,
    })
    .from(categoryVideos)
    .innerJoin(videos, eq(categoryVideos.videoId, videos.id));

  // Group videos by category
  const videosByCategory = new Map<number, BackupCategoryVideo[]>();
  for (const row of assignments) {
    if (!categoryIds.includes(row.categoryId)) continue;
    const existing = videosByCategory.get(row.categoryId) ?? [];
    existing.push({
      youtubeId: row.youtubeId,
      title: row.title,
      source: row.source ?? 'consolidation',
    });
    videosByCategory.set(row.categoryId, existing);
  }

  // Build backup categories using names (not IDs) as identifiers
  const backupCategories: BackupCategory[] = allCategories.map(cat => ({
    name: cat.name,
    isProtected: cat.isProtected,
    videos: videosByCategory.get(cat.id) ?? [],
  }));

  // Fetch ML categorizations with video YouTube IDs and category names
  const mlRows = await db
    .select({
      videoYoutubeId: videos.youtubeId,
      suggestedCategoryName: categories.name,
      confidence: mlCategorisations.confidence,
      similarityScore: mlCategorisations.similarityScore,
      acceptedAt: mlCategorisations.acceptedAt,
      rejectedAt: mlCategorisations.rejectedAt,
      manualCategoryId: mlCategorisations.manualCategoryId,
    })
    .from(mlCategorisations)
    .innerJoin(videos, eq(mlCategorisations.videoId, videos.id))
    .innerJoin(categories, eq(mlCategorisations.suggestedCategoryId, categories.id));

  // Resolve manualCategoryId to category name where present
  const backupMLCategorizations: BackupMLCategorization[] = mlRows.map(row => {
    let manualCategoryName: string | null = null;
    if (row.manualCategoryId !== null) {
      const manualCat = categoryMap.get(row.manualCategoryId);
      manualCategoryName = manualCat?.name ?? null;
    }
    return {
      videoYoutubeId: row.videoYoutubeId,
      suggestedCategoryName: row.suggestedCategoryName,
      confidence: row.confidence,
      similarityScore: row.similarityScore,
      acceptedAt: row.acceptedAt?.toISOString() ?? null,
      rejectedAt: row.rejectedAt?.toISOString() ?? null,
      manualCategoryName,
    };
  });

  // Count unique videos across all categories
  const uniqueVideoIds = new Set<string>();
  for (const cat of backupCategories) {
    for (const v of cat.videos) {
      uniqueVideoIds.add(v.youtubeId);
    }
  }

  return {
    categories: backupCategories,
    mlCategorisations: backupMLCategorizations,
    metadata: {
      totalCategories: backupCategories.length,
      totalVideos: uniqueVideoIds.size,
      totalCategorizations: backupMLCategorizations.length,
    },
  };
}

/**
 * Create a full backup snapshot of all category/video/ML data.
 *
 * Writes a JSON file to the backups/ directory and records metadata in the
 * backupSnapshots table. Uses stable identifiers (YouTube IDs, category names)
 * instead of internal serial IDs for portability.
 *
 * @param trigger - What triggered this backup (e.g. 'manual', 'pre_sync', 'pre_restore')
 * @param scope - Scope of the backup ('full' or 'category:CategoryName')
 * @returns Snapshot metadata including ID, filename, and creation time
 */
export async function createSnapshot(
  trigger: string,
  scope: string = 'full'
): Promise<{ snapshotId: number; filename: string; createdAt: Date }> {
  const data = await gatherSnapshotData(scope);

  const now = new Date();
  const backupData: BackupData = {
    version: '1.0',
    createdAt: now.toISOString(),
    trigger,
    data,
  };

  // Generate safe filename: replace colons and dots with dashes for filesystem compatibility
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const filename = `backup-${trigger}-${timestamp}.json`;

  // Write JSON file
  const jsonString = JSON.stringify(backupData, null, 2);
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  await fs.writeFile(path.join(BACKUP_DIR, filename), jsonString, 'utf-8');

  // Compute SHA-256 checksum of the JSON content
  const checksum = createHash('sha256').update(jsonString).digest('hex');

  // Record metadata in database
  const [snapshot] = await db.insert(backupSnapshots).values({
    filename,
    trigger,
    scope,
    entityCount: data.metadata.totalCategories + data.metadata.totalVideos,
    fileSizeBytes: Buffer.byteLength(jsonString, 'utf-8'),
    checksum,
  }).returning();

  return {
    snapshotId: snapshot.id,
    filename: snapshot.filename,
    createdAt: snapshot.createdAt,
  };
}
