'use client'

import { useState } from 'react'
import { syncAllData } from '@/app/actions/sync-playlists'

export function SyncButton() {
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSync() {
    setSyncing(true)
    setMessage(null)

    try {
      const result = await syncAllData()

      if (result.success) {
        setMessage(`✓ Synced ${result.playlistCount} playlists successfully!`)
      } else if (result.partialSuccess) {
        setMessage(`⚠️ ${result.error}`)
      }
    } catch (error: any) {
      setMessage(`✗ Error: ${error.message}`)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleSync}
        disabled={syncing}
        className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition"
      >
        {syncing ? 'Syncing...' : 'Sync YouTube Data'}
      </button>
      {message && (
        <p className="text-sm">{message}</p>
      )}
    </div>
  )
}
