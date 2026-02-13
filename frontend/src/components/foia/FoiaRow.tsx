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

export function FoiaRow({ request, onSubmit, onUpdateStatus: _onUpdateStatus, onViewDetail }: FoiaRowProps) {
  const [expanded, setExpanded] = useState(false);
  const stars = priorityStars[request.priority] || 2;
  const dueDate = request.due_date ? new Date(request.due_date) : null;
  const isOverdue = dueDate && dueDate < new Date() && !['fulfilled', 'denied', 'closed'].includes(request.status);
  const daysRemaining = dueDate ? Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <>
      <tr
        className="border-b border-surface-border/30 hover:bg-surface-hover cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            {expanded ? <ChevronDown className="h-3.5 w-3.5 text-text-quaternary" /> : <ChevronRight className="h-3.5 w-3.5 text-text-quaternary" />}
            <span className="font-mono text-xs text-accent-primary">{request.case_number}</span>
          </div>
        </td>
        <td className="px-3 py-2.5 text-xs text-text-secondary hidden sm:table-cell">{request.agency_name || '\u2014'}</td>
        <td className="px-3 py-2.5 text-xs text-text-secondary max-w-xs truncate hidden lg:table-cell">{request.article_headline || 'Manual Request'}</td>
        <td className="px-3 py-2.5"><StatusBadge status={request.status} /></td>
        <td className="px-3 py-2.5 text-xs text-text-tertiary tabular-nums">
          {request.submitted_at ? formatDate(request.submitted_at) : '\u2014'}
        </td>
        <td className="px-3 py-2.5">
          {dueDate ? (
            <span className={`text-xs tabular-nums ${isOverdue ? 'text-accent-red' : daysRemaining !== null && daysRemaining <= 3 ? 'text-accent-amber' : 'text-text-tertiary'}`}>
              {formatDate(request.due_date!)}
              {daysRemaining !== null && (
                <span className="text-2xs ml-1">
                  ({isOverdue ? 'Overdue' : `${daysRemaining}d`})
                </span>
              )}
            </span>
          ) : '\u2014'}
        </td>
        <td className="px-3 py-2.5 text-xs tabular-nums text-text-tertiary hidden md:table-cell">
          {request.estimated_cost != null ? formatCurrency(request.estimated_cost) : '\u2014'}
        </td>
        <td className="px-3 py-2.5 hidden md:table-cell">
          <div className="flex items-center">
            {Array.from({ length: stars }).map((_, i) => (
              <Star key={i} className="h-3 w-3 text-accent-amber fill-accent-amber" />
            ))}
          </div>
        </td>
        <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            {request.status === 'draft' && (
              <Button variant="primary" size="sm" onClick={() => onSubmit(request.id)} icon={<Send className="h-3 w-3" />}>
                Submit
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => onViewDetail(request.id)} icon={<FileText className="h-3 w-3" />} />
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-surface-border/30 bg-surface-tertiary/20">
          <td colSpan={9} className="px-6 py-4 animate-fade-in-fast">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-text-primary">Request Text</h4>
                <p className="text-xs text-text-secondary whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
                  {request.request_text}
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-text-primary">Details</h4>
                <dl className="space-y-1.5 text-xs">
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
                  <div className="mt-2">
                    <div className="flex items-center gap-1 text-text-quaternary mb-1">
                      <StickyNote className="h-3 w-3" />
                      <span className="text-2xs">Notes</span>
                    </div>
                    <p className="text-xs text-text-secondary">{request.notes}</p>
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
