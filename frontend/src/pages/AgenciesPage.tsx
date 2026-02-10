import { useEffect, useState, useCallback, useRef, type KeyboardEvent } from 'react';
import { Plus, Building2, ChevronDown, ChevronRight, Pencil, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/cn';
import * as agenciesApi from '@/api/agencies';

// ── Extended Agency type matching backend AgencyResponse ────────────────

interface Agency {
  id: string;
  name: string;
  abbreviation: string | null;
  foia_email: string | null;
  foia_phone: string | null;
  foia_address: string | null;
  website: string | null;
  state: string;
  jurisdiction: string | null;
  is_active: boolean;
  avg_response_days: number | null;
  notes: string | null;
  foia_template: string | null;
  typical_cost_per_hour: number | null;
  created_at: string;
  updated_at: string | null;
}

interface NewAgencyForm {
  name: string;
  abbreviation: string;
  foia_email: string;
  jurisdiction: string;
  state: string;
}

type SortField = 'name' | 'abbreviation' | 'jurisdiction' | 'foia_email' | 'avg_response_days' | 'is_active';
type SortDir = 'asc' | 'desc';

// ── Inline editable cell ───────────────────────────────────────────────

function InlineEditCell({
  value,
  agencyId,
  field,
  type = 'text',
  onSave,
}: {
  value: string | number | null;
  agencyId: string;
  field: string;
  type?: 'text' | 'number';
  onSave: (id: string, field: string, value: string | number | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value ?? ''));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(String(value ?? ''));
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setEditValue(String(value ?? ''));
  };

  const handleSave = async () => {
    const parsed = type === 'number'
      ? (editValue === '' ? null : Number(editValue))
      : (editValue || null);
    setSaving(true);
    try {
      await onSave(agencyId, field, parsed);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type={type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          disabled={saving}
          className={cn(
            'h-7 w-full rounded border border-accent-primary/50 bg-white px-2 text-sm text-text-primary',
            'focus:outline-none focus:ring-2 focus:ring-accent-primary/20',
            type === 'number' && 'w-20'
          )}
        />
        {saving && <Spinner size="sm" />}
      </div>
    );
  }

  return (
    <div className="group/cell flex items-center gap-1.5">
      <span className={cn(!value && 'text-text-quaternary italic')}>
        {value ?? 'None'}
      </span>
      <button
        onClick={handleStartEdit}
        className="shrink-0 opacity-0 group-hover/cell:opacity-100 transition-opacity text-text-tertiary hover:text-text-primary"
        title="Edit"
      >
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  );
}

// ── Expanded row detail ────────────────────────────────────────────────

function AgencyExpandedRow({
  agency,
  onUpdate,
}: {
  agency: Agency;
  onUpdate: (id: string, data: Partial<Agency>) => Promise<void>;
}) {
  const [template, setTemplate] = useState(agency.foia_template ?? '');
  const [notes, setNotes] = useState(agency.notes ?? '');
  const [isActive, setIsActive] = useState(agency.is_active);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingActive, setSavingActive] = useState(false);
  const { addToast } = useToast();

  const handleSaveTemplate = async () => {
    setSavingTemplate(true);
    try {
      await onUpdate(agency.id, { foia_template: template || null } as Partial<Agency>);
      addToast({ type: 'success', title: 'Template saved' });
    } catch {
      addToast({ type: 'error', title: 'Failed to save template' });
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await onUpdate(agency.id, { notes: notes || null } as Partial<Agency>);
      addToast({ type: 'success', title: 'Notes saved' });
    } catch {
      addToast({ type: 'error', title: 'Failed to save notes' });
    } finally {
      setSavingNotes(false);
    }
  };

  const handleToggleActive = async () => {
    const newValue = !isActive;
    setSavingActive(true);
    try {
      await onUpdate(agency.id, { is_active: newValue } as Partial<Agency>);
      setIsActive(newValue);
      addToast({ type: 'success', title: `Agency ${newValue ? 'activated' : 'deactivated'}` });
    } catch {
      addToast({ type: 'error', title: 'Failed to update status' });
    } finally {
      setSavingActive(false);
    }
  };

  return (
    <tr>
      <td colSpan={7} className="px-4 py-4 bg-surface-tertiary/30 border-b border-surface-border/50">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl">
          {/* FOIA Template */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider">
              FOIA Template
            </label>
            <textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={6}
              placeholder="Custom FOIA request template for this agency..."
              className={cn(
                'w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm text-text-primary placeholder:text-text-quaternary',
                'transition-all duration-150 resize-y',
                'focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20'
              )}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSaveTemplate}
              loading={savingTemplate}
              icon={<Check className="h-3.5 w-3.5" />}
            >
              Save Template
            </Button>
          </div>

          {/* Right column: Active toggle + Notes */}
          <div className="space-y-4">
            {/* Active toggle */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider">
                Status
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleToggleActive}
                  disabled={savingActive}
                  className={cn(
                    'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/30 focus-visible:ring-offset-2',
                    'disabled:pointer-events-none disabled:opacity-40',
                    isActive ? 'bg-accent-primary' : 'bg-gray-200'
                  )}
                >
                  <span
                    className={cn(
                      'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out',
                      isActive ? 'translate-x-5' : 'translate-x-0'
                    )}
                  />
                </button>
                <span className="text-sm text-text-primary">
                  {isActive ? 'Active' : 'Inactive'}
                </span>
                {savingActive && <Spinner size="sm" />}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Internal notes about this agency..."
                className={cn(
                  'w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm text-text-primary placeholder:text-text-quaternary',
                  'transition-all duration-150 resize-y',
                  'focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20'
                )}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSaveNotes}
                loading={savingNotes}
                icon={<Check className="h-3.5 w-3.5" />}
              >
                Save Notes
              </Button>
            </div>

            {/* Extra metadata */}
            <div className="space-y-1 text-xs text-text-tertiary">
              {agency.foia_phone && <p>Phone: {agency.foia_phone}</p>}
              {agency.foia_address && <p>Address: {agency.foia_address}</p>}
              {agency.website && (
                <p>
                  Website:{' '}
                  <a
                    href={agency.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-primary hover:underline"
                  >
                    {agency.website}
                  </a>
                </p>
              )}
              {agency.typical_cost_per_hour != null && (
                <p>Typical cost: ${Number(agency.typical_cost_per_hour).toFixed(2)}/hr</p>
              )}
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── Sort header helper ─────────────────────────────────────────────────

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

// ── Main page component ────────────────────────────────────────────────

export function AgenciesPage() {
  const { addToast } = useToast();

  // Data
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Search
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // Sorting
  const [sortBy, setSortBy] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Expand
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  // ── Data fetching ──────────────────────────────────────────────────

  const loadAgencies = useCallback(async () => {
    setLoading(true);
    try {
      const data = await agenciesApi.getAgencies({
        search: debouncedSearch || undefined,
      });
      setAgencies(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch {
      addToast({ type: 'error', title: 'Failed to load agencies' });
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, addToast]);

  useEffect(() => {
    loadAgencies();
  }, [loadAgencies]);

  // ── Sorting ────────────────────────────────────────────────────────

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

  // ── Row expand toggle ─────────────────────────────────────────────

  const handleRowClick = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // ── Inline field save ─────────────────────────────────────────────

  const handleInlineSave = async (id: string, field: string, value: string | number | null) => {
    try {
      await agenciesApi.updateAgency(id, { [field]: value });
      setAgencies((prev) =>
        prev.map((a) => (a.id === id ? { ...a, [field]: value } : a))
      );
      addToast({ type: 'success', title: 'Saved' });
    } catch (error: any) {
      const detail = error.response?.data?.detail || 'Failed to save';
      addToast({ type: 'error', title: 'Save failed', message: detail });
      throw error; // re-throw so InlineEditCell knows it failed
    }
  };

  // ── Expanded row update ───────────────────────────────────────────

  const handleUpdate = async (id: string, data: Partial<Agency>) => {
    await agenciesApi.updateAgency(id, data as Partial<agenciesApi.Agency>);
    setAgencies((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...data } : a))
    );
  };

  // ── Create agency ─────────────────────────────────────────────────

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

  // ── Render ─────────────────────────────────────────────────────────

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

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Search agencies by name or abbreviation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
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
        <div className="overflow-x-auto rounded-xl border border-surface-border/50 bg-white shadow-card">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-border/50 bg-surface-tertiary/30">
                <th className="w-8 px-4 py-3" />
                <SortableHeader label="Name" field="name" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Abbrev" field="abbreviation" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Jurisdiction" field="jurisdiction" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="FOIA Email" field="foia_email" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Avg Days" field="avg_response_days" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Status" field="is_active" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/30">
              {sortedAgencies.map((agency) => {
                const isExpanded = expandedId === agency.id;
                return (
                  <AgencyRow
                    key={agency.id}
                    agency={agency}
                    isExpanded={isExpanded}
                    onRowClick={handleRowClick}
                    onInlineSave={handleInlineSave}
                    onUpdate={handleUpdate}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
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

// ── Agency table row (extracted for fragment return) ────────────────────

function AgencyRow({
  agency,
  isExpanded,
  onRowClick,
  onInlineSave,
  onUpdate,
}: {
  agency: Agency;
  isExpanded: boolean;
  onRowClick: (id: string) => void;
  onInlineSave: (id: string, field: string, value: string | number | null) => Promise<void>;
  onUpdate: (id: string, data: Partial<Agency>) => Promise<void>;
}) {
  return (
    <>
      <tr
        className="hover:bg-surface-hover transition-colors cursor-pointer"
        onClick={() => onRowClick(agency.id)}
      >
        <td className="px-4 py-3 text-text-tertiary">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </td>
        <td className="px-4 py-3 text-sm text-text-primary font-medium">
          {agency.name}
        </td>
        <td className="px-4 py-3 text-sm text-text-secondary">
          {agency.abbreviation || <span className="text-text-quaternary">&mdash;</span>}
        </td>
        <td className="px-4 py-3 text-sm text-text-secondary">
          {agency.jurisdiction || <span className="text-text-quaternary">&mdash;</span>}
        </td>
        <td className="px-4 py-3 text-sm text-text-primary">
          <InlineEditCell
            value={agency.foia_email}
            agencyId={agency.id}
            field="foia_email"
            onSave={onInlineSave}
          />
        </td>
        <td className="px-4 py-3 text-sm text-text-primary">
          <InlineEditCell
            value={agency.avg_response_days}
            agencyId={agency.id}
            field="avg_response_days"
            type="number"
            onSave={onInlineSave}
          />
        </td>
        <td className="px-4 py-3">
          <Badge variant={agency.is_active ? 'success' : 'default'} dot>
            {agency.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </td>
      </tr>
      {isExpanded && <AgencyExpandedRow agency={agency} onUpdate={onUpdate} />}
    </>
  );
}
