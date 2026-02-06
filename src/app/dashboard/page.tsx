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
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">YouTube Organizer Dashboard</h1>
          <a
            href="/api/auth/signout"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Sign Out
          </a>
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
          <div className="border rounded-lg p-6 bg-white shadow flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Ready to organize?</h2>
              <p className="text-gray-600 mt-1">
                Analyze your {allPlaylists.length} playlists and consolidate them into categories.
              </p>
            </div>
            <a
              href="/analysis"
              className="inline-flex items-center px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shrink-0"
            >
              Go to Analysis
            </a>
          </div>
        )}

        {allPlaylists.length > 0 && (
          <PlaylistList playlists={allPlaylists} />
        )}
      </div>
    </main>
  )
}
