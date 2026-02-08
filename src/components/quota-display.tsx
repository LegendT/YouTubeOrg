interface QuotaDisplayProps {
  used: number
  total: number
}

export function QuotaDisplay({ used, total }: QuotaDisplayProps) {
  const remaining = total - used
  const percentage = (remaining / total) * 100

  // Colour based on remaining quota
  const barColour =
    percentage > 50
      ? 'bg-success'
      : percentage > 20
        ? 'bg-warning'
        : 'bg-destructive'

  const textColour =
    percentage > 50
      ? 'text-success'
      : percentage > 20
        ? 'text-warning'
        : 'text-destructive'

  return (
    <div className="border border-border rounded-lg p-6 bg-card shadow-sm">
      <h2 className="text-lg font-semibold text-foreground mb-4">API Quota</h2>
      <p className="text-lg text-foreground mb-2">
        <span className={textColour}>{remaining.toLocaleString()}</span> / {total.toLocaleString()} units remaining today
      </p>
      <div className="w-full bg-muted rounded-full h-4">
        <div
          className={`${barColour} h-4 rounded-full transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-sm text-muted-foreground mt-2">
        (Resets daily at 8am GMT / midnight PT)
      </p>
    </div>
  )
}
