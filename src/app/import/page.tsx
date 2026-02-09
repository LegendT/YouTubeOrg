import { getServerSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { ImportPageClient } from './import-page-client';

export const metadata = {
  title: 'Import - YouTube Playlist Organiser',
};

/**
 * Import page (Server Component).
 *
 * Auth-gated entry point for the Watch Later CSV import flow.
 * Delegates all interactive work to the ImportPageClient component.
 */
export default async function ImportPage() {
  const session = await getServerSession();

  if (!session?.access_token || session?.error === 'RefreshAccessTokenError') {
    redirect('/api/auth/signin');
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-8 space-y-8" aria-label="Import operations">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Import Watch Later
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Import videos from a Google Takeout export
        </p>
      </div>

      <ImportPageClient />
    </main>
  );
}
