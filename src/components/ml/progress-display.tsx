'use client';

interface ProgressDisplayProps {
  current: number;
  total: number;
  percentage: number;
  status: string;
}

export function ProgressDisplay({ current, total, percentage, status }: ProgressDisplayProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm text-gray-700">
        <span className="font-medium">{status}</span>
        <span className="text-gray-500">
          {current} / {total} ({percentage}%)
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
