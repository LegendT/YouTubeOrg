interface Playlist {
  id: number
  title: string
  itemCount: number
  youtubeId: string
}

interface PlaylistListProps {
  playlists: Playlist[]
}

export function PlaylistList({ playlists }: PlaylistListProps) {
  const watchLater = playlists.find(p => p.youtubeId.includes('WL'))

  return (
    <div className="border rounded-lg p-6 bg-white shadow">
      <h2 className="text-2xl font-semibold mb-4">
        Your Playlists ({playlists.length})
      </h2>

      {watchLater && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <h3 className="font-semibold">Watch Later</h3>
          <p className="text-lg">{watchLater.itemCount.toLocaleString()} videos</p>
        </div>
      )}

      <ul className="space-y-2 max-h-96 overflow-y-auto">
        {playlists
          .filter(p => !p.youtubeId.includes('WL'))
          .map(playlist => (
            <li key={playlist.id} className="flex justify-between border-b pb-2">
              <span className="truncate">{playlist.title}</span>
              <span className="text-gray-600">{playlist.itemCount} videos</span>
            </li>
          ))}
      </ul>
    </div>
  )
}
