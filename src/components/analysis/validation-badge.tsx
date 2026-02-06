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
  safe: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100',
  danger: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100',
}

const progressStyles: Record<ValidationStatus, string> = {
  safe: '[&>div]:bg-green-500',
  warning: '[&>div]:bg-yellow-500',
  danger: '[&>div]:bg-red-500',
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
        <p className="text-xs text-red-600 font-medium">
          Exceeds safe limit of 4,500 videos (YouTube maximum: 5,000)
        </p>
      )}
      {status === 'warning' && (
        <p className="text-xs text-yellow-600 font-medium">
          Approaching limit
        </p>
      )}
    </div>
  )
}
