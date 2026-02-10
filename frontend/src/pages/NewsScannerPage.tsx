import { useEffect, useState, useCallback } from 'react';
import { ScannerStatus } from '@/components/news/ScannerStatus';
import { ScanLogTable } from '@/components/news/ScanLogTable';
import { FeedHealthIndicators } from '@/components/news/FeedHealthIndicators';
import { ArticleTable } from '@/components/news/ArticleTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { StatusOrb } from '@/components/ui/StatusOrb';
import { useNewsStore } from '@/stores/newsStore';
import { useToast } from '@/components/ui/Toast';
import { useDebounce } from '@/hooks/useDebounce';
import { RefreshCw, FileText, X, Check, Sparkles } from 'lucide-react';
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
    is_scanning: false,
    last_scan_at: null as string | null,
    next_scan_at: null as string | null,
    articles_found_last_scan: 0,
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
    newsApi.getScanStatus().then(setScanStatus).catch((error) => {
      console.warn('Failed to load scan status:', error);
      // Set default values to prevent UI from being in undefined state
      setScanStatus({
        is_scanning: false,
        last_scan_at: null,
        next_scan_at: null,
        articles_found_last_scan: 0,
      });
    });
  }, []);

  const handleScanNow = async () => {
    setScanning(true);
    setScanStatus(s => ({ ...s, is_scanning: true }));
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
      setScanStatus(s => ({ ...s, is_scanning: false }));
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

  const handleBulkAction = async (action: 'dismiss' | 'file_foia' | 'mark_reviewed') => {
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
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-text-primary mb-2">News Scanner</h1>
          <p className="text-base text-text-secondary">
            Monitor and classify police accountability news from Tampa Bay sources
          </p>
        </div>
        <Button variant="primary" onClick={handleScanNow} loading={scanning} icon={<RefreshCw className="h-4 w-4" />}>
          Scan Now
        </Button>
      </div>

      <ScannerStatus
        isScanning={scanStatus.is_scanning}
        lastScanAt={scanStatus.last_scan_at}
        nextScanAt={scanStatus.next_scan_at}
        articlesFoundLastScan={scanStatus.articles_found_last_scan}
      />

      {/* Feed Health & Scan Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <FeedHealthIndicators />
        </div>
        <div className="lg:col-span-2">
          <ScanLogTable />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 border-b border-surface-border/50">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setPage(1); }}
            className={`px-4 pb-3 text-sm font-medium transition-all border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'text-accent-primary border-accent-primary'
                : 'text-text-tertiary border-transparent hover:text-text-primary hover:border-surface-border'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 max-w-md">
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
        <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-accent-amber/20 px-5 py-4 shadow-elevated animate-slide-up">
          <span className="text-sm font-bold text-text-primary">{selectedIds.size} selected</span>
          <div className="h-4 w-px bg-accent-primary/30" />
          <Button variant="primary" size="sm" onClick={() => handleBulkAction('file_foia')} icon={<FileText className="h-3.5 w-3.5" />}>
            File FOIAs
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleBulkAction('dismiss')} icon={<X className="h-3.5 w-3.5" />}>
            Dismiss
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleBulkAction('mark_reviewed')} icon={<Check className="h-3.5 w-3.5" />}>
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
          <span className="text-xs text-text-tertiary tabular-nums">
            {((page - 1) * 25) + 1}&ndash;{Math.min(page * 25, total)} of {total}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
            <span className="text-xs text-text-tertiary px-2 tabular-nums">{page}/{totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* News-to-FOIA Bridge - Slide-over Panel */}
      <Modal
        isOpen={foiaModalArticleId !== null}
        onClose={() => setFoiaModalArticleId(null)}
        title="Create FOIA Request"
        variant="slide-over"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFoiaModalArticleId(null)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={handleConfirmFileFoia}
              loading={filingFoia}
              disabled={!selectedAgencyId}
            >
              File FOIA Request
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          {/* Workflow Progression Indicator */}
          <div className="flex items-center gap-3 pb-4 border-b border-surface-border">
            <StatusOrb size="sm" color="success" label="Article Analyzed" />
            <div className="h-px flex-1 bg-surface-border" />
            <StatusOrb
              size="sm"
              color={selectedAgencyId ? "success" : "default"}
              label="Agency Selected"
            />
            <div className="h-px flex-1 bg-surface-border" />
            <StatusOrb size="sm" color="default" label="Draft Generated" />
          </div>

          {/* Article Preview */}
          {foiaModalArticleId && (() => {
            const article = articles.find(a => a.id === foiaModalArticleId);
            return article ? (
              <div className="rounded-lg border border-surface-border bg-surface-tertiary/20 p-4">
                <h3 className="text-sm font-semibold text-text-primary mb-2">Article</h3>
                <p className="text-sm text-text-primary font-medium mb-2">{article.headline}</p>
                <div className="flex items-center gap-3 text-xs text-text-tertiary">
                  <span>{article.source}</span>
                  {article.detected_agency && <span>Agency: {article.detected_agency}</span>}
                </div>
                {article.summary && (
                  <p className="mt-3 text-xs text-text-secondary leading-relaxed">{article.summary}</p>
                )}
              </div>
            ) : null;
          })()}

          {/* Agency Selection */}
          <Select
            label="Target Agency"
            options={[
              { value: '', label: 'Select an agency...' },
              ...agencies.map(a => ({ value: a.id, label: a.name })),
            ]}
            value={selectedAgencyId}
            onChange={setSelectedAgencyId}
          />

          {/* AI-Generated Draft Preview */}
          {selectedAgencyId && (
            <div className="rounded-lg border-2 border-dashed border-accent-purple/20 bg-gradient-to-br from-purple-50/50 to-blue-50/50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-accent-purple" />
                <h3 className="text-sm font-semibold text-text-primary">AI-Generated Draft</h3>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                A FOIA request will be automatically generated based on the article content and submitted to the selected agency. You can edit the request in Focus Mode after filing.
              </p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
