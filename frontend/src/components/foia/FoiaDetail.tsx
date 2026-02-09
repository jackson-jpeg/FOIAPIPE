import { useState } from 'react';
import { StatusBadge } from './StatusBadge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { FOIA_STATUSES } from '@/lib/constants';
import { X, Send, Save } from 'lucide-react';

interface FoiaDetailProps {
  request: any;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatus: (id: string, status: string) => void;
  onSubmit: (id: string) => void;
  onUpdateNotes: (id: string, notes: string) => void;
}

export function FoiaDetail({ request, isOpen, onClose, onUpdateStatus, onSubmit, onUpdateNotes }: FoiaDetailProps) {
  const [notes, setNotes] = useState(request?.notes || '');
  const [newStatus, setNewStatus] = useState('');

  if (!isOpen || !request) return null;

  const statusOptions = Object.entries(FOIA_STATUSES).map(([key, val]) => ({ value: key, label: val.label }));

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-surface-secondary border-l border-surface-border shadow-2xl z-50 overflow-y-auto">
      <div className="sticky top-0 bg-surface-secondary border-b border-surface-border px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="font-mono text-lg text-accent-cyan">{request.case_number}</h2>
          <p className="text-sm text-text-secondary">{request.agency_name}</p>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-surface-tertiary rounded">
          <X className="h-5 w-5 text-text-tertiary" />
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* Status */}
        <div className="flex items-center justify-between">
          <StatusBadge status={request.status} size="md" />
          {request.status === 'draft' && (
            <Button variant="primary" size="sm" onClick={() => onSubmit(request.id)} icon={<Send className="h-3.5 w-3.5" />}>
              Submit Request
            </Button>
          )}
        </div>

        {/* Key Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-text-tertiary">Created</p>
            <p className="text-sm text-text-primary font-mono">{formatDate(request.created_at)}</p>
          </div>
          {request.submitted_at && (
            <div>
              <p className="text-xs text-text-tertiary">Submitted</p>
              <p className="text-sm text-text-primary font-mono">{formatDate(request.submitted_at)}</p>
            </div>
          )}
          {request.due_date && (
            <div>
              <p className="text-xs text-text-tertiary">Due Date</p>
              <p className="text-sm text-text-primary font-mono">{formatDate(request.due_date)}</p>
            </div>
          )}
          {request.fulfilled_at && (
            <div>
              <p className="text-xs text-text-tertiary">Fulfilled</p>
              <p className="text-sm text-text-primary font-mono">{formatDate(request.fulfilled_at)}</p>
            </div>
          )}
        </div>

        {/* Costs */}
        {(request.estimated_cost != null || request.actual_cost != null) && (
          <div className="rounded-lg border border-surface-border p-4 space-y-2">
            <h3 className="text-sm font-medium text-text-primary">Costs</h3>
            <div className="flex justify-between text-sm">
              <span className="text-text-tertiary">Estimated:</span>
              <span className="font-mono text-text-secondary">{request.estimated_cost != null ? formatCurrency(request.estimated_cost) : '\u2014'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-tertiary">Actual:</span>
              <span className="font-mono text-text-secondary">{request.actual_cost != null ? formatCurrency(request.actual_cost) : '\u2014'}</span>
            </div>
          </div>
        )}

        {/* Request Text */}
        <div>
          <h3 className="text-sm font-medium text-text-primary mb-2">Request Text</h3>
          <div className="rounded-lg border border-surface-border bg-surface-tertiary p-4 text-sm text-text-secondary whitespace-pre-wrap max-h-64 overflow-y-auto">
            {request.request_text}
          </div>
        </div>

        {/* Update Status */}
        <div className="rounded-lg border border-surface-border p-4 space-y-3">
          <h3 className="text-sm font-medium text-text-primary">Update Status</h3>
          <div className="flex gap-2">
            <div className="flex-1">
              <Select options={statusOptions} value={newStatus} onChange={setNewStatus} placeholder="Select new status..." />
            </div>
            <Button variant="primary" size="sm" disabled={!newStatus} onClick={() => { onUpdateStatus(request.id, newStatus); setNewStatus(''); }}>
              Update
            </Button>
          </div>
        </div>

        {/* Notes */}
        <div>
          <h3 className="text-sm font-medium text-text-primary mb-2">Notes</h3>
          <textarea
            className="w-full rounded-lg border border-surface-border bg-surface-tertiary px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 min-h-[100px]"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add notes..."
          />
          <div className="mt-2 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => onUpdateNotes(request.id, notes)} icon={<Save className="h-3.5 w-3.5" />}>
              Save Notes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
