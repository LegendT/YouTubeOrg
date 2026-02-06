'use client'

import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  ColumnDef,
  flexRender,
  ColumnFiltersState,
} from '@tanstack/react-table'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { VideoDetail } from '@/types/analysis'

interface VideoListPaginatedProps {
  videos: VideoDetail[]
  sourcePlaylists: Array<{ id: number; title: string }>
}

function formatDuration(isoDuration?: string): string {
  if (!isoDuration) return '--'
  // Parse ISO 8601 duration: PT1H2M3S, PT15M33S, PT45S, etc.
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return isoDuration
  const hours = parseInt(match[1] || '0', 10)
  const minutes = parseInt(match[2] || '0', 10)
  const seconds = parseInt(match[3] || '0', 10)
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function formatRelativeDate(date?: Date | string): string {
  if (!date) return '--'
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 1) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 30) return `${diffDays} days ago`
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    return `${months} month${months > 1 ? 's' : ''} ago`
  }
  const years = Math.floor(diffDays / 365)
  return `${years} year${years > 1 ? 's' : ''} ago`
}

export function VideoListPaginated({
  videos,
  sourcePlaylists,
}: VideoListPaginatedProps) {
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [pageSize, setPageSize] = useState(50)

  // Build a map for quick playlist lookup
  const playlistMap = useMemo(() => {
    const map = new Map<number, string>()
    for (const p of sourcePlaylists) {
      map.set(p.id, p.title)
    }
    return map
  }, [sourcePlaylists])

  const columns = useMemo<ColumnDef<VideoDetail>[]>(
    () => [
      {
        id: 'thumbnail',
        header: '',
        cell: ({ row }) => {
          const v = row.original
          return v.thumbnailUrl ? (
            <img
              src={v.thumbnailUrl}
              alt={v.title}
              className="w-[120px] h-[68px] object-cover rounded"
              loading="lazy"
            />
          ) : (
            <div className="w-[120px] h-[68px] bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
              No thumbnail
            </div>
          )
        },
        size: 130,
        enableGlobalFilter: false,
      },
      {
        accessorKey: 'title',
        header: 'Title',
        cell: ({ row }) => {
          const v = row.original
          return (
            <a
              href={`https://www.youtube.com/watch?v=${v.youtubeId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium hover:underline text-foreground line-clamp-2"
            >
              {v.title}
            </a>
          )
        },
        enableGlobalFilter: true,
      },
      {
        accessorKey: 'duration',
        header: 'Duration',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {formatDuration(row.original.duration)}
          </span>
        ),
        size: 80,
        enableGlobalFilter: false,
      },
      {
        accessorKey: 'channelName',
        header: 'Channel',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground line-clamp-1">
            {row.original.channelName || '--'}
          </span>
        ),
        size: 150,
        enableGlobalFilter: false,
      },
      {
        accessorKey: 'publishedAt',
        header: 'Published',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {formatRelativeDate(row.original.publishedAt)}
          </span>
        ),
        size: 120,
        enableGlobalFilter: false,
      },
      {
        id: 'sourcePlaylist',
        header: 'Source',
        accessorFn: (row) => row.sourcePlaylistId,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground line-clamp-1">
            {playlistMap.get(row.original.sourcePlaylistId) || 'Unknown'}
          </span>
        ),
        filterFn: (row, _columnId, filterValue) => {
          if (!filterValue || filterValue === 'all') return true
          return row.original.sourcePlaylistId === Number(filterValue)
        },
        size: 150,
        enableGlobalFilter: false,
      },
    ],
    [playlistMap]
  )

  const table = useReactTable({
    data: videos,
    columns,
    state: {
      globalFilter,
      columnFilters,
      pagination: {
        pageIndex: 0,
        pageSize: pageSize === -1 ? videos.length : pageSize,
      },
    },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    autoResetPageIndex: true,
  })

  const currentPage = table.getState().pagination.pageIndex
  const totalPages = table.getPageCount()

  return (
    <div className="space-y-3">
      {/* Controls: search, playlist filter, page size */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search videos by title..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="flex h-8 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-64"
        />
        <select
          value={
            (columnFilters.find((f) => f.id === 'sourcePlaylist')
              ?.value as string) || 'all'
          }
          onChange={(e) => {
            const val = e.target.value
            setColumnFilters((prev) => {
              const others = prev.filter((f) => f.id !== 'sourcePlaylist')
              if (val === 'all') return others
              return [...others, { id: 'sourcePlaylist', value: val }]
            })
          }}
          className="flex h-8 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm"
        >
          <option value="all">All playlists</option>
          {sourcePlaylists.map((p) => (
            <option key={p.id} value={String(p.id)}>
              {p.title}
            </option>
          ))}
        </select>
        <select
          value={pageSize}
          onChange={(e) => {
            const val = e.target.value
            setPageSize(val === 'all' ? -1 : Number(val))
            table.setPageIndex(0)
          }}
          className="flex h-8 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm"
        >
          <option value={50}>50 per page</option>
          <option value={100}>100 per page</option>
          <option value={250}>250 per page</option>
          <option value="all">All</option>
        </select>
        <span className="text-xs text-muted-foreground ml-auto">
          {table.getFilteredRowModel().rows.length} videos
        </span>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No videos found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination controls */}
      {pageSize !== -1 && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {currentPage + 1} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
