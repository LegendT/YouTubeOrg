interface Playlist {
  id: number
  title: string
  itemCount: number | null
  youtubeId: string
}

interface PlaylistListProps {
  playlists: Playlist[]
}

export function PlaylistList({ playlists }: PlaylistListProps) {
  const watchLater = playlists.find(p => p.youtubeId.includes('WL'))

  return (
    <div className="border border-border rounded-lg p-6 bg-card shadow-sm">
      <h2 className="text-lg font-semibold text-foreground mb-4">
        Your Playlists ({playlists.length})
      </h2>

      {watchLater && (
        <div className="mb-4 p-4 bg-warning/10 border border-warning/20 rounded-lg">
          <h3 className="font-semibold text-foreground">Watch Later</h3>
          <p className="text-lg text-foreground">{(watchLater.itemCount ?? 0).toLocaleString()} videos</p>
        </div>
      )}

      <ul className="space-y-2 max-h-96 overflow-y-auto">
        {playlists
          .filter(p => !p.youtubeId.includes('WL'))
          .map(playlist => (
            <li key={playlist.id} className="flex justify-between border-b border-border pb-2">
              <span className="truncate text-foreground">{playlist.title}</span>
              <span className="text-muted-foreground">{playlist.itemCount ?? 0} videos</span>
            </li>
          ))}
      </ul>
    </div>
  )
}
