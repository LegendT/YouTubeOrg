import { getServerSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { playlists } from '@/lib/db/schema'
import { getRemainingQuota } from '@/lib/youtube/quota'
import { QuotaDisplay } from '@/components/quota-display'
import { PlaylistList } from '@/components/playlist-list'
import { SyncButton } from '@/components/sync-button'

export default async function DashboardPage() {
  // Check authentication
  const session = await getServerSession()

  if (!session?.access_token || session?.error === 'RefreshAccessTokenError') {
    redirect('/api/auth/signin')
  }

  // Fetch cached data (no API calls = 0 quota cost)
  const allPlaylists = await db.select().from(playlists).orderBy(playlists.title)

  // Calculate quota usage
  const remainingQuota = await getRemainingQuota()
  const usedQuota = 10000 - remainingQuota

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <header>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Manage your YouTube data sync and view quota usage
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <QuotaDisplay used={usedQuota} total={10000} />

          <div className="border rounded-lg p-6 bg-white shadow flex flex-col justify-center">
            <h2 className="text-2xl font-semibold mb-4">Data Sync</h2>
            <p className="text-gray-600 mb-4">
              {allPlaylists.length === 0
                ? 'No playlists synced yet. Click below to fetch your YouTube data.'
                : `Last synced: ${allPlaylists.length} playlists cached locally`}
            </p>
            <SyncButton />
          </div>
        </div>

        {allPlaylists.length > 0 && (
          <PlaylistList playlists={allPlaylists} />
        )}
      </div>
    </main>
  )
}
