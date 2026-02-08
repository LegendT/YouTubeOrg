import { listBackups } from '@/app/actions/backup';
import { getOperationLog, getPendingChanges } from '@/app/actions/operation-log';
import { SafetyDashboard } from '@/components/safety/safety-dashboard';

export const metadata = {
  title: 'Safety & Archives - YouTube Playlist Organiser',
};

/**
 * Safety & Archives page (Server Component).
 *
 * Fetches initial data for backups, operation log, and pending changes,
 * then delegates to SafetyDashboard client component for tabbed display.
 */
export default async function SafetyPage() {
  const [backups, operationLog, pendingChanges] = await Promise.all([
    listBackups(),
    getOperationLog(20, 0),
    getPendingChanges(),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Safety & Archives</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage backups, view the operation log, and review pending changes before syncing.
        </p>
      </div>

      <SafetyDashboard
        initialBackups={backups}
        initialOperationLog={operationLog.entries}
        initialOperationLogTotal={operationLog.total}
        initialPendingChanges={pendingChanges}
      />
    </div>
  );
}
