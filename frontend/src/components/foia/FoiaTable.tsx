import { FoiaRow } from './FoiaRow';
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
      <div className="overflow-x-auto rounded-xl border border-surface-border shadow-card">
        <table className="w-full">
          <thead className="bg-surface-tertiary/50">
            <tr>
              <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-text-tertiary">Case #</th>
              <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-text-tertiary">Agency</th>
              <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-text-tertiary">Incident</th>
              <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-text-tertiary">Status</th>
              <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-text-tertiary">Submitted</th>
              <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-text-tertiary">Due Date</th>
              <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-text-tertiary">Cost</th>
              <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-text-tertiary">Priority</th>
              <th className="px-4 py-4 text-left text-xs font-medium uppercase tracking-wider text-text-tertiary w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} className="border-b border-surface-border/30">
                <td className="px-4 py-4"><div className="shimmer h-3.5 w-24 rounded font-mono" /></td>
                <td className="px-4 py-4"><div className="shimmer h-3.5 w-32 rounded" /></td>
                <td className="px-4 py-4"><div className="shimmer h-3.5 w-40 rounded" /></td>
                <td className="px-4 py-4"><div className="shimmer h-5 w-20 rounded-full" /></td>
                <td className="px-4 py-4"><div className="shimmer h-3.5 w-24 rounded" /></td>
                <td className="px-4 py-4"><div className="shimmer h-3.5 w-24 rounded" /></td>
                <td className="px-4 py-4"><div className="shimmer h-3.5 w-16 rounded" /></td>
                <td className="px-4 py-4"><div className="flex gap-0.5"><div className="shimmer h-3 w-3 rounded-full" /><div className="shimmer h-3 w-3 rounded-full" /><div className="shimmer h-3 w-3 rounded-full" /></div></td>
                <td className="px-4 py-4"><div className="shimmer h-8 w-16 rounded" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="h-10 w-10" />}
        title="No FOIA requests"
        message="File your first FOIA from the News Scanner."
      />
    );
  }

  const SortHeader = ({ label, field }: { label: string; field: string }) => (
    <th
      className="px-3 py-2.5 text-left text-2xs font-medium text-text-tertiary cursor-pointer transition-colors hover:text-text-secondary"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortBy === field && <span className="text-accent-primary">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>}
      </div>
    </th>
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-surface-border shadow-card">
      <table className="w-full">
        <thead className="bg-surface-tertiary/50">
          <tr>
            <SortHeader label="Case #" field="case_number" />
            <th className="px-3 py-2.5 text-left text-2xs font-medium text-text-tertiary">Agency</th>
            <th className="px-3 py-2.5 text-left text-2xs font-medium text-text-tertiary">Incident</th>
            <SortHeader label="Status" field="status" />
            <SortHeader label="Submitted" field="submitted_at" />
            <SortHeader label="Due Date" field="due_date" />
            <th className="px-3 py-2.5 text-left text-2xs font-medium text-text-tertiary">Cost</th>
            <th className="px-3 py-2.5 text-left text-2xs font-medium text-text-tertiary">Priority</th>
            <th className="px-3 py-2.5 text-left text-2xs font-medium text-text-tertiary w-24">Actions</th>
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
