import { getServerSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { getSyncPreview, getSyncProgress } from '@/app/actions/sync';
import { SyncPageClient } from './sync-page-client';

export const metadata = {
  title: 'Sync - YouTube Playlist Organiser',
};

/**
 * Sync page (Server Component).
 *
 * Fetches initial preview and job state, then delegates to the
 * SyncPageClient component for interactive sync control.
 */
export default async function SyncPage() {
  // Check authentication
  const session = await getServerSession();

  if (!session?.access_token || session?.error === 'RefreshAccessTokenError') {
    redirect('/api/auth/signin');
  }

  // Fetch initial data in parallel
  const [previewResult, progressResult] = await Promise.all([
    getSyncPreview(),
    getSyncProgress(),
  ]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Synchronise to YouTube</h1>
        <p className="text-sm text-gray-500 mt-1">
          Push your approved category structure to YouTube as playlists.
        </p>
      </div>

      <SyncPageClient
        initialPreview={previewResult.success ? (previewResult.preview ?? null) : null}
        initialJob={progressResult.success ? (progressResult.job ?? null) : null}
        previewError={!previewResult.success ? previewResult.error : undefined}
      />
    </div>
  );
}
