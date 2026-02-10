import { useEffect, useState, useCallback } from 'react';
import { FoiaTable } from '@/components/foia/FoiaTable';
import { FoiaForm } from '@/components/foia/FoiaForm';
import { FoiaDetail } from '@/components/foia/FoiaDetail';
import { DeadlineCalendar } from '@/components/foia/DeadlineCalendar';
import { StatCard } from '@/components/ui/StatCard';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useFoiaStore } from '@/stores/foiaStore';
import { FOIA_STATUSES } from '@/lib/constants';
import { Plus, Calendar, Download } from 'lucide-react';
import client from '@/api/client';
import * as foiaApi from '@/api/foia';

export function FoiaTrackerPage() {
  const { requests, loading, total, fetchRequests } = useFoiaStore();
  const { addToast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [statusSummary, setStatusSummary] = useState<Record<string, number>>({});
  const [deadlines, setDeadlines] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const loadData = useCallback(() => {
    fetchRequests({ status: statusFilter || undefined, search: search || undefined, sort_by: sortBy, sort_dir: sortDir, page, page_size: 25 });
    foiaApi.getStatusSummary()
      .then(setStatusSummary)
      .catch((error) => {
        console.error('Failed to load status summary:', error);
        setStatusSummary({});
      });
    foiaApi.getDeadlines()
      .then(setDeadlines)
      .catch((error) => {
        console.error('Failed to load deadlines:', error);
        setDeadlines([]);
      });
  }, [statusFilter, search, sortBy, sortDir, page, fetchRequests]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreateFoia = async (data: { agency_id: string; request_text: string; priority: string }) => {
    await foiaApi.createFoiaRequest(data);
    addToast({ type: 'success', title: 'FOIA request created' });
    loadData();
  };

  const handleSubmit = async (id: string) => {
    try {
      await foiaApi.submitFoiaRequest(id);
      addToast({ type: 'success', title: 'FOIA submitted' });
      loadData();
    } catch (error: any) {
      const detail = error.response?.data?.detail || 'An unexpected error occurred';
      addToast({ type: 'error', title: 'Submit failed', message: detail });
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await foiaApi.updateFoiaRequest(id, { status });
      addToast({ type: 'success', title: 'Status updated' });
      loadData();
    } catch (error: any) {
      const detail = error.response?.data?.detail || 'An unexpected error occurred';
      addToast({ type: 'error', title: 'Update failed', message: detail });
    }
  };

  const handleUpdateNotes = async (id: string, notes: string) => {
    try {
      await foiaApi.updateFoiaRequest(id, { notes });
      addToast({ type: 'success', title: 'Notes saved' });
    } catch (error: any) {
      const detail = error.response?.data?.detail || 'An unexpected error occurred';
      addToast({ type: 'error', title: 'Failed to save notes', message: detail });
    }
  };

  const handleExportCsv = async () => {
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const { data } = await client.get('/exports/foias', { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `foias_export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      addToast({ type: 'success', title: 'CSV exported' });
    } catch {
      addToast({ type: 'error', title: 'Export failed' });
    }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('desc'); }
  };

  const selectedRequest = detailId ? requests.find((r: any) => r.id === detailId) : null;

  const statusCards = ['draft', 'submitted', 'acknowledged', 'processing', 'fulfilled', 'denied'].filter(s => statusSummary[s]);
  const statusOptions = [{ value: '', label: 'All Statuses' }, ...Object.entries(FOIA_STATUSES).map(([k, v]) => ({ value: k, label: v.label }))];
  const totalPages = Math.ceil(total / 25);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="heading-3 mb-2">FOIA Tracker</h1>
          <p className="text-sm text-text-secondary">
            Manage Freedom of Information Act requests and track responses
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportCsv} icon={<Download className="h-4 w-4" />}>
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => setShowCalendar(!showCalendar)} icon={<Calendar className="h-4 w-4" />}>
            Deadlines
          </Button>
          <Button variant="primary" onClick={() => setShowForm(true)} icon={<Plus className="h-4 w-4" />}>
            New Request
          </Button>
        </div>
      </div>

      {/* Status Summary Cards */}
      {statusCards.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {statusCards.map(status => {
            const info = FOIA_STATUSES[status as keyof typeof FOIA_STATUSES];
            return (
              <StatCard
                key={status}
                label={info?.label || status}
                value={String(statusSummary[status] || 0)}
              />
            );
          })}
        </div>
      )}

      {/* Calendar */}
      {showCalendar && (
        <DeadlineCalendar deadlines={deadlines} />
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex-1 max-w-md">
          <Input placeholder="Search by case number..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select options={statusOptions} value={statusFilter} onChange={(value) => { setStatusFilter(value); setPage(1); }} />
      </div>

      {/* Table */}
      <FoiaTable
        requests={requests}
        loading={loading}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={handleSort}
        onSubmit={handleSubmit}
        onUpdateStatus={handleUpdateStatus}
        onViewDetail={setDetailId}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-tertiary tabular-nums">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Create Form Modal */}
      <FoiaForm isOpen={showForm} onClose={() => setShowForm(false)} onSubmit={handleCreateFoia} />

      {/* Detail Panel */}
      <FoiaDetail
        request={selectedRequest}
        isOpen={!!detailId}
        onClose={() => setDetailId(null)}
        onUpdateStatus={handleUpdateStatus}
        onSubmit={handleSubmit}
        onUpdateNotes={handleUpdateNotes}
      />
    </div>
  );
}
