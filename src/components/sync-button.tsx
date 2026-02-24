'use client'

import { useState } from 'react'
import { syncAllData } from '@/app/actions/sync-playlists'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { ArrowsClockwise, SignOut } from '@phosphor-icons/react'

export function SyncButton() {
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [needsReauth, setNeedsReauth] = useState(false)

  async function handleSync() {
    setSyncing(true)
    setMessage(null)
    setNeedsReauth(false)

    try {
      const result = await syncAllData()

      if (result.success) {
        setMessage(`Synced ${result.playlistCount} playlists successfully!`)
      } else if (result.partialSuccess) {
        setMessage(result.error ?? 'Partial sync completed with warnings.')
      } else if (result.error === 'INSUFFICIENT_SCOPES') {
        setNeedsReauth(true)
      } else {
        setMessage(result.error ?? 'Sync failed. Please try again.')
      }
    } catch (error: any) {
      setMessage(`Error: ${error.message}`)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={handleSync} disabled={syncing} size="lg">
        {syncing ? (
          <>
            <Spinner size={16} className="text-primary-foreground" />
            Syncing...
          </>
        ) : (
          <>
            <ArrowsClockwise weight="bold" className="h-4 w-4" />
            Sync YouTube Data
          </>
        )}
      </Button>
      {needsReauth && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 space-y-2">
          <p className="text-sm font-medium text-destructive">
            YouTube permissions missing
          </p>
          <p className="text-sm text-muted-foreground">
            Your session doesn&apos;t have the required YouTube API scopes. Sign out and back in to grant permissions.
          </p>
          <Button variant="outline" size="sm" asChild>
            <a href="/api/auth/signout">
              <SignOut weight="bold" className="h-4 w-4" />
              Sign out &amp; re-authenticate
            </a>
          </Button>
        </div>
      )}
      {message && (
        <p className="text-sm text-muted-foreground">{message}</p>
      )}
    </div>
  )
}
