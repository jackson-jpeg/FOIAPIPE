import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Paperclip, ChevronDown, Inbox, RefreshCw, Mail } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import { getInbox } from '@/api/foia';
import { triggerTask } from '@/api/tasks';

interface InboxEmail {
  foia_id: string;
  case_number: string;
  agency_name: string;
  foia_status: string;
  from?: string;
  sender?: string;
  subject?: string;
  date?: string;
  body?: string;
  response_type?: string;
  estimated_cost?: number;
  fee_waiver?: string;
  extension_days?: number;
  has_attachments?: boolean;
  attachment_count?: number;
  attachment_keys?: string[];
}

interface InboxData {
  items: InboxEmail[];
  total: number;
  page: number;
  page_size: number;
  type_counts: Record<string, number>;
}

const RESPONSE_TYPE_BADGE: Record<string, { variant: 'success' | 'danger' | 'info' | 'warning' | 'purple' | 'default'; label: string }> = {
  fulfilled: { variant: 'success', label: 'Fulfilled' },
  denied: { variant: 'danger', label: 'Denied' },
  acknowledged: { variant: 'info', label: 'Acknowledged' },
  cost_estimate: { variant: 'warning', label: 'Cost Estimate' },
  fee_waiver: { variant: 'purple', label: 'Fee Waiver' },
  extension: { variant: 'warning', label: 'Extension' },
  processing: { variant: 'info', label: 'Processing' },
  unknown: { variant: 'default', label: 'Unknown' },
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function InboxPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [data, setData] = useState<InboxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [responseTypeFilter, setResponseTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);

  const fetchInbox = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getInbox({
        response_type: responseTypeFilter || undefined,
        page,
        page_size: 50,
      });
      setData(result);
    } catch {
      addToast({ type: 'error', title: 'Failed to load inbox' });
    } finally {
      setLoading(false);
    }
  }, [responseTypeFilter, page, addToast]);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 1;

  const filterOptions = [
    { value: '', label: 'All Types' },
    ...Object.entries(RESPONSE_TYPE_BADGE).map(([key, { label }]) => ({
      value: key,
      label,
    })),
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="heading-3">Inbox</h1>
        </div>
        <div className="flex items-center gap-2">
          <Select
            options={filterOptions}
            value={responseTypeFilter}
            onChange={(v) => { setResponseTypeFilter(v); setPage(1); }}
          />
          <Button
            variant="outline"
            onClick={async () => {
              setChecking(true);
              try {
                await triggerTask('check-foia-inbox');
                addToast({ type: 'success', title: 'Inbox check triggered', message: 'New emails will appear shortly.' });
                // Refresh after a short delay to allow processing
                setTimeout(fetchInbox, 5000);
              } catch {
                addToast({ type: 'error', title: 'Failed to trigger inbox check' });
              } finally {
                setChecking(false);
              }
            }}
            loading={checking}
            icon={<Mail className="h-4 w-4" />}
          >
            Check Now
          </Button>
          <Button
            variant="outline"
            onClick={fetchInbox}
            icon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Type counts strip */}
      {data && Object.keys(data.type_counts).length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(data.type_counts).map(([type, count]) => {
            const config = RESPONSE_TYPE_BADGE[type] || RESPONSE_TYPE_BADGE.unknown;
            return (
              <button
                key={type}
                onClick={() => {
                  setResponseTypeFilter(responseTypeFilter === type ? '' : type);
                  setPage(1);
                }}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2 py-1 text-2xs font-medium transition-colors',
                  responseTypeFilter === type
                    ? 'glass-3 text-text-primary'
                    : 'glass-1 text-text-tertiary hover:text-text-secondary'
                )}
              >
                <span>{config.label}</span>
                <span className="font-mono tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Email list */}
      <div className="glass-2 rounded-lg overflow-hidden">
        {loading ? (
          <div className="divide-y divide-glass-border">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton variant="text" className="h-3 w-32" />
                  <Skeleton variant="text" className="h-3 w-16" />
                </div>
                <Skeleton variant="text" className="h-3 w-48" />
                <Skeleton variant="text" className="h-3 w-full" />
              </div>
            ))}
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="py-16">
            <EmptyState
              icon={<Inbox className="h-10 w-10" />}
              title="No emails yet"
              message="Agency responses will appear here as they arrive."
            />
          </div>
        ) : (
          <div className="divide-y divide-glass-border">
            {data.items.map((email, idx) => {
              const config = RESPONSE_TYPE_BADGE[email.response_type || 'unknown'] || RESPONSE_TYPE_BADGE.unknown;
              const isExpanded = expandedIdx === idx;
              const attachmentCount = email.attachment_keys?.length || email.attachment_count || 0;

              return (
                <div key={idx} className="group">
                  <button
                    onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                    className="w-full px-4 py-2.5 text-left hover:bg-glass-highlight transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {/* Left: type indicator */}
                      <span className={cn(
                        'h-2 w-2 shrink-0 rounded-full',
                        email.response_type === 'fulfilled' ? 'bg-accent-green' :
                        email.response_type === 'denied' ? 'bg-accent-red' :
                        email.response_type === 'acknowledged' ? 'bg-accent-cyan' :
                        email.response_type === 'cost_estimate' ? 'bg-accent-amber' :
                        'bg-text-quaternary'
                      )} />

                      {/* Main content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-2xs font-medium text-text-secondary truncate">
                            {email.from || email.sender || 'Agency'}
                          </span>
                          <span className="text-3xs text-text-quaternary font-mono">
                            {email.case_number}
                          </span>
                          <span className="text-3xs text-text-quaternary hidden sm:inline">
                            {email.agency_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {email.subject && (
                            <p className="text-2xs text-text-tertiary truncate flex-1">
                              {email.subject}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: metadata */}
                      <div className="flex items-center gap-2 shrink-0">
                        {attachmentCount > 0 && (
                          <span className="flex items-center gap-0.5 text-2xs text-text-quaternary">
                            <Paperclip className="h-2.5 w-2.5" />
                            <span className="font-mono">{attachmentCount}</span>
                          </span>
                        )}
                        <Badge variant={config.variant} size="sm">
                          {config.label}
                        </Badge>
                        {email.date && (
                          <span className="text-2xs text-text-quaternary tabular-nums w-14 text-right">
                            {formatRelativeTime(email.date)}
                          </span>
                        )}
                        <ChevronDown className={cn(
                          'h-3 w-3 text-text-quaternary transition-transform',
                          isExpanded && 'rotate-180'
                        )} />
                      </div>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-4 pb-3 pl-9 space-y-2">
                      {email.body && (
                        <div className="rounded-md glass-1 p-3 text-2xs text-text-secondary whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                          {email.body}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-3 text-2xs">
                        {email.estimated_cost != null && (
                          <span className="text-text-tertiary">
                            Cost: <span className="text-text-primary font-medium font-mono">${email.estimated_cost.toFixed(2)}</span>
                          </span>
                        )}
                        {email.fee_waiver && (
                          <span className="text-text-tertiary">
                            Fee waiver: <span className="text-text-primary font-medium capitalize">{email.fee_waiver}</span>
                          </span>
                        )}
                        {email.extension_days && (
                          <span className="text-text-tertiary">
                            Extension: <span className="text-text-primary font-medium">+{email.extension_days} days</span>
                          </span>
                        )}
                        <span className="flex-1" />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate('/foia', { state: { openDetail: email.foia_id } });
                          }}
                        >
                          View Request
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && totalPages > 1 && (
        <div className="flex items-center justify-between text-2xs text-text-tertiary">
          <span>
            Showing {((page - 1) * data.page_size) + 1}–{Math.min(page * data.page_size, data.total)} of {data.total}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              Prev
            </Button>
            <span className="px-2 font-mono tabular-nums">
              {page} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
