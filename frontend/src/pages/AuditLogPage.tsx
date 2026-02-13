import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { FOIA_STATUSES } from '@/lib/constants';
import {
  History,
  ArrowRight,
  Filter,
  Download,
  ChevronUp,
  ChevronDown,
  Shield,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import {
  getStatusChanges,
  listAuditLogs,
  getAuditSummary,
  getSecurityEvents,
  type AuditLogEntry,
  type GeneralAuditLogEntry,
  type AuditSummary,
  type SecurityEventsResponse,
} from '@/api/audit';

const PAGE_SIZE = 50;

type ActiveTab = 'status_changes' | 'all_events' | 'security';
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
  const [activeTab, setActiveTab] = useState<ActiveTab>('status_changes');

  // Status Changes state
  const [items, setItems] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters for status changes
  const [caseNumber, setCaseNumber] = useState('');
  const [changedBy, setChangedBy] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Sorting
  const [sortBy, setSortBy] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // All Events state
  const [allEvents, setAllEvents] = useState<GeneralAuditLogEntry[]>([]);
  const [allEventsTotal, setAllEventsTotal] = useState(0);
  const [allEventsPages, setAllEventsPages] = useState(0);
  const [allEventsPage, setAllEventsPage] = useState(1);
  const [allEventsLoading, setAllEventsLoading] = useState(false);

  // Summary state
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Security state
  const [security, setSecurity] = useState<SecurityEventsResponse | null>(null);
  const [securityLoading, setSecurityLoading] = useState(false);

  // ── Fetch status changes ─────────────────────────────────────────────
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
    if (activeTab === 'status_changes') fetchLogs();
  }, [fetchLogs, activeTab]);

  // ── Fetch all events ─────────────────────────────────────────────────
  const fetchAllEvents = useCallback(async () => {
    setAllEventsLoading(true);
    try {
      const data = await listAuditLogs({ page: allEventsPage, page_size: PAGE_SIZE });
      setAllEvents(data.items);
      setAllEventsTotal(data.total);
      setAllEventsPages(data.total_pages);
    } catch {
      addToast({ type: 'error', title: 'Failed to load events' });
    } finally {
      setAllEventsLoading(false);
    }
  }, [allEventsPage, addToast]);

  useEffect(() => {
    if (activeTab === 'all_events') {
      fetchAllEvents();
      if (!summary) {
        setSummaryLoading(true);
        getAuditSummary(30).then(setSummary).catch(() => {}).finally(() => setSummaryLoading(false));
      }
    }
  }, [activeTab, fetchAllEvents, summary]);

  // ── Fetch security events ────────────────────────────────────────────
  useEffect(() => {
    if (activeTab === 'security' && !security) {
      setSecurityLoading(true);
      getSecurityEvents(7)
        .then(setSecurity)
        .catch(() => addToast({ type: 'error', title: 'Failed to load security events' }))
        .finally(() => setSecurityLoading(false));
    }
  }, [activeTab, security, addToast]);

  // ── Handlers ─────────────────────────────────────────────────────────
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

  const tabs: { key: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { key: 'status_changes', label: 'FOIA Status Changes', icon: <History className="h-3.5 w-3.5" /> },
    { key: 'all_events', label: 'All Events', icon: <Activity className="h-3.5 w-3.5" /> },
    { key: 'security', label: 'Security', icon: <Shield className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="heading-3">Audit Log</h1>
        </div>
        {activeTab === 'status_changes' && (
          <Button
            variant="outline"
            onClick={handleExportCsv}
            disabled={items.length === 0}
            icon={<Download className="h-4 w-4" />}
          >
            Export CSV
          </Button>
        )}
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 border-b border-glass-border">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`inline-flex items-center gap-2 px-4 pb-3 text-sm font-medium transition-all border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'text-accent-primary border-accent-primary'
                : 'text-text-tertiary border-transparent hover:text-text-primary hover:border-surface-border'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Status Changes Tab ──────────────────────────────────────────── */}
      {activeTab === 'status_changes' && (
        <>
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
            <div className="overflow-x-auto glass-2 rounded-lg">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-glass-border">
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
                <tbody className="divide-y divide-glass-border">
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
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(1)}>First</Button>
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>Last</Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── All Events Tab ──────────────────────────────────────────────── */}
      {activeTab === 'all_events' && (
        <>
          {/* Summary Cards */}
          {summaryLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="sm" />
            </div>
          ) : summary && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass-2 rounded-lg p-4">
                <p className="text-xs text-text-tertiary uppercase tracking-wider mb-1">Total Events</p>
                <p className="text-2xl font-bold text-text-primary tabular-nums">{summary.total_events.toLocaleString()}</p>
                <p className="text-xs text-text-quaternary mt-1">Last {summary.period_days} days</p>
              </div>
              <div className="glass-2 rounded-lg p-4">
                <p className="text-xs text-text-tertiary uppercase tracking-wider mb-1">Success Rate</p>
                <p className="text-2xl font-bold text-emerald-400 tabular-nums">{summary.success_rate}%</p>
                <p className="text-xs text-text-quaternary mt-1">
                  {summary.success_count.toLocaleString()} / {summary.total_events.toLocaleString()}
                </p>
              </div>
              <div className="glass-2 rounded-lg p-4">
                <p className="text-xs text-text-tertiary uppercase tracking-wider mb-1">Failures</p>
                <p className="text-2xl font-bold text-red-400 tabular-nums">{summary.failure_count.toLocaleString()}</p>
                <p className="text-xs text-text-quaternary mt-1">Last {summary.period_days} days</p>
              </div>
              <div className="glass-2 rounded-lg p-4">
                <p className="text-xs text-text-tertiary uppercase tracking-wider mb-1">Top Action</p>
                <p className="text-lg font-bold text-text-primary truncate">
                  {Object.keys(summary.top_actions)[0]?.replace(/_/g, ' ') || 'N/A'}
                </p>
                <p className="text-xs text-text-quaternary mt-1">
                  {Object.values(summary.top_actions)[0]?.toLocaleString() || 0} events
                </p>
              </div>
            </div>
          )}

          {/* Top Actions & Top Users */}
          {summary && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card title="Top Actions">
                <div className="space-y-2">
                  {Object.entries(summary.top_actions).slice(0, 8).map(([action, count]) => (
                    <div key={action} className="flex items-center justify-between">
                      <span className="text-sm text-text-primary">{action.replace(/_/g, ' ')}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 rounded-full bg-surface-tertiary overflow-hidden">
                          <div
                            className="h-full rounded-full bg-accent-primary"
                            style={{ width: `${(count / Math.max(...Object.values(summary.top_actions))) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-text-tertiary tabular-nums w-10 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
              {summary.recent_failures.length > 0 && (
                <Card title="Recent Failures">
                  <div className="space-y-2">
                    {summary.recent_failures.map((fail, i) => (
                      <div key={i} className="flex items-start gap-3 rounded-lg px-3 py-2 -mx-3 bg-red-500/5 border border-red-500/10">
                        <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-text-primary">{fail.action.replace(/_/g, ' ')}</p>
                          <p className="text-xs text-text-tertiary truncate">{fail.error_message || 'No error message'}</p>
                          <p className="text-2xs text-text-quaternary mt-0.5">{fail.user} &middot; {formatTimestamp(fail.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* Events Table */}
          {allEventsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : allEvents.length === 0 ? (
            <EmptyState
              icon={<Activity className="h-8 w-8" />}
              title="No events recorded"
              message="System events will appear here as actions are performed."
            />
          ) : (
            <div className="overflow-x-auto glass-2 rounded-lg">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-glass-border">
                    <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3">Timestamp</th>
                    <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3">Action</th>
                    <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3">User</th>
                    <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3">Resource</th>
                    <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-4 py-3">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-glass-border">
                  {allEvents.map((event) => (
                    <tr key={event.id} className="hover:bg-surface-hover transition-colors">
                      <td className="px-4 py-3 text-sm text-text-primary whitespace-nowrap tabular-nums">
                        {formatTimestamp(event.created_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-primary">
                        <Badge variant="default" size="sm">{event.action.replace(/_/g, ' ')}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-primary">{event.user}</td>
                      <td className="px-4 py-3 text-sm text-text-secondary font-mono text-xs">
                        {event.resource_type && (
                          <span>{event.resource_type}{event.resource_id ? `:${event.resource_id.slice(0, 8)}` : ''}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {event.success ? (
                          <CheckCircle className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-400" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-quaternary font-mono">{event.ip_address || '\u2014'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {allEventsPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-tertiary tabular-nums">
                Page {allEventsPage} of {allEventsPages} ({allEventsTotal} total)
              </span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" disabled={allEventsPage <= 1} onClick={() => setAllEventsPage(1)}>First</Button>
                <Button variant="outline" size="sm" disabled={allEventsPage <= 1} onClick={() => setAllEventsPage((p) => p - 1)}>Prev</Button>
                <Button variant="outline" size="sm" disabled={allEventsPage >= allEventsPages} onClick={() => setAllEventsPage((p) => p + 1)}>Next</Button>
                <Button variant="outline" size="sm" disabled={allEventsPage >= allEventsPages} onClick={() => setAllEventsPage(allEventsPages)}>Last</Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Security Tab ────────────────────────────────────────────────── */}
      {activeTab === 'security' && (
        <>
          {securityLoading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : !security ? (
            <EmptyState
              icon={<Shield className="h-8 w-8" />}
              title="No security data"
              message="Security events will appear once the system records login and sensitive operations."
            />
          ) : (
            <>
              {/* Security Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="glass-2 rounded-lg p-4">
                  <p className="text-xs text-text-tertiary uppercase tracking-wider mb-1">Login Events</p>
                  <p className="text-2xl font-bold text-text-primary tabular-nums">{security.login_events.length}</p>
                  <p className="text-xs text-text-quaternary mt-1">Last {security.period_days} days</p>
                </div>
                <div className="glass-2 rounded-lg p-4">
                  <p className="text-xs text-text-tertiary uppercase tracking-wider mb-1">Failed Logins</p>
                  <p className="text-2xl font-bold text-red-400 tabular-nums">{security.total_failed_logins}</p>
                  <p className="text-xs text-text-quaternary mt-1">
                    {Object.keys(security.suspicious_ips).length > 0
                      ? `${Object.keys(security.suspicious_ips).length} suspicious IP(s)`
                      : 'No suspicious activity'}
                  </p>
                </div>
                <div className="glass-2 rounded-lg p-4">
                  <p className="text-xs text-text-tertiary uppercase tracking-wider mb-1">Sensitive Operations</p>
                  <p className="text-2xl font-bold text-amber-400 tabular-nums">{security.sensitive_operations.length}</p>
                  <p className="text-xs text-text-quaternary mt-1">Deletions, config changes</p>
                </div>
              </div>

              {/* Suspicious IPs */}
              {Object.keys(security.suspicious_ips).length > 0 && (
                <Card title="Suspicious IPs (3+ Failed Logins)">
                  <div className="space-y-2">
                    {Object.entries(security.suspicious_ips).map(([ip, count]) => (
                      <div key={ip} className="flex items-center justify-between rounded-lg px-3 py-2 -mx-3 bg-red-500/5 border border-red-500/10">
                        <div className="flex items-center gap-3">
                          <AlertTriangle className="h-4 w-4 text-red-400" />
                          <span className="text-sm font-mono text-text-primary">{ip}</span>
                        </div>
                        <Badge variant="danger" size="sm">{count} attempts</Badge>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Login Events Table */}
              {security.login_events.length > 0 && (
                <Card title="Login Events">
                  <div className="overflow-x-auto -mx-5">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-glass-border">
                          <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-5 py-2">Time</th>
                          <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-5 py-2">User</th>
                          <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-5 py-2">IP</th>
                          <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-5 py-2">Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-glass-border">
                        {security.login_events.map((event, i) => (
                          <tr key={i} className="hover:bg-surface-hover transition-colors">
                            <td className="px-5 py-2.5 text-sm text-text-primary whitespace-nowrap tabular-nums">
                              {formatTimestamp(event.created_at)}
                            </td>
                            <td className="px-5 py-2.5 text-sm text-text-primary">{event.user}</td>
                            <td className="px-5 py-2.5 text-xs text-text-tertiary font-mono">{event.ip_address || '\u2014'}</td>
                            <td className="px-5 py-2.5">
                              {event.success ? (
                                <Badge variant="success" size="sm">Success</Badge>
                              ) : (
                                <Badge variant="danger" size="sm">Failed</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* Sensitive Operations Table */}
              {security.sensitive_operations.length > 0 && (
                <Card title="Sensitive Operations">
                  <div className="overflow-x-auto -mx-5">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-glass-border">
                          <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-5 py-2">Time</th>
                          <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-5 py-2">Action</th>
                          <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-5 py-2">User</th>
                          <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-5 py-2">Resource</th>
                          <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-5 py-2">IP</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-glass-border">
                        {security.sensitive_operations.map((op, i) => (
                          <tr key={i} className="hover:bg-surface-hover transition-colors">
                            <td className="px-5 py-2.5 text-sm text-text-primary whitespace-nowrap tabular-nums">
                              {formatTimestamp(op.created_at)}
                            </td>
                            <td className="px-5 py-2.5">
                              <Badge variant="warning" size="sm">{op.action.replace(/_/g, ' ')}</Badge>
                            </td>
                            <td className="px-5 py-2.5 text-sm text-text-primary">{op.user}</td>
                            <td className="px-5 py-2.5 text-xs text-text-tertiary font-mono">
                              {op.resource_type}{op.resource_id ? `:${op.resource_id.slice(0, 8)}` : ''}
                            </td>
                            <td className="px-5 py-2.5 text-xs text-text-quaternary font-mono">{op.ip_address || '\u2014'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
