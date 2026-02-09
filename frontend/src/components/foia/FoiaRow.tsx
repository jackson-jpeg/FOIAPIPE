import { useState } from 'react';
import { StatusBadge } from './StatusBadge';
import { Button } from '@/components/ui/Button';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { ChevronDown, ChevronRight, Send, FileText, StickyNote, Star } from 'lucide-react';

interface FoiaRequest {
  id: string;
  case_number: string;
  agency_name?: string;
  agency_id: string;
  news_article_id?: string;
  article_headline?: string;
  status: string;
  priority: string;
  request_text: string;
  submitted_at: string | null;
  due_date: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  agency_reference_number: string | null;
  notes: string | null;
  created_at: string;
}

interface FoiaRowProps {
  request: FoiaRequest;
  onSubmit: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onViewDetail: (id: string) => void;
}

const priorityStars: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };

export function FoiaRow({ request, onSubmit, onUpdateStatus, onViewDetail }: FoiaRowProps) {
  const [expanded, setExpanded] = useState(false);
  const stars = priorityStars[request.priority] || 2;
  const dueDate = request.due_date ? new Date(request.due_date) : null;
  const isOverdue = dueDate && dueDate < new Date() && !['fulfilled', 'denied', 'closed'].includes(request.status);
  const daysRemaining = dueDate ? Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <>
      <tr
        className="border-b border-surface-border hover:bg-surface-tertiary/50 cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-3 py-3">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown className="h-4 w-4 text-text-tertiary" /> : <ChevronRight className="h-4 w-4 text-text-tertiary" />}
            <span className="font-mono text-sm text-accent-cyan">{request.case_number}</span>
          </div>
        </td>
        <td className="px-3 py-3 text-sm text-text-secondary">{request.agency_name || '\u2014'}</td>
        <td className="px-3 py-3 text-sm text-text-secondary max-w-xs truncate">{request.article_headline || 'Manual Request'}</td>
        <td className="px-3 py-3"><StatusBadge status={request.status} /></td>
        <td className="px-3 py-3 text-sm text-text-secondary font-mono">
          {request.submitted_at ? formatDate(request.submitted_at) : '\u2014'}
        </td>
        <td className="px-3 py-3">
          {dueDate ? (
            <span className={`text-sm font-mono ${isOverdue ? 'text-accent-red' : daysRemaining !== null && daysRemaining <= 3 ? 'text-accent-amber' : 'text-text-secondary'}`}>
              {formatDate(request.due_date!)}
              {daysRemaining !== null && (
                <span className="text-xs ml-1">
                  ({isOverdue ? 'Overdue' : `${daysRemaining}d`})
                </span>
              )}
            </span>
          ) : '\u2014'}
        </td>
        <td className="px-3 py-3 text-sm font-mono text-text-secondary">
          {request.estimated_cost != null ? formatCurrency(request.estimated_cost) : '\u2014'}
        </td>
        <td className="px-3 py-3">
          <div className="flex items-center">
            {Array.from({ length: stars }).map((_, i) => (
              <Star key={i} className="h-3.5 w-3.5 text-accent-amber fill-accent-amber" />
            ))}
          </div>
        </td>
        <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            {request.status === 'draft' && (
              <Button variant="primary" size="sm" onClick={() => onSubmit(request.id)} icon={<Send className="h-3.5 w-3.5" />}>
                Submit
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => onViewDetail(request.id)} icon={<FileText className="h-3.5 w-3.5" />} />
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-surface-border bg-surface-tertiary/30">
          <td colSpan={9} className="px-6 py-4">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-text-primary">Request Text</h4>
                <p className="text-sm text-text-secondary whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                  {request.request_text}
                </p>
              </div>
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-text-primary">Details</h4>
                <dl className="space-y-2 text-sm">
                  {request.agency_reference_number && (
                    <div className="flex justify-between">
                      <dt className="text-text-tertiary">Agency Ref:</dt>
                      <dd className="font-mono text-text-secondary">{request.agency_reference_number}</dd>
                    </div>
                  )}
                  {request.actual_cost != null && (
                    <div className="flex justify-between">
                      <dt className="text-text-tertiary">Actual Cost:</dt>
                      <dd className="font-mono text-text-secondary">{formatCurrency(request.actual_cost)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-text-tertiary">Created:</dt>
                    <dd className="text-text-secondary">{formatDate(request.created_at)}</dd>
                  </div>
                </dl>
                {request.notes && (
                  <div className="mt-3">
                    <div className="flex items-center gap-1 text-text-tertiary mb-1">
                      <StickyNote className="h-3.5 w-3.5" />
                      <span className="text-xs">Notes</span>
                    </div>
                    <p className="text-sm text-text-secondary">{request.notes}</p>
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
