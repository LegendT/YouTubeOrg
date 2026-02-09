import { getServerSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { playlists } from '@/lib/db/schema'
import { getRemainingQuota } from '@/lib/youtube/quota'
import { QuotaDisplay } from '@/components/quota-display'
import { PlaylistList } from '@/components/playlist-list'
import { SyncButton } from '@/components/sync-button'
import { EmptyState } from '@/components/ui/empty-state'
import Link from 'next/link'
import {
  ChartBar,
  VideoCamera,
  Brain,
  ClipboardText,
  Shield,
  ArrowsClockwise,
  ListDashes,
  DownloadSimple,
} from '@phosphor-icons/react/ssr'

const workflows = [
  {
    step: 1,
    title: 'Fetch YouTube Data',
    description:
      'Sync your playlists and videos from YouTube into the local database. This caches everything locally so browsing is instant and costs no API quota.',
    where: 'Use the "Sync Data" button above',
    href: null,
    icon: ArrowsClockwise,
  },
  {
    step: 2,
    title: 'Import Watch Later',
    description:
      'YouTube blocks API access to Watch Later, so import it via Google Takeout. The guide walks you through exporting your data — upload the zip or CSV and metadata is fetched automatically.',
    where: 'Import',
    href: '/import',
    icon: DownloadSimple,
  },
  {
    step: 3,
    title: 'Analyse & Consolidate Playlists',
    description:
      'Run clustering analysis on your playlists to propose a consolidated category structure. Review proposals, approve, reject, split, or merge them. Finalise when satisfied.',
    where: 'Analysis',
    href: '/analysis',
    icon: ChartBar,
  },
  {
    step: 4,
    title: 'Manage Categories',
    description:
      'Fine-tune your category structure after consolidation. Create new categories, rename or delete existing ones, and merge categories together.',
    where: 'Analysis (Management mode)',
    href: '/analysis',
    icon: ChartBar,
  },
  {
    step: 5,
    title: 'Auto-Categorise Videos',
    description:
      'Run ML categorisation to automatically assign your videos to categories using AI. The model runs entirely in your browser — no data leaves your machine.',
    where: 'ML Categorisation',
    href: '/ml-categorisation',
    icon: Brain,
  },
  {
    step: 6,
    title: 'Review ML Suggestions',
    description:
      'Review the AI\'s category suggestions video by video. Accept with "A", reject with "R", or manually recategorise. Use Bulk Accept to approve high-confidence batches quickly.',
    where: 'Review',
    href: '/ml-review',
    icon: ClipboardText,
  },
  {
    step: 7,
    title: 'Browse & Organise Videos',
    description:
      'Browse all your videos with search, sort, and filter. Select multiple videos to move or copy them between categories. Every action can be undone with Ctrl+Z.',
    where: 'Videos',
    href: '/videos',
    icon: VideoCamera,
  },
  {
    step: 8,
    title: 'Review Safety & Backups',
    description:
      'Check your backup history, review the operation log, and see pending changes before syncing. Backups are created automatically before any destructive operation. You can restore from any backup.',
    where: 'Safety',
    href: '/safety',
    icon: Shield,
  },
  {
    step: 9,
    title: 'Sync to YouTube',
    description:
      'Preview all changes (playlists to create, videos to add, old playlists to delete) with honest quota estimates. Start the sync and monitor real-time progress. The sync is quota-aware and can pause/resume across multiple days.',
    where: 'Sync',
    href: '/sync',
    icon: ArrowsClockwise,
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
    <main className="min-h-[calc(100vh-3.5rem)] bg-background">
      <div className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your YouTube data sync and view quota usage
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" role="region" aria-label="Quota and sync status">
          <QuotaDisplay used={usedQuota} total={10000} />

          <div className="border border-border rounded-lg p-6 bg-card shadow-sm flex flex-col justify-center">
            <h2 className="text-lg font-semibold text-foreground mb-4">Data Sync</h2>
            <p className="text-sm text-muted-foreground mb-4">
              {allPlaylists.length === 0
                ? 'No playlists synced yet. Click below to fetch your YouTube data.'
                : `Last synced: ${allPlaylists.length} playlists cached locally`}
            </p>
            <SyncButton />
          </div>
        </div>

        <section>
          <h2 className="text-lg font-semibold text-foreground mb-1">How to Use</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Follow these steps to organise your YouTube library. Each step builds on the previous one.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workflows.map((w) => {
              const Icon = w.icon
              return (
                <div
                  key={w.step}
                  className="border border-border rounded-lg p-5 bg-card shadow-sm flex gap-4"
                >
                  <div className="flex-shrink-0 flex items-start">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                      {w.step}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <h3 className="font-semibold text-foreground">{w.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{w.description}</p>
                    {w.href ? (
                      <Link
                        href={w.href}
                        className="text-sm font-medium text-primary hover:text-primary/80"
                      >
                        Go to {w.where} &rarr;
                      </Link>
                    ) : (
                      <span className="text-sm text-muted-foreground">{w.where}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {allPlaylists.length > 0 ? (
          <PlaylistList playlists={allPlaylists} />
        ) : (
          <EmptyState
            icon={ListDashes}
            title="No playlists synced"
            description="Sync your YouTube playlists to get started organising your video library."
            action={{ label: "Sync Playlists", href: "/sync" }}
          />
        )}
      </div>
    </main>
  )
}
