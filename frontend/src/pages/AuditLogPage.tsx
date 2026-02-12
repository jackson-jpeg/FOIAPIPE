import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { FOIA_STATUSES } from '@/lib/constants';
import { History, ArrowRight, Filter, Download, ChevronUp, ChevronDown } from 'lucide-react';
import { getStatusChanges, type AuditLogEntry } from '@/api/audit';

const PAGE_SIZE = 50;

type SortField = 'created_at' | 'case_number' | 'changed_by';
type SortDir = 'asc' | 'desc';

function SortableHeader({
  label,
  field,
  sortBy,
  sortDir,
  onSort,
}: {
  label: string;
  field: SortField;
  sortBy: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
}) {
  const isActive = sortBy === field;
  return (
    <th
      className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3 cursor-pointer select-none hover:text-text-primary transition-colors"
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && (
          sortDir === 'asc'
            ? <ChevronUp className="h-3 w-3 text-accent-primary" />
            : <ChevronDown className="h-3 w-3 text-accent-primary" />
        )}
      </span>
    </th>
  );
}

export function AuditLogPage() {
  const { addToast } = useToast();

  const [items, setItems] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [caseNumber, setCaseNumber] = useState('');
  const [changedBy, setChangedBy] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Sorting (client-side on loaded page)
  const [sortBy, setSortBy] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {
        page,
        page_size: PAGE_SIZE,
      };
      if (caseNumber.trim()) params.case_number = caseNumber.trim();
      if (changedBy.trim()) params.changed_by = changedBy.trim();
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const data = await getStatusChanges(params);

      setItems(data.items);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch (error: any) {
      const detail = error.response?.data?.detail || 'Failed to load audit logs';
      addToast({ type: 'error', title: 'Error', message: detail });
    } finally {
      setLoading(false);
    }
  }, [page, caseNumber, changedBy, dateFrom, dateTo, addToast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleClearFilters = () => {
    setCaseNumber('');
    setChangedBy('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const hasFilters =
    caseNumber.trim() !== '' ||
    changedBy.trim() !== '' ||
    dateFrom !== '' ||
    dateTo !== '';

  // ── Sorting ───────────────────────────────────────────────────────────

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir(field === 'created_at' ? 'desc' : 'asc');
    }
  };

  const sortedItems = [...items].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortBy === 'created_at') {
      return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
    }
    if (sortBy === 'case_number') {
      return a.case_number.localeCompare(b.case_number) * dir;
    }
    if (sortBy === 'changed_by') {
      return a.changed_by.localeCompare(b.changed_by) * dir;
    }
    return 0;
  });

  // ── CSV Export ────────────────────────────────────────────────────────

  const handleExportCsv = () => {
    if (items.length === 0) return;

    const headers = ['Timestamp', 'Case Number', 'From Status', 'To Status', 'Changed By', 'Reason'];
    const rows = sortedItems.map((entry) => [
      new Date(entry.created_at).toISOString(),
      entry.case_number,
      entry.from_status,
      entry.to_status,
      entry.changed_by,
      (entry.reason || '').replace(/"/g, '""'),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `audit_log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    addToast({ type: 'success', title: 'CSV exported' });
  };

  // ── Helpers ───────────────────────────────────────────────────────────

  const formatTimestamp = (iso: string): string => {
    const date = new Date(iso);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getStatusBadge = (status: string) => {
    const info = FOIA_STATUSES[status];
    const label = info?.label || status;
    const variant = (info?.variant || 'default') as
      | 'success'
      | 'warning'
      | 'danger'
      | 'info'
      | 'purple'
      | 'default';
    return (
      <Badge variant={variant} size="sm">
        {label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="heading-3 mb-2">Audit Log</h1>
          <p className="text-sm text-text-secondary">
            FOIA request status change history
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleExportCsv}
          disabled={items.length === 0}
          icon={<Download className="h-4 w-4" />}
        >
          Export CSV
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-52">
          <Input
            placeholder="Case number..."
            value={caseNumber}
            onChange={(e) => {
              setCaseNumber(e.target.value);
              setPage(1);
            }}
            icon={<Filter className="h-4 w-4" />}
          />
        </div>
        <div className="w-44">
          <Input
            placeholder="Changed by..."
            value={changedBy}
            onChange={(e) => {
              setChangedBy(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-44">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              placeholder="From date"
            />
          </div>
          <span className="text-xs text-text-quaternary">to</span>
          <div className="w-44">
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              placeholder="To date"
            />
          </div>
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={handleClearFilters}>
            Clear Filters
          </Button>
        )}
        <span className="ml-auto text-xs text-text-tertiary tabular-nums">
          {total} {total === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<History className="h-8 w-8" />}
          title="No audit log entries"
          message={
            hasFilters
              ? 'No status changes match the current filters. Try adjusting your search criteria.'
              : 'No FOIA status changes have been recorded yet.'
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-surface-border/50 bg-surface-secondary">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-border/50 bg-surface-tertiary/30">
                <SortableHeader label="Timestamp" field="created_at" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Case Number" field="case_number" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3">
                  Status Change
                </th>
                <SortableHeader label="Changed By" field="changed_by" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3">
                  Reason
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/30">
              {sortedItems.map((entry) => (
                <tr
                  key={entry.id}
                  className="hover:bg-surface-hover transition-colors"
                >
                  <td className="px-4 py-3 text-sm text-text-primary whitespace-nowrap tabular-nums">
                    {formatTimestamp(entry.created_at)}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-primary font-mono">
                    {entry.case_number}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-primary">
                    <span className="inline-flex items-center gap-2">
                      {getStatusBadge(entry.from_status)}
                      <ArrowRight className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
                      {getStatusBadge(entry.to_status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-primary">
                    {entry.changed_by}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-secondary max-w-xs truncate" title={entry.reason || undefined}>
                    {entry.reason || '\u2014'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-tertiary tabular-nums">
            Page {page} of {totalPages} ({total} total)
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(1)}
            >
              First
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
            >
              Last
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
