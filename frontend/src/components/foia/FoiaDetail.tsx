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
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] animate-fade-in" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-surface-secondary border-l border-surface-border shadow-overlay z-50 overflow-y-auto animate-slide-in-right">
        <div className="sticky top-0 bg-surface-secondary/95 backdrop-blur-sm border-b border-surface-border px-5 py-3.5 flex items-center justify-between z-10">
          <div>
            <h2 className="font-mono text-sm text-accent-primary">{request.case_number}</h2>
            <p className="text-2xs text-text-tertiary mt-0.5">{request.agency_name}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-surface-tertiary rounded-lg transition-colors">
            <X className="h-4 w-4 text-text-tertiary" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Status */}
          <div className="flex items-center justify-between">
            <StatusBadge status={request.status} size="md" />
            {request.status === 'draft' && (
              <Button variant="primary" size="sm" onClick={() => onSubmit(request.id)} icon={<Send className="h-3 w-3" />}>
                Submit Request
              </Button>
            )}
          </div>

          {/* Key Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-2xs text-text-quaternary mb-0.5">Created</p>
              <p className="text-xs text-text-primary tabular-nums">{formatDate(request.created_at)}</p>
            </div>
            {request.submitted_at && (
              <div>
                <p className="text-2xs text-text-quaternary mb-0.5">Submitted</p>
                <p className="text-xs text-text-primary tabular-nums">{formatDate(request.submitted_at)}</p>
              </div>
            )}
            {request.due_date && (
              <div>
                <p className="text-2xs text-text-quaternary mb-0.5">Due Date</p>
                <p className="text-xs text-text-primary tabular-nums">{formatDate(request.due_date)}</p>
              </div>
            )}
            {request.fulfilled_at && (
              <div>
                <p className="text-2xs text-text-quaternary mb-0.5">Fulfilled</p>
                <p className="text-xs text-text-primary tabular-nums">{formatDate(request.fulfilled_at)}</p>
              </div>
            )}
          </div>

          {/* Costs */}
          {(request.estimated_cost != null || request.actual_cost != null) && (
            <div className="rounded-lg border border-surface-border p-3.5 space-y-2">
              <h3 className="text-xs font-medium text-text-primary">Costs</h3>
              <div className="flex justify-between text-xs">
                <span className="text-text-tertiary">Estimated:</span>
                <span className="tabular-nums text-text-secondary">{request.estimated_cost != null ? formatCurrency(request.estimated_cost) : '\u2014'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-tertiary">Actual:</span>
                <span className="tabular-nums text-text-secondary">{request.actual_cost != null ? formatCurrency(request.actual_cost) : '\u2014'}</span>
              </div>
            </div>
          )}

          {/* Request Text */}
          <div>
            <h3 className="text-xs font-medium text-text-primary mb-1.5">Request Text</h3>
            <div className="rounded-lg border border-surface-border bg-surface-tertiary/30 p-3.5 text-xs text-text-secondary whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
              {request.request_text}
            </div>
          </div>

          {/* Update Status */}
          <div className="rounded-lg border border-surface-border p-3.5 space-y-2.5">
            <h3 className="text-xs font-medium text-text-primary">Update Status</h3>
            <div className="flex gap-1.5">
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
            <h3 className="text-xs font-medium text-text-primary mb-1.5">Notes</h3>
            <textarea
              className="w-full rounded-lg border border-surface-border bg-surface-tertiary/30 px-3 py-2 text-xs text-text-primary placeholder-text-quaternary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary/40 min-h-[80px] transition-all duration-150"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add notes..."
            />
            <div className="mt-1.5 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => onUpdateNotes(request.id, notes)} icon={<Save className="h-3 w-3" />}>
                Save Notes
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
