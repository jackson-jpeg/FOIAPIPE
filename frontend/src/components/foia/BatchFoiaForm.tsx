import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { X } from 'lucide-react';
import * as agenciesApi from '@/api/agencies';
import * as foiaApi from '@/api/foia';
import { useToast } from '@/components/ui/Toast';
import type { Agency } from '@/types';

interface BatchFoiaFormProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function BatchFoiaForm({ isOpen, onClose, onComplete }: BatchFoiaFormProps) {
  const { addToast } = useToast();
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentSelect, setCurrentSelect] = useState('');
  const [requestText, setRequestText] = useState('');
  const [priority, setPriority] = useState('medium');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      agenciesApi.getAgencies({ page_size: 100 })
        .then((data) => setAgencies(data.items || data || []))
        .catch(() => setAgencies([]));
    }
  }, [isOpen]);

  const handleAddAgency = (id: string) => {
    if (id && !selectedIds.includes(id)) {
      setSelectedIds(prev => [...prev, id]);
    }
    setCurrentSelect('');
  };

  const handleRemoveAgency = (id: string) => {
    setSelectedIds(prev => prev.filter(i => i !== id));
  };

  const handleSubmit = async () => {
    if (selectedIds.length < 2) {
      addToast({ type: 'warning', title: 'Select at least 2 agencies for batch submission' });
      return;
    }
    setSubmitting(true);
    try {
      const result = await foiaApi.batchSubmit({
        agency_ids: selectedIds,
        request_text: requestText || undefined,
        priority,
      });
      const created = result.created?.length || 0;
      const errors = result.errors?.length || 0;
      addToast({
        type: errors > 0 ? 'warning' : 'success',
        title: `${created} FOIA requests created${errors > 0 ? `, ${errors} errors` : ''}`,
      });
      setSelectedIds([]);
      setRequestText('');
      setPriority('medium');
      onClose();
      onComplete();
    } catch {
      addToast({ type: 'error', title: 'Batch submission failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const availableAgencies = agencies.filter(a => !selectedIds.includes(a.id));
  const agencyOptions = availableAgencies.map(a => ({ value: a.id, label: a.name }));
  const priorityOptions = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Batch FOIA Submission" size="lg">
      <div className="space-y-3.5">
        {/* Agency multi-select */}
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">
            Agencies ({selectedIds.length} selected)
          </label>
          {selectedIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {selectedIds.map(id => {
                const agency = agencies.find(a => a.id === id);
                return (
                  <Badge key={id} variant="info" size="sm">
                    <span className="flex items-center gap-1">
                      {agency?.name || id}
                      <button onClick={() => handleRemoveAgency(id)} className="hover:text-text-primary">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  </Badge>
                );
              })}
            </div>
          )}
          <Select
            options={[{ value: '', label: 'Add an agency...' }, ...agencyOptions]}
            value={currentSelect}
            onChange={handleAddAgency}
          />
        </div>

        <Select label="Priority" options={priorityOptions} value={priority} onChange={setPriority} />

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">
            Request Text <span className="text-text-quaternary">(optional — auto-generated if blank)</span>
          </label>
          <textarea
            className="w-full rounded-lg border border-surface-border bg-surface-tertiary/30 px-3 py-2 text-xs text-text-primary placeholder-text-quaternary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary/40 min-h-[140px] transition-all duration-150"
            value={requestText}
            onChange={e => setRequestText(e.target.value)}
            placeholder="Same request text will be used for all agencies. Leave blank to auto-generate from agency templates."
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          loading={submitting}
          disabled={selectedIds.length < 2}
        >
          Create {selectedIds.length} Requests
        </Button>
      </div>
    </Modal>
  );
}
