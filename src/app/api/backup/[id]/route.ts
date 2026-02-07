import { promises as fs } from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { backupSnapshots } from '@/lib/db/schema';

/**
 * GET /api/backup/[id]
 *
 * Serves a backup JSON file as a downloadable attachment.
 * Looks up the backup snapshot by ID, reads the file from disk,
 * and returns it with Content-Disposition: attachment header.
 *
 * Returns:
 * - 400 if ID is not a valid integer
 * - 404 if backup not found in database or file missing from disk
 * - 200 with JSON content and download headers on success
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idParam } = await params;
  const id = parseInt(idParam, 10);

  if (isNaN(id)) {
    return new Response('Invalid backup ID', { status: 400 });
  }

  // Look up backup metadata in database
  const [snapshot] = await db
    .select()
    .from(backupSnapshots)
    .where(eq(backupSnapshots.id, id));

  if (!snapshot) {
    return new Response('Backup not found', { status: 404 });
  }

  // Read the backup JSON file from disk
  const filePath = path.join(process.cwd(), 'backups', snapshot.filename);
  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch {
    return new Response('Backup file missing from disk', { status: 404 });
  }

  return new Response(content, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${snapshot.filename}"`,
    },
  });
}
