'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BackupList } from './backup-list';
import { OperationLogTable } from './operation-log-table';
import { PendingChanges } from './pending-changes';
import type { BackupSnapshotMeta, OperationLogEntry, PendingChangeSummary } from '@/types/backup';
import { HardDrive, ScrollText, Clock } from 'lucide-react';

interface SafetyDashboardProps {
  initialBackups: BackupSnapshotMeta[];
  initialOperationLog: OperationLogEntry[];
  initialOperationLogTotal: number;
  initialPendingChanges: PendingChangeSummary;
}

export function SafetyDashboard({
  initialBackups,
  initialOperationLog,
  initialOperationLogTotal,
  initialPendingChanges,
}: SafetyDashboardProps) {
  return (
    <Tabs defaultValue="backups" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="backups" className="flex items-center gap-1.5">
          <HardDrive className="h-3.5 w-3.5" />
          Backups
        </TabsTrigger>
        <TabsTrigger value="operation-log" className="flex items-center gap-1.5">
          <ScrollText className="h-3.5 w-3.5" />
          Operation Log
        </TabsTrigger>
        <TabsTrigger value="pending-changes" className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          Pending Changes
        </TabsTrigger>
      </TabsList>

      <TabsContent value="backups">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <BackupList initialBackups={initialBackups} />
        </div>
      </TabsContent>

      <TabsContent value="operation-log">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <OperationLogTable
            initialEntries={initialOperationLog}
            initialTotal={initialOperationLogTotal}
          />
        </div>
      </TabsContent>

      <TabsContent value="pending-changes">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <PendingChanges initialSummary={initialPendingChanges} />
        </div>
      </TabsContent>
    </Tabs>
  );
}
