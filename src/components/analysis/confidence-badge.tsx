'use client'

import type { ConfidenceLevel } from '@/types/analysis'
import { Badge } from '@/components/ui/badge'

interface ConfidenceBadgeProps {
  score: number
  level: ConfidenceLevel
  reason: string
}

const levelStyles: Record<ConfidenceLevel, string> = {
  HIGH: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100',
  MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100',
  LOW: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100',
}

export function ConfidenceBadge({ score, level, reason }: ConfidenceBadgeProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Badge className={levelStyles[level]}>
          {level} ({score}%)
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">{reason}</p>
    </div>
  )
}
