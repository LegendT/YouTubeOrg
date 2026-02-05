interface QuotaDisplayProps {
  used: number
  total: number
}

export function QuotaDisplay({ used, total }: QuotaDisplayProps) {
  const remaining = total - used
  const percentage = (remaining / total) * 100

  return (
    <div className="border rounded-lg p-6 bg-white shadow">
      <h2 className="text-2xl font-semibold mb-4">API Quota</h2>
      <p className="text-lg mb-2">
        {remaining.toLocaleString()} / {total.toLocaleString()} units remaining today
      </p>
      <div className="w-full bg-gray-200 rounded-full h-4">
        <div
          className="bg-blue-600 h-4 rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-sm text-gray-600 mt-2">
        Resets daily at midnight PT
      </p>
    </div>
  )
}
