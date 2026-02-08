import { CircleNotch } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface SpinnerProps {
  className?: string
  size?: number
}

export function Spinner({ className, size = 20 }: SpinnerProps) {
  return (
    <CircleNotch
      weight="bold"
      className={cn('animate-spin text-muted-foreground', className)}
      size={size}
    />
  )
}
