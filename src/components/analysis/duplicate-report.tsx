'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { OverlapStats } from '@/types/analysis'

interface DuplicateReportProps {
  stats: OverlapStats
}

export function DuplicateReport({ stats }: DuplicateReportProps) {
  const hasDuplicates = stats.duplicateVideoCount > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Duplicate Video Analysis</CardTitle>
        <CardDescription>
          Videos appearing in multiple playlists across your library
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <div className="text-2xl font-bold">
              {stats.totalUniqueVideos.toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground">
              Total unique videos
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">
                {stats.duplicateVideoCount.toLocaleString()}
              </span>
              {hasDuplicates && (
                <Badge variant="secondary">
                  {stats.duplicationPercentage.toFixed(1)}%
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              Duplicate videos
            </div>
          </div>

          <div>
            <div className="text-2xl font-bold">
              {(stats.totalUniqueVideos - stats.duplicateVideoCount).toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground">
              Videos in single playlist only
            </div>
          </div>
        </div>

        {hasDuplicates && (
          <p className="text-sm text-muted-foreground mt-4">
            Consolidating playlists will automatically eliminate these
            duplicates, reducing your total video count.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
