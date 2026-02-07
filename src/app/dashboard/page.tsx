import { getServerSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { playlists } from '@/lib/db/schema'
import { getRemainingQuota } from '@/lib/youtube/quota'
import { QuotaDisplay } from '@/components/quota-display'
import { PlaylistList } from '@/components/playlist-list'
import { SyncButton } from '@/components/sync-button'
import Link from 'next/link'
import {
  BarChart3,
  Video,
  Brain,
  ClipboardCheck,
  Shield,
  RefreshCw,
} from 'lucide-react'

const workflows = [
  {
    step: 1,
    title: 'Fetch YouTube Data',
    description:
      'Sync your playlists and videos from YouTube into the local database. This caches everything locally so browsing is instant and costs no API quota.',
    where: 'Use the "Sync Data" button above',
    href: null,
    icon: RefreshCw,
  },
  {
    step: 2,
    title: 'Analyse & Consolidate Playlists',
    description:
      'Run clustering analysis on your 87 playlists to propose a consolidated category structure of ~25-35 categories. Review proposals, approve, reject, split, or merge them. Finalise when satisfied.',
    where: 'Analysis',
    href: '/analysis',
    icon: BarChart3,
  },
  {
    step: 3,
    title: 'Manage Categories',
    description:
      'Fine-tune your category structure after consolidation. Create new categories, rename or delete existing ones, and merge categories together.',
    where: 'Analysis (Management mode)',
    href: '/analysis',
    icon: BarChart3,
  },
  {
    step: 4,
    title: 'Auto-Categorise Watch Later Videos',
    description:
      'Run ML categorisation to automatically assign your Watch Later videos to categories using AI. The model runs entirely in your browser — no data leaves your machine.',
    where: 'ML Categorisation',
    href: '/ml-categorization',
    icon: Brain,
  },
  {
    step: 5,
    title: 'Review ML Suggestions',
    description:
      'Review the AI\'s category suggestions video by video. Accept with "A", reject with "R", or manually recategorise. Focus on low-confidence items first. Use arrow keys and Tab to navigate.',
    where: 'Review',
    href: '/ml-review',
    icon: ClipboardCheck,
  },
  {
    step: 6,
    title: 'Browse & Organise Videos',
    description:
      'Browse all your videos with search, sort, and filter. Select multiple videos to move or copy them between categories. Every action can be undone with Ctrl+Z.',
    where: 'Videos',
    href: '/videos',
    icon: Video,
  },
  {
    step: 7,
    title: 'Review Safety & Backups',
    description:
      'Check your backup history, review the operation log, and see pending changes before syncing. Backups are created automatically before any destructive operation. You can restore from any backup.',
    where: 'Safety',
    href: '/safety',
    icon: Shield,
  },
  {
    step: 8,
    title: 'Sync to YouTube',
    description:
      'Preview all changes (playlists to create, videos to add, old playlists to delete) with honest quota estimates. Start the sync and monitor real-time progress. The sync is quota-aware and can pause/resume across multiple days.',
    where: 'Sync',
    href: '/sync',
    icon: RefreshCw,
  },
]

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

        <section>
          <h2 className="text-2xl font-bold mb-1">How to Use</h2>
          <p className="text-gray-600 mb-4">
            Follow these steps to organise your YouTube library. Each step builds on the previous one.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workflows.map((w) => {
              const Icon = w.icon
              return (
                <div
                  key={w.step}
                  className="border rounded-lg p-5 bg-white shadow-sm flex gap-4"
                >
                  <div className="flex-shrink-0 flex items-start">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-sm font-bold">
                      {w.step}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="h-4 w-4 text-gray-500 flex-shrink-0" />
                      <h3 className="font-semibold text-gray-900">{w.title}</h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{w.description}</p>
                    {w.href ? (
                      <Link
                        href={w.href}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800"
                      >
                        Go to {w.where} &rarr;
                      </Link>
                    ) : (
                      <span className="text-sm text-gray-500">{w.where}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {allPlaylists.length > 0 && (
          <PlaylistList playlists={allPlaylists} />
        )}
      </div>
    </main>
  )
}
