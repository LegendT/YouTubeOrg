'use client'

import type { ConfidenceLevel } from '@/types/analysis'
import { Badge } from '@/components/ui/badge'

interface ConfidenceBadgeProps {
  score: number
  level: ConfidenceLevel
  reason: string
}

const levelStyles: Record<ConfidenceLevel, string> = {
  HIGH: 'bg-success/10 text-success border-success/20 hover:bg-success/10',
  MEDIUM: 'bg-warning/10 text-warning border-warning/20 hover:bg-warning/10',
  LOW: 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/10',
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
