import { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  Building2,
  CheckCircle,
  Clock,
  Mail,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/cn';
import { AgencyDetail } from '@/components/agencies/AgencyDetail';
import * as agenciesApi from '@/api/agencies';
import type { Agency } from '@/api/agencies';

// ── Types ────────────────────────────────────────────────────────────────

interface NewAgencyForm {
  name: string;
  abbreviation: string;
  foia_email: string;
  jurisdiction: string;
  state: string;
}

type SortField = 'name' | 'jurisdiction' | 'foia_email' | 'avg_response_days' | 'is_active';
type SortDir = 'asc' | 'desc';

// ── Sort header helper ──────────────────────────────────────────────────

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
          <span className="text-accent-primary">
            {sortDir === 'asc' ? '\u2191' : '\u2193'}
          </span>
        )}
      </span>
    </th>
  );
}

// ── Response time dot ───────────────────────────────────────────────────

function ResponseDot({ days }: { days: number | null }) {
  if (days == null) return <span className="text-text-quaternary">&mdash;</span>;
  const color = days < 14 ? 'bg-emerald-400' : days <= 30 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums">
      <span className={cn('h-1.5 w-1.5 rounded-full', color)} />
      <span className="text-sm text-text-primary">{days}d</span>
    </span>
  );
}

// ── Main page component ─────────────────────────────────────────────────

export function AgenciesPage() {
  const { addToast } = useToast();

  // Data
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Search / Filters
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [jurisdictionType, setJurisdictionType] = useState('');
  const [activeFilter, setActiveFilter] = useState('');

  // Sorting
  const [sortBy, setSortBy] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Detail slide-over
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(null);

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newAgency, setNewAgency] = useState<NewAgencyForm>({
    name: '',
    abbreviation: '',
    foia_email: '',
    jurisdiction: '',
    state: 'FL',
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof NewAgencyForm, string>>>({});

  // ── Data fetching ─────────────────────────────────────────────────────

  const loadAgencies = useCallback(async () => {
    setLoading(true);
    try {
      const params: agenciesApi.AgencyListParams = {
        search: debouncedSearch || undefined,
      };
      if (jurisdictionType) params.jurisdiction_type = jurisdictionType;
      if (activeFilter === 'active') params.is_active = true;
      else if (activeFilter === 'inactive') params.is_active = false;

      const data = await agenciesApi.getAgencies(params);
      setAgencies(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch {
      addToast({ type: 'error', title: 'Failed to load agencies' });
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, jurisdictionType, activeFilter, addToast]);

  useEffect(() => {
    loadAgencies();
  }, [loadAgencies]);

  // ── Computed stats ────────────────────────────────────────────────────

  const activeCount = agencies.filter((a) => a.is_active).length;
  const withEmailCount = agencies.filter((a) => a.foia_email).length;
  const avgResponseDays = (() => {
    const withDays = agencies.filter((a) => a.avg_response_days != null);
    if (withDays.length === 0) return null;
    const sum = withDays.reduce((acc, a) => acc + (a.avg_response_days ?? 0), 0);
    return Math.round(sum / withDays.length);
  })();

  // ── Sorting ───────────────────────────────────────────────────────────

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
  };

  const sortedAgencies = [...agencies].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const aVal = a[sortBy];
    const bVal = b[sortBy];

    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;

    if (typeof aVal === 'boolean') {
      return (Number(aVal) - Number(bVal)) * dir;
    }
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return (aVal - bVal) * dir;
    }
    return String(aVal).localeCompare(String(bVal)) * dir;
  });

  // ── Selected agency ──────────────────────────────────────────────────

  const selectedAgency = agencies.find((a) => a.id === selectedAgencyId) ?? null;

  // ── Agency update handler ────────────────────────────────────────────

  const handleUpdate = async (id: string, data: Partial<Agency>) => {
    await agenciesApi.updateAgency(id, data);
    setAgencies((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...data } : a))
    );
  };

  // ── Create agency ────────────────────────────────────────────────────

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof NewAgencyForm, string>> = {};
    if (!newAgency.name.trim()) errors.name = 'Name is required';
    if (newAgency.foia_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newAgency.foia_email)) {
      errors.foia_email = 'Invalid email address';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;

    setCreating(true);
    try {
      const payload: Record<string, string | undefined> = {
        name: newAgency.name.trim(),
        state: newAgency.state,
      };
      if (newAgency.abbreviation.trim()) payload.abbreviation = newAgency.abbreviation.trim();
      if (newAgency.foia_email.trim()) payload.foia_email = newAgency.foia_email.trim();
      if (newAgency.jurisdiction.trim()) payload.jurisdiction = newAgency.jurisdiction.trim();

      await agenciesApi.createAgency(payload);
      addToast({ type: 'success', title: 'Agency created' });
      setShowAddModal(false);
      setNewAgency({ name: '', abbreviation: '', foia_email: '', jurisdiction: '', state: 'FL' });
      setFormErrors({});
      loadAgencies();
    } catch (error: any) {
      const detail = error.response?.data?.detail || 'Failed to create agency';
      addToast({ type: 'error', title: 'Create failed', message: detail });
    } finally {
      setCreating(false);
    }
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setNewAgency({ name: '', abbreviation: '', foia_email: '', jurisdiction: '', state: 'FL' });
    setFormErrors({});
  };

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="heading-3 mb-2">Agencies</h1>
          <p className="text-sm text-text-secondary">
            Manage law enforcement agencies and their FOIA request configurations
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowAddModal(true)}
          icon={<Plus className="h-4 w-4" />}
        >
          Add Agency
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Agencies"
          value={String(total)}
          icon={<Building2 className="h-5 w-5" />}
          gradient="blue"
        />
        <StatCard
          label="Active Agencies"
          value={String(activeCount)}
          icon={<CheckCircle className="h-5 w-5" />}
          gradient="emerald"
        />
        <StatCard
          label="Avg Response Time"
          value={avgResponseDays != null ? `${avgResponseDays}d` : '--'}
          icon={<Clock className="h-5 w-5" />}
          gradient="amber"
        />
        <StatCard
          label="With FOIA Email"
          value={String(withEmailCount)}
          icon={<Mail className="h-5 w-5" />}
          gradient="cyan"
        />
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] max-w-md">
          <Input
            placeholder="Search agencies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="h-4 w-4" />}
          />
        </div>
        <Select
          options={[
            { value: '', label: 'All Types' },
            { value: 'city', label: 'City PD' },
            { value: 'county', label: 'County Sheriff' },
            { value: 'state', label: 'State Agency' },
            { value: 'special', label: 'Special' },
          ]}
          value={jurisdictionType}
          onChange={(value) => setJurisdictionType(value)}
        />
        <Select
          options={[
            { value: '', label: 'All Status' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
          value={activeFilter}
          onChange={(value) => setActiveFilter(value)}
        />
        <span className="text-xs text-text-tertiary tabular-nums">
          {total} {total === 1 ? 'agency' : 'agencies'}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : sortedAgencies.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-7 w-7" />}
          title="No agencies found"
          message={
            debouncedSearch
              ? `No agencies match "${debouncedSearch}". Try a different search term.`
              : 'Get started by adding your first law enforcement agency.'
          }
          action={
            !debouncedSearch
              ? { label: 'Add Agency', onClick: () => setShowAddModal(true) }
              : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-surface-border/50 bg-surface-secondary">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-border/50 bg-surface-tertiary/30">
                <SortableHeader label="Agency" field="name" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Jurisdiction" field="jurisdiction" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="FOIA Email" field="foia_email" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Avg Response" field="avg_response_days" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Status" field="is_active" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/30">
              {sortedAgencies.map((agency) => (
                <tr
                  key={agency.id}
                  className={cn(
                    'hover:bg-surface-hover transition-colors cursor-pointer',
                    selectedAgencyId === agency.id && 'bg-accent-primary/5'
                  )}
                  onClick={() => setSelectedAgencyId(agency.id)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">{agency.name}</span>
                      {agency.abbreviation && (
                        <span className="text-xs text-text-quaternary">({agency.abbreviation})</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-secondary">
                    {agency.jurisdiction || <span className="text-text-quaternary">&mdash;</span>}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {agency.foia_email ? (
                      <a
                        href={`mailto:${agency.foia_email}`}
                        className="text-accent-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {agency.foia_email}
                      </a>
                    ) : (
                      <span className="text-text-quaternary">&mdash;</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ResponseDot days={agency.avg_response_days} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={agency.is_active ? 'success' : 'default'} dot>
                      {agency.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Agency Detail Slide-over */}
      {selectedAgency && (
        <AgencyDetail
          agency={selectedAgency}
          onClose={() => setSelectedAgencyId(null)}
          onUpdate={handleUpdate}
        />
      )}

      {/* Add Agency Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={handleCloseModal}
        title="Add Agency"
        footer={
          <>
            <Button variant="ghost" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreate} loading={creating}>
              Create Agency
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Agency Name"
            placeholder="e.g. Tampa Police Department"
            value={newAgency.name}
            onChange={(e) => setNewAgency((prev) => ({ ...prev, name: e.target.value }))}
            error={formErrors.name}
          />
          <Input
            label="Abbreviation"
            placeholder="e.g. TPD"
            value={newAgency.abbreviation}
            onChange={(e) => setNewAgency((prev) => ({ ...prev, abbreviation: e.target.value }))}
            error={formErrors.abbreviation}
          />
          <Input
            label="FOIA Email"
            placeholder="records@example.gov"
            type="email"
            value={newAgency.foia_email}
            onChange={(e) => setNewAgency((prev) => ({ ...prev, foia_email: e.target.value }))}
            error={formErrors.foia_email}
          />
          <Input
            label="Jurisdiction"
            placeholder="e.g. City of Tampa"
            value={newAgency.jurisdiction}
            onChange={(e) => setNewAgency((prev) => ({ ...prev, jurisdiction: e.target.value }))}
            error={formErrors.jurisdiction}
          />
          <Select
            label="State"
            options={[
              { value: 'FL', label: 'Florida' },
              { value: 'GA', label: 'Georgia' },
              { value: 'AL', label: 'Alabama' },
              { value: 'SC', label: 'South Carolina' },
            ]}
            value={newAgency.state}
            onChange={(value) => setNewAgency((prev) => ({ ...prev, state: value }))}
          />
        </div>
      </Modal>
    </div>
  );
}
