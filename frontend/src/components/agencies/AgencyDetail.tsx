import { useEffect, useState, useCallback } from 'react';
import {
  X,
  Mail,
  Phone,
  Globe,
  MapPin,
  Check,
  Plus,
  Trash2,
  Star,
  FileText,
  Copy,
  ExternalLink,
  Pencil,
  Award,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { StatusBadge } from '@/components/foia/StatusBadge';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import * as agenciesApi from '@/api/agencies';
import type { Agency, AgencyStats, AgencyRecentFoia, AgencyContact } from '@/api/agencies';

interface AgencyDetailProps {
  agency: Agency;
  onClose: () => void;
  onUpdate: (id: string, data: Partial<Agency>) => Promise<void>;
}

export function AgencyDetail({ agency, onClose, onUpdate }: AgencyDetailProps) {
  const { addToast } = useToast();

  // Stats
  const [stats, setStats] = useState<AgencyStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Contacts
  const [contacts, setContacts] = useState<AgencyContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactTitle, setNewContactTitle] = useState('');
  const [creatingContact, setCreatingContact] = useState(false);

  // Recent FOIAs
  const [recentFoias, setRecentFoias] = useState<AgencyRecentFoia[]>([]);
  const [loadingFoias, setLoadingFoias] = useState(true);

  // Editable fields
  const [template, setTemplate] = useState(agency.foia_template ?? '');
  const [notes, setNotes] = useState(agency.notes ?? '');
  const [isActive, setIsActive] = useState(agency.is_active);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingActive, setSavingActive] = useState(false);

  // Editing contact info
  const [editingInfo, setEditingInfo] = useState(false);
  const [editEmail, setEditEmail] = useState(agency.foia_email ?? '');
  const [editPhone, setEditPhone] = useState(agency.foia_phone ?? '');
  const [editAddress, setEditAddress] = useState(agency.foia_address ?? '');
  const [editWebsite, setEditWebsite] = useState(agency.website ?? '');
  const [savingInfo, setSavingInfo] = useState(false);

  // ── Data loading ──────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoadingStats(true);
    setLoadingContacts(true);
    setLoadingFoias(true);

    try {
      const [statsData, contactsData, foiasData] = await Promise.allSettled([
        agenciesApi.getAgencyStats(agency.id),
        agenciesApi.getAgencyContacts(agency.id),
        agenciesApi.getAgencyRecentFoias(agency.id, 5),
      ]);

      if (statsData.status === 'fulfilled') setStats(statsData.value);
      if (contactsData.status === 'fulfilled') setContacts(contactsData.value.items);
      if (foiasData.status === 'fulfilled') setRecentFoias(foiasData.value);
    } finally {
      setLoadingStats(false);
      setLoadingContacts(false);
      setLoadingFoias(false);
    }
  }, [agency.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync local state when agency changes
  useEffect(() => {
    setTemplate(agency.foia_template ?? '');
    setNotes(agency.notes ?? '');
    setIsActive(agency.is_active);
    setEditEmail(agency.foia_email ?? '');
    setEditPhone(agency.foia_phone ?? '');
    setEditAddress(agency.foia_address ?? '');
    setEditWebsite(agency.website ?? '');
    setEditingInfo(false);
  }, [agency]);

  // ── Handlers ──────────────────────────────────────────────────────────

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

  const handleSaveInfo = async () => {
    setSavingInfo(true);
    try {
      await onUpdate(agency.id, {
        foia_email: editEmail || null,
        foia_phone: editPhone || null,
        foia_address: editAddress || null,
        website: editWebsite || null,
      } as Partial<Agency>);
      setEditingInfo(false);
      addToast({ type: 'success', title: 'Contact info saved' });
    } catch {
      addToast({ type: 'error', title: 'Failed to save' });
    } finally {
      setSavingInfo(false);
    }
  };

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

  const handleCopyEmail = () => {
    if (agency.foia_email) {
      navigator.clipboard.writeText(agency.foia_email);
      addToast({ type: 'success', title: 'Email copied' });
    }
  };

  const handleAddContact = async () => {
    if (!newContactName.trim()) return;
    setCreatingContact(true);
    try {
      const created = await agenciesApi.createAgencyContact(agency.id, {
        name: newContactName.trim(),
        email: newContactEmail.trim() || undefined,
        phone: newContactPhone.trim() || undefined,
        title: newContactTitle.trim() || undefined,
      });
      setContacts((prev) => [...prev, created]);
      setNewContactName('');
      setNewContactEmail('');
      setNewContactPhone('');
      setNewContactTitle('');
      setShowAddContact(false);
      addToast({ type: 'success', title: 'Contact added' });
    } catch {
      addToast({ type: 'error', title: 'Failed to add contact' });
    } finally {
      setCreatingContact(false);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    try {
      await agenciesApi.deleteAgencyContact(agency.id, contactId);
      setContacts((prev) => prev.filter((c) => c.id !== contactId));
      addToast({ type: 'success', title: 'Contact removed' });
    } catch {
      addToast({ type: 'error', title: 'Failed to remove contact' });
    }
  };

  // ── Template placeholder highlighting ─────────────────────────────────

  const highlightTemplate = (text: string) => {
    return text.replace(
      /\{[^}]+\}/g,
      (match) => `<span class="text-cyan-400 font-medium">${match}</span>`
    );
  };

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 animate-fade-in flex items-stretch justify-end" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative h-full w-full sm:max-w-2xl animate-slide-in-right bg-surface-secondary border-l border-surface-border shadow-overlay"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-border/50 px-6 py-5">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-lg font-semibold text-text-primary tracking-tight truncate">
              {agency.name}
            </h2>
            {agency.abbreviation && (
              <Badge variant="info" size="sm">{agency.abbreviation}</Badge>
            )}
            {agency.report_card_grade && (
              <span className={cn(
                'inline-flex items-center justify-center h-8 w-8 rounded-lg border text-sm font-bold shrink-0',
                agency.report_card_grade === 'A' && 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
                agency.report_card_grade === 'B' && 'text-blue-400 bg-blue-500/10 border-blue-500/30',
                agency.report_card_grade === 'C' && 'text-amber-400 bg-amber-500/10 border-amber-500/30',
                agency.report_card_grade === 'D' && 'text-orange-400 bg-orange-500/10 border-orange-500/30',
                agency.report_card_grade === 'F' && 'text-red-400 bg-red-500/10 border-red-500/30',
              )}>
                {agency.report_card_grade}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {/* Active toggle */}
            <button
              onClick={handleToggleActive}
              disabled={savingActive}
              className={cn(
                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/30',
                'disabled:pointer-events-none disabled:opacity-40',
                isActive ? 'bg-accent-primary' : 'bg-surface-border-light'
              )}
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-5 w-5 rounded-full bg-text-primary shadow-sm transition-transform duration-200',
                  isActive ? 'translate-x-5' : 'translate-x-0'
                )}
              />
            </button>
            <span className="text-xs text-text-secondary">{isActive ? 'Active' : 'Inactive'}</span>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="h-[calc(100%-5rem)] overflow-y-auto">
          <div className="p-6 space-y-6">

            {/* ── Contact Info Card ──────────────────────────────────────── */}
            <section className="rounded-xl border border-surface-border/50 bg-surface-tertiary/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wider">Contact Info</h3>
                {!editingInfo ? (
                  <button
                    onClick={() => setEditingInfo(true)}
                    className="text-xs text-accent-primary hover:text-accent-primary/80 flex items-center gap-1"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditingInfo(false)}>Cancel</Button>
                    <Button variant="primary" size="sm" onClick={handleSaveInfo} loading={savingInfo}>Save</Button>
                  </div>
                )}
              </div>

              {editingInfo ? (
                <div className="space-y-3">
                  <Input label="FOIA Email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="records@agency.gov" />
                  <Input label="Phone" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="(xxx) xxx-xxxx" />
                  <Input label="Address" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} placeholder="123 Main St..." />
                  <Input label="Website" value={editWebsite} onChange={(e) => setEditWebsite(e.target.value)} placeholder="https://..." />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {agency.foia_email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-3.5 w-3.5 text-text-quaternary shrink-0" />
                      <a href={`mailto:${agency.foia_email}`} className="text-accent-primary hover:underline truncate">
                        {agency.foia_email}
                      </a>
                      <button onClick={handleCopyEmail} className="text-text-quaternary hover:text-text-secondary shrink-0" title="Copy email">
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  {agency.foia_phone && (
                    <div className="flex items-center gap-2 text-sm text-text-secondary">
                      <Phone className="h-3.5 w-3.5 text-text-quaternary shrink-0" />
                      {agency.foia_phone}
                    </div>
                  )}
                  {agency.foia_address && (
                    <div className="flex items-center gap-2 text-sm text-text-secondary">
                      <MapPin className="h-3.5 w-3.5 text-text-quaternary shrink-0" />
                      {agency.foia_address}
                    </div>
                  )}
                  {agency.website && (
                    <div className="flex items-center gap-2 text-sm">
                      <Globe className="h-3.5 w-3.5 text-text-quaternary shrink-0" />
                      <a href={agency.website} target="_blank" rel="noopener noreferrer" className="text-accent-primary hover:underline truncate flex items-center gap-1">
                        {agency.website.replace(/^https?:\/\//, '')}
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    </div>
                  )}
                  {!agency.foia_email && !agency.foia_phone && !agency.foia_address && !agency.website && (
                    <p className="text-sm text-text-quaternary italic">No contact info set</p>
                  )}
                </div>
              )}
            </section>

            {/* ── FOIA Stats Grid ───────────────────────────────────────── */}
            <section className="space-y-3">
              <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wider">FOIA Performance</h3>
              {loadingStats ? (
                <div className="flex justify-center py-4"><Spinner size="sm" /></div>
              ) : stats ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-surface-border/50 bg-surface-tertiary/20 p-3">
                    <p className="text-xs text-text-tertiary mb-1">Total Requests</p>
                    <p className="text-2xl font-bold text-text-primary tabular-nums">{stats.total_requests}</p>
                  </div>
                  <div className="rounded-lg border border-surface-border/50 bg-surface-tertiary/20 p-3">
                    <p className="text-xs text-text-tertiary mb-1">Fulfillment Rate</p>
                    <p className={cn(
                      'text-2xl font-bold tabular-nums',
                      stats.fulfillment_rate >= 75 ? 'text-emerald-400' :
                      stats.fulfillment_rate >= 50 ? 'text-amber-400' : 'text-red-400'
                    )}>
                      {stats.fulfillment_rate}%
                    </p>
                  </div>
                  <div className="rounded-lg border border-surface-border/50 bg-surface-tertiary/20 p-3">
                    <p className="text-xs text-text-tertiary mb-1">Avg Cost</p>
                    <p className="text-2xl font-bold text-text-primary tabular-nums">
                      {stats.avg_cost != null ? `$${stats.avg_cost.toFixed(2)}` : '--'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-surface-border/50 bg-surface-tertiary/20 p-3">
                    <p className="text-xs text-text-tertiary mb-1">Avg Response Days</p>
                    <p className="text-2xl font-bold text-text-primary tabular-nums">
                      {stats.avg_response_days_actual != null ? stats.avg_response_days_actual : '--'}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-text-quaternary italic">No data</p>
              )}
            </section>

            {/* ── Contacts ──────────────────────────────────────────────── */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wider">Contacts</h3>
                <button
                  onClick={() => setShowAddContact(!showAddContact)}
                  className="text-xs text-accent-primary hover:text-accent-primary/80 flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Add
                </button>
              </div>

              {showAddContact && (
                <div className="rounded-lg border border-accent-primary/30 bg-surface-tertiary/30 p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Name *" value={newContactName} onChange={(e) => setNewContactName(e.target.value)} />
                    <Input placeholder="Title" value={newContactTitle} onChange={(e) => setNewContactTitle(e.target.value)} />
                    <Input placeholder="Email" value={newContactEmail} onChange={(e) => setNewContactEmail(e.target.value)} />
                    <Input placeholder="Phone" value={newContactPhone} onChange={(e) => setNewContactPhone(e.target.value)} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setShowAddContact(false)}>Cancel</Button>
                    <Button variant="primary" size="sm" onClick={handleAddContact} loading={creatingContact} disabled={!newContactName.trim()}>
                      Add Contact
                    </Button>
                  </div>
                </div>
              )}

              {loadingContacts ? (
                <div className="flex justify-center py-4"><Spinner size="sm" /></div>
              ) : contacts.length === 0 ? (
                <p className="text-sm text-text-quaternary italic">No contacts yet</p>
              ) : (
                <div className="space-y-2">
                  {contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between rounded-lg border border-surface-border/30 bg-surface-tertiary/10 px-3 py-2 group"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-text-primary truncate">{contact.name}</span>
                          {contact.is_primary && <Star className="h-3 w-3 text-amber-400 fill-amber-400 shrink-0" />}
                          {contact.contact_type && contact.contact_type !== 'other' && (
                            <Badge variant="default" size="sm">{contact.contact_type}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          {contact.title && <span className="text-xs text-text-tertiary">{contact.title}</span>}
                          {contact.email && <span className="text-xs text-text-quaternary">{contact.email}</span>}
                          {contact.phone && <span className="text-xs text-text-quaternary">{contact.phone}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteContact(contact.id)}
                        className="shrink-0 p-1 text-text-quaternary hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove contact"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── FOIA Template ─────────────────────────────────────────── */}
            <section className="space-y-3">
              <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wider">FOIA Template</h3>
              <textarea
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                rows={8}
                placeholder="Custom FOIA request template..."
                className={cn(
                  'w-full rounded-lg border border-surface-border bg-surface-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-quaternary',
                  'transition-all duration-150 resize-y font-mono text-xs leading-relaxed',
                  'focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20'
                )}
              />
              {template && (
                <details className="text-xs">
                  <summary className="text-text-tertiary cursor-pointer hover:text-text-secondary">Preview with highlights</summary>
                  <div
                    className="mt-2 rounded-lg border border-surface-border/30 bg-surface-tertiary/20 p-3 text-text-secondary font-mono whitespace-pre-wrap leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: highlightTemplate(template) }}
                  />
                </details>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSaveTemplate}
                loading={savingTemplate}
                icon={<Check className="h-3.5 w-3.5" />}
              >
                Save Template
              </Button>
            </section>

            {/* ── Notes ─────────────────────────────────────────────────── */}
            <section className="space-y-3">
              <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wider">Notes</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Internal notes about this agency..."
                className={cn(
                  'w-full rounded-lg border border-surface-border bg-surface-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-quaternary',
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
            </section>

            {/* ── Recent FOIAs ──────────────────────────────────────────── */}
            <section className="space-y-3">
              <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wider">Recent FOIA Requests</h3>
              {loadingFoias ? (
                <div className="flex justify-center py-4"><Spinner size="sm" /></div>
              ) : recentFoias.length === 0 ? (
                <p className="text-sm text-text-quaternary italic">No FOIA requests yet</p>
              ) : (
                <div className="space-y-2">
                  {recentFoias.map((foia) => (
                    <div
                      key={foia.id}
                      className="flex items-center justify-between rounded-lg border border-surface-border/30 bg-surface-tertiary/10 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 text-text-quaternary shrink-0" />
                          <span className="text-sm font-medium text-text-primary">{foia.case_number}</span>
                          <StatusBadge status={foia.status} size="sm" />
                        </div>
                        <p className="text-xs text-text-quaternary mt-0.5 truncate pl-5.5">
                          {foia.request_text_preview}
                        </p>
                      </div>
                      <span className="text-xs text-text-quaternary shrink-0 ml-3">
                        {new Date(foia.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Extra info */}
            {agency.typical_cost_per_hour != null && (
              <div className="text-xs text-text-quaternary border-t border-surface-border/30 pt-4">
                Typical cost: ${Number(agency.typical_cost_per_hour).toFixed(2)}/hr
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
