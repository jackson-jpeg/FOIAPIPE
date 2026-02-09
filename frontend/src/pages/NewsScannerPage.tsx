import { useEffect, useState, useCallback } from 'react';
import { ScannerStatus } from '@/components/news/ScannerStatus';
import { ArticleTable } from '@/components/news/ArticleTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { useNewsStore } from '@/stores/newsStore';
import { useToast } from '@/components/ui/Toast';
import { useDebounce } from '@/hooks/useDebounce';
import { RefreshCw, FileText, X, Check } from 'lucide-react';
import { INCIDENT_TYPES } from '@/lib/constants';
import * as newsApi from '@/api/news';
import * as agenciesApi from '@/api/agencies';

type FilterTab = 'all' | 'high_priority' | 'unreviewed' | 'auto_filed';

export function NewsScannerPage() {
  const { articles, loading, total, filters, setFilters, fetchArticles } = useNewsStore();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [scanStatus, setScanStatus] = useState({
    isScanning: false,
    lastScanAt: null as string | null,
    nextScanAt: null as string | null,
    articlesFoundLastScan: 0,
  });
  const [scanning, setScanning] = useState(false);
  const [sortBy, setSortBy] = useState('published_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [foiaModalArticleId, setFoiaModalArticleId] = useState<string | null>(null);
  const [agencies, setAgencies] = useState<{ id: string; name: string }[]>([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState('');
  const [filingFoia, setFilingFoia] = useState(false);

  const debouncedSearch = useDebounce(search, 300);

  const loadArticles = useCallback(() => {
    const tabFilters: Record<FilterTab, object> = {
      all: {},
      high_priority: { severity_min: 7 },
      unreviewed: { is_reviewed: false, is_dismissed: false },
      auto_filed: { auto_foia_eligible: true },
    };
    fetchArticles({
      ...tabFilters[activeTab],
      search: debouncedSearch || undefined,
      sort_by: sortBy,
      sort_dir: sortDir,
      page,
      page_size: 25,
    });
  }, [activeTab, debouncedSearch, sortBy, sortDir, page, fetchArticles]);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  useEffect(() => {
    newsApi.getScanStatus().then(setScanStatus).catch(() => {});
  }, []);

  const handleScanNow = async () => {
    setScanning(true);
    setScanStatus(s => ({ ...s, isScanning: true }));
    try {
      await newsApi.triggerScan();
      addToast({ type: 'success', title: 'Scan completed successfully' });
      loadArticles();
      const status = await newsApi.getScanStatus();
      setScanStatus(status);
    } catch {
      addToast({ type: 'error', title: 'Scan failed' });
    } finally {
      setScanning(false);
      setScanStatus(s => ({ ...s, isScanning: false }));
    }
  };

  const handleFileFoia = async (id: string) => {
    if (agencies.length === 0) {
      try {
        const data = await agenciesApi.getAgencies({ page_size: 100 });
        setAgencies(data.items || []);
      } catch {
        addToast({ type: 'error', title: 'Failed to load agencies' });
        return;
      }
    }
    setFoiaModalArticleId(id);
    setSelectedAgencyId('');
  };

  const handleConfirmFileFoia = async () => {
    if (!foiaModalArticleId || !selectedAgencyId) return;
    setFilingFoia(true);
    try {
      await newsApi.fileFoiaFromArticle(foiaModalArticleId, selectedAgencyId);
      addToast({ type: 'success', title: 'FOIA request created' });
      setFoiaModalArticleId(null);
      loadArticles();
    } catch {
      addToast({ type: 'error', title: 'Failed to file FOIA' });
    } finally {
      setFilingFoia(false);
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await newsApi.updateArticle(id, { is_dismissed: true });
      addToast({ type: 'info', title: 'Article dismissed' });
      loadArticles();
    } catch {
      addToast({ type: 'error', title: 'Failed to dismiss' });
    }
  };

  const handleMarkReviewed = async (id: string) => {
    try {
      await newsApi.updateArticle(id, { is_reviewed: true });
      loadArticles();
    } catch {
      addToast({ type: 'error', title: 'Failed to update' });
    }
  };

  const handleBulkAction = async (action: string) => {
    try {
      await newsApi.bulkAction({ article_ids: Array.from(selectedIds), action });
      addToast({ type: 'success', title: `Bulk ${action} completed` });
      setSelectedIds(new Set());
      loadArticles();
    } catch {
      addToast({ type: 'error', title: 'Bulk action failed' });
    }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === articles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(articles.map(a => a.id)));
    }
  };

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'high_priority', label: 'High Priority' },
    { key: 'unreviewed', label: 'Unreviewed' },
    { key: 'auto_filed', label: 'Auto-Filed' },
  ];

  const incidentOptions = [
    { value: '', label: 'All Types' },
    ...Object.entries(INCIDENT_TYPES).map(([key, val]) => ({ value: key, label: val.label })),
  ];

  const totalPages = Math.ceil(total / 25);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary tracking-tight">News Scanner</h1>
        <Button variant="primary" onClick={handleScanNow} loading={scanning} icon={<RefreshCw className="h-3.5 w-3.5" />}>
          Scan Now
        </Button>
      </div>

      <ScannerStatus {...scanStatus} />

      {/* Filter Tabs */}
      <div className="flex items-center gap-0.5 border-b border-surface-border">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setPage(1); }}
            className={`px-3 pb-2 text-xs font-medium transition-colors border-b-[2px] -mb-px ${
              activeTab === tab.key
                ? 'text-text-primary border-accent-primary'
                : 'text-text-tertiary border-transparent hover:text-text-secondary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-2.5">
        <div className="flex-1 max-w-xs">
          <Input placeholder="Search headlines..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select
          options={incidentOptions}
          value={filters.incident_type || ''}
          onChange={(value) => setFilters({ incident_type: value || undefined })}
          placeholder="Incident Type"
        />
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2.5 rounded-lg border border-accent-primary/15 bg-accent-primary-subtle px-3.5 py-2 animate-slide-up">
          <span className="text-xs text-text-secondary">{selectedIds.size} selected</span>
          <div className="h-3 w-px bg-surface-border" />
          <Button variant="primary" size="sm" onClick={() => handleBulkAction('file_foia')} icon={<FileText className="h-3 w-3" />}>
            File FOIAs
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleBulkAction('dismiss')} icon={<X className="h-3 w-3" />}>
            Dismiss
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleBulkAction('mark_reviewed')} icon={<Check className="h-3 w-3" />}>
            Reviewed
          </Button>
        </div>
      )}

      {/* Table */}
      <ArticleTable
        articles={articles}
        loading={loading}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        onFileFoia={handleFileFoia}
        onDismiss={handleDismiss}
        onMarkReviewed={handleMarkReviewed}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={handleSort}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-2xs text-text-quaternary tabular-nums">
            {((page - 1) * 25) + 1}&ndash;{Math.min(page * 25, total)} of {total}
          </span>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
            <span className="text-2xs text-text-quaternary px-2 tabular-nums">{page}/{totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Agency Selection Modal */}
      <Modal
        isOpen={foiaModalArticleId !== null}
        onClose={() => setFoiaModalArticleId(null)}
        title="Select Agency for FOIA Request"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFoiaModalArticleId(null)}>Cancel</Button>
            <Button variant="primary" onClick={handleConfirmFileFoia} loading={filingFoia} disabled={!selectedAgencyId}>
              File FOIA
            </Button>
          </>
        }
      >
        <Select
          label="Agency"
          options={[
            { value: '', label: 'Select an agency...' },
            ...agencies.map(a => ({ value: a.id, label: a.name })),
          ]}
          value={selectedAgencyId}
          onChange={setSelectedAgencyId}
        />
      </Modal>
    </div>
  );
}
