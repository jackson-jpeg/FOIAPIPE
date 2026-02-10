import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { FOIA_STATUSES } from '@/lib/constants';
import { History, ArrowRight, Filter } from 'lucide-react';
import client from '@/api/client';

interface AuditLogEntry {
  id: string;
  foia_request_id: string;
  case_number: string;
  from_status: string;
  to_status: string;
  changed_by: string;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface AuditLogResponse {
  items: AuditLogEntry[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

const PAGE_SIZE = 50;

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

      const { data } = await client.get<AuditLogResponse>(
        '/audit-logs/status-changes',
        { params }
      );

      setItems(data.items);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch (error: any) {
      const detail =
        error.response?.data?.detail || 'Failed to load audit logs';
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
      <div>
        <h1 className="heading-3 mb-2">Audit Log</h1>
        <p className="text-sm text-text-secondary">
          FOIA request status change history
        </p>
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
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={handleClearFilters}>
            Clear Filters
          </Button>
        )}
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
        <div className="overflow-x-auto rounded-lg border border-surface-border">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-border bg-surface-secondary">
                <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3">
                  Timestamp
                </th>
                <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3">
                  Case Number
                </th>
                <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3">
                  Status Change
                </th>
                <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3">
                  Changed By
                </th>
                <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3">
                  Reason
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {items.map((entry) => (
                <tr
                  key={entry.id}
                  className="hover:bg-surface-hover transition-colors"
                >
                  <td className="px-4 py-3 text-sm text-text-primary whitespace-nowrap">
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
                  <td className="px-4 py-3 text-sm text-text-secondary max-w-xs truncate">
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
          <div className="flex gap-2">
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
          </div>
        </div>
      )}
    </div>
  );
}
