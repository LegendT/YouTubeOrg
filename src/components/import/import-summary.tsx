import { CheckCircle } from '@phosphor-icons/react';

interface ImportSummaryProps {
  totalCount: number;
  processed: number;
  unavailable: number;
  skipped: number;
  relationshipsCreated: number;
  relationshipsSkipped: number;
}

/**
 * Completion summary card for the Watch Later CSV import.
 *
 * Shows a success header with counts for processed, unavailable,
 * skipped videos and created/skipped playlist relationships.
 */
export function ImportSummary({
  totalCount,
  processed,
  unavailable,
  skipped,
  relationshipsCreated,
  relationshipsSkipped,
}: ImportSummaryProps) {
  return (
    <div className="space-y-6">
      {/* Success header */}
      <div className="rounded-lg border border-success/20 bg-success/10 p-6">
        <div className="flex items-center gap-3">
          <CheckCircle size={28} className="text-success flex-shrink-0" weight="fill" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">Import Complete</h2>
            <p className="text-sm text-muted-foreground">
              {totalCount.toLocaleString()} videos from Watch Later CSV have been processed.
            </p>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard
          label="Videos Processed"
          value={processed}
          muted={false}
        />
        <StatCard
          label="Unavailable Videos"
          value={unavailable}
          muted={unavailable === 0}
        />
        <StatCard
          label="Skipped (Already in DB)"
          value={skipped}
          muted={skipped === 0}
        />
        <StatCard
          label="Playlist Links Created"
          value={relationshipsCreated}
          muted={false}
        />
        <StatCard
          label="Links Skipped (Duplicate)"
          value={relationshipsSkipped}
          muted={relationshipsSkipped === 0}
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  muted,
}: {
  label: string;
  value: number;
  muted: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`text-2xl font-semibold mt-1 ${
          muted ? 'text-muted-foreground' : 'text-foreground'
        }`}
      >
        {value.toLocaleString()}
      </p>
    </div>
  );
}
