import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import * as agenciesApi from '@/api/agencies';

interface FoiaFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { agency_id: string; request_text: string; priority: string }) => Promise<void>;
}

export function FoiaForm({ isOpen, onClose, onSubmit }: FoiaFormProps) {
  const [agencies, setAgencies] = useState<any[]>([]);
  const [agencyId, setAgencyId] = useState('');
  const [requestText, setRequestText] = useState('');
  const [priority, setPriority] = useState('medium');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      agenciesApi.getAgencies().then((data) => setAgencies(data.items || data || [])).catch(() => {});
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!agencyId || !requestText) return;
    setSubmitting(true);
    try {
      await onSubmit({ agency_id: agencyId, request_text: requestText, priority });
      setAgencyId('');
      setRequestText('');
      setPriority('medium');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const agencyOptions = agencies.map(a => ({ value: a.id, label: a.name }));
  const priorityOptions = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New FOIA Request" size="lg">
      <div className="space-y-3.5">
        <Select label="Agency" options={agencyOptions} value={agencyId} onChange={setAgencyId} placeholder="Select agency..." />
        <Select label="Priority" options={priorityOptions} value={priority} onChange={setPriority} />
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">Request Text</label>
          <textarea
            className="w-full rounded-lg border border-surface-border bg-surface-tertiary/30 px-3 py-2 text-xs text-text-primary placeholder-text-quaternary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary/40 min-h-[180px] transition-all duration-150"
            value={requestText}
            onChange={e => setRequestText(e.target.value)}
            placeholder="Enter your FOIA request text..."
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit} loading={submitting} disabled={!agencyId || !requestText}>
          Create Request
        </Button>
      </div>
    </Modal>
  );
}
