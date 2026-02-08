'use client'

import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

interface ValidationBadgeProps {
  videoCount: number
}

type ValidationStatus = 'safe' | 'warning' | 'danger'

function getStatus(videoCount: number): ValidationStatus {
  if (videoCount > 4500) return 'danger'
  if (videoCount >= 3000) return 'warning'
  return 'safe'
}

const statusStyles: Record<ValidationStatus, string> = {
  safe: 'bg-success/10 text-success border-success/20 hover:bg-success/10',
  warning: 'bg-warning/10 text-warning border-warning/20 hover:bg-warning/10',
  danger: 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/10',
}

const progressStyles: Record<ValidationStatus, string> = {
  safe: '[&>div]:bg-success',
  warning: '[&>div]:bg-warning',
  danger: '[&>div]:bg-destructive',
}

export function ValidationBadge({ videoCount }: ValidationBadgeProps) {
  const status = getStatus(videoCount)
  const percentage = Math.min((videoCount / 5000) * 100, 100)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge className={statusStyles[status]}>
          {videoCount.toLocaleString()} videos
        </Badge>
      </div>
      <div className="space-y-1">
        <Progress value={percentage} className={progressStyles[status]} />
        <p className="text-xs text-muted-foreground">
          {videoCount.toLocaleString()} / 5,000 videos
        </p>
      </div>
      {status === 'danger' && (
        <p className="text-xs text-destructive font-medium">
          Exceeds safe limit of 4,500 videos (YouTube maximum: 5,000)
        </p>
      )}
      {status === 'warning' && (
        <p className="text-xs text-warning font-medium">
          Approaching limit
        </p>
      )}
    </div>
  )
}
