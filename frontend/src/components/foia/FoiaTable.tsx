import { FoiaRow } from './FoiaRow';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { FileText } from 'lucide-react';

interface FoiaTableProps {
  requests: any[];
  loading: boolean;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  onSort: (key: string) => void;
  onSubmit: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onViewDetail: (id: string) => void;
}

export function FoiaTable({ requests, loading, sortBy, sortDir, onSort, onSubmit, onUpdateStatus, onViewDetail }: FoiaTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="h-12 w-12" />}
        title="No FOIA requests"
        message="File your first FOIA from the News Scanner."
      />
    );
  }

  const SortHeader = ({ label, field }: { label: string; field: string }) => (
    <th
      className="px-3 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider cursor-pointer hover:text-text-secondary"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortBy === field && <span className="text-accent-cyan">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>}
      </div>
    </th>
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-surface-border">
      <table className="w-full">
        <thead className="bg-surface-tertiary">
          <tr>
            <SortHeader label="Case #" field="case_number" />
            <th className="px-3 py-3 text-left text-xs font-medium text-text-tertiary uppercase">Agency</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-text-tertiary uppercase">Incident</th>
            <SortHeader label="Status" field="status" />
            <SortHeader label="Submitted" field="submitted_at" />
            <SortHeader label="Due Date" field="due_date" />
            <th className="px-3 py-3 text-left text-xs font-medium text-text-tertiary uppercase">Cost</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-text-tertiary uppercase">Priority</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-text-tertiary uppercase w-28">Actions</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((req) => (
            <FoiaRow
              key={req.id}
              request={req}
              onSubmit={onSubmit}
              onUpdateStatus={onUpdateStatus}
              onViewDetail={onViewDetail}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
