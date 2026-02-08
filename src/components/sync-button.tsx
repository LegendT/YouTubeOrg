'use client'

import { useState } from 'react'
import { syncAllData } from '@/app/actions/sync-playlists'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { ArrowsClockwise } from '@phosphor-icons/react'

export function SyncButton() {
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSync() {
    setSyncing(true)
    setMessage(null)

    try {
      const result = await syncAllData()

      if (result.success) {
        setMessage(`Synced ${result.playlistCount} playlists successfully!`)
      } else if (result.partialSuccess) {
        setMessage(result.error ?? 'Partial sync completed with warnings.')
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
      {message && (
        <p className="text-sm text-muted-foreground">{message}</p>
      )}
    </div>
  )
}
