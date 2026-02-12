import { useEffect, useState } from 'react';
import { StatusBadge } from './StatusBadge';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { formatDate, formatRelativeTime, formatCurrency } from '@/lib/formatters';
import { FOIA_STATUSES, VIDEO_STATUSES } from '@/lib/constants';
import {
  X, Send, Save, FileDown, Gavel, Clock, Mail, Video,
  ArrowRight, ExternalLink, ChevronDown, ChevronUp,
} from 'lucide-react';
import * as foiaApi from '@/api/foia';
import { cn } from '@/lib/cn';

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
  const [detail, setDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [showAppealModal, setShowAppealModal] = useState(false);
  const [appealReasons, setAppealReasons] = useState<any[]>([]);
  const [appealReason, setAppealReason] = useState('');
  const [appealExplanation, setAppealExplanation] = useState('');
  const [appealResult, setAppealResult] = useState<any>(null);
  const [appealLoading, setAppealLoading] = useState(false);
  const [expandedEmails, setExpandedEmails] = useState(false);

  // Fetch enriched detail when panel opens
  useEffect(() => {
    if (!isOpen || !request?.id) {
      setDetail(null);
      return;
    }
    setLoadingDetail(true);
    foiaApi.getFoiaRequest(request.id)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoadingDetail(false));
  }, [isOpen, request?.id]);

  // Reset notes when request changes
  useEffect(() => {
    setNotes(request?.notes || '');
  }, [request?.notes]);

  if (!isOpen || !request) return null;

  const statusOptions = Object.entries(FOIA_STATUSES).map(([key, val]) => ({ value: key, label: val.label }));
  const statusChanges = detail?.status_changes || [];
  const responseEmails = detail?.response_emails || [];
  const linkedVideos = detail?.linked_videos || [];
  const isDenied = request.status === 'denied';

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const blob = await foiaApi.generatePdf(request.id);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${request.case_number}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('PDF download failed:', error);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleOpenAppeal = async () => {
    if (appealReasons.length === 0) {
      try {
        const data = await foiaApi.getAppealReasons();
        setAppealReasons(data.reasons || []);
      } catch {
        // fallback reasons
        setAppealReasons([
          { value: 'active_investigation', label: 'Active Investigation' },
          { value: 'public_safety', label: 'Public Safety' },
          { value: 'privacy', label: 'Privacy' },
          { value: 'excessive_cost', label: 'Excessive Cost' },
          { value: 'vague_request', label: 'Vague Request' },
          { value: 'no_records', label: 'No Records' },
          { value: 'other', label: 'Other' },
        ]);
      }
    }
    setAppealResult(null);
    setAppealReason('');
    setAppealExplanation('');
    setShowAppealModal(true);
  };

  const handleGenerateAppeal = async () => {
    if (!appealReason) return;
    setAppealLoading(true);
    try {
      const result = await foiaApi.generateAppeal(request.id, {
        denial_reason: appealReason,
        denial_explanation: appealExplanation || undefined,
      });
      setAppealResult(result);
    } catch (error) {
      console.error('Appeal generation failed:', error);
    } finally {
      setAppealLoading(false);
    }
  };

  const handleDownloadAppealPdf = async () => {
    try {
      const blob = await foiaApi.downloadAppealPdf(request.id, {
        denial_reason: appealReason,
        denial_explanation: appealExplanation || undefined,
      });
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${request.case_number}-APPEAL.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Appeal PDF download failed:', error);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] animate-fade-in" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-surface-secondary border-l border-surface-border shadow-overlay z-50 overflow-y-auto animate-slide-in-right">
        {/* Header */}
        <div className="sticky top-0 bg-surface-secondary/95 backdrop-blur-sm border-b border-surface-border px-5 py-3.5 flex items-center justify-between z-10">
          <div>
            <h2 className="font-mono text-sm text-accent-primary">{request.case_number}</h2>
            <p className="text-2xs text-text-tertiary mt-0.5">{request.agency_name}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="p-1.5 hover:bg-surface-tertiary rounded-lg transition-colors text-text-tertiary hover:text-text-primary disabled:opacity-50"
              title="Download PDF"
            >
              <FileDown className="h-4 w-4" />
            </button>
            <button onClick={onClose} className="p-1 hover:bg-surface-tertiary rounded-lg transition-colors">
              <X className="h-4 w-4 text-text-tertiary" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Status + Actions */}
          <div className="flex items-center justify-between">
            <StatusBadge status={request.status} size="md" />
            <div className="flex items-center gap-2">
              {request.status === 'draft' && (
                <Button variant="primary" size="sm" onClick={() => onSubmit(request.id)} icon={<Send className="h-3 w-3" />}>
                  Submit
                </Button>
              )}
              {isDenied && (
                <Button variant="outline" size="sm" onClick={handleOpenAppeal} icon={<Gavel className="h-3 w-3" />}>
                  Appeal
                </Button>
              )}
            </div>
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
              {request.payment_status && (
                <div className="flex justify-between text-xs">
                  <span className="text-text-tertiary">Payment:</span>
                  <Badge variant={request.payment_status === 'fee_waived' ? 'success' : 'default'} size="sm">
                    {request.payment_status.replace(/_/g, ' ')}
                  </Badge>
                </div>
              )}
            </div>
          )}

          {/* Response Emails */}
          {responseEmails.length > 0 && (
            <div className="rounded-lg border border-surface-border overflow-hidden">
              <button
                onClick={() => setExpandedEmails(!expandedEmails)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-surface-hover transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-text-tertiary" />
                  <span className="text-xs font-medium text-text-primary">
                    Response Emails ({responseEmails.length})
                  </span>
                </div>
                {expandedEmails ? <ChevronUp className="h-3.5 w-3.5 text-text-quaternary" /> : <ChevronDown className="h-3.5 w-3.5 text-text-quaternary" />}
              </button>
              {expandedEmails && (
                <div className="border-t border-surface-border/50 divide-y divide-surface-border/30">
                  {responseEmails.map((email: any, i: number) => (
                    <div key={i} className="px-3.5 py-2.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-2xs font-medium text-text-secondary">
                          {email.from || email.sender || 'Agency'}
                        </span>
                        {email.date && (
                          <span className="text-2xs text-text-quaternary tabular-nums">
                            {formatRelativeTime(email.date)}
                          </span>
                        )}
                      </div>
                      {email.subject && (
                        <p className="text-2xs text-text-tertiary truncate">{email.subject}</p>
                      )}
                      {email.snippet && (
                        <p className="text-2xs text-text-quaternary line-clamp-2">{email.snippet}</p>
                      )}
                      {email.response_type && (
                        <Badge
                          variant={
                            email.response_type === 'fulfillment' ? 'success' :
                            email.response_type === 'denial' ? 'danger' :
                            email.response_type === 'acknowledgment' ? 'info' :
                            'default'
                          }
                          size="sm"
                        >
                          {email.response_type}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Status History Timeline */}
          {loadingDetail ? (
            <div className="flex justify-center py-4">
              <Spinner size="sm" />
            </div>
          ) : statusChanges.length > 0 ? (
            <div className="rounded-lg border border-surface-border p-3.5">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-3.5 w-3.5 text-text-tertiary" />
                <h3 className="text-xs font-medium text-text-primary">Status History</h3>
              </div>
              <div className="relative pl-4 space-y-3">
                {/* Timeline line */}
                <div className="absolute left-[5px] top-1 bottom-1 w-px bg-surface-border" />
                {statusChanges.map((change: any, i: number) => {
                  const toInfo = FOIA_STATUSES[change.to_status];
                  return (
                    <div key={change.id || i} className="relative">
                      {/* Timeline dot */}
                      <div
                        className={cn(
                          'absolute -left-4 top-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface-secondary',
                          i === statusChanges.length - 1 ? 'bg-accent-primary' : 'bg-surface-border'
                        )}
                      />
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-2xs">
                            <span className="text-text-quaternary capitalize">{change.from_status}</span>
                            <ArrowRight className="h-2.5 w-2.5 text-text-quaternary flex-shrink-0" />
                            <Badge variant={(toInfo?.variant as any) || 'default'} size="sm">
                              {toInfo?.label || change.to_status}
                            </Badge>
                          </div>
                          {change.reason && (
                            <p className="text-2xs text-text-quaternary mt-0.5 truncate">{change.reason}</p>
                          )}
                        </div>
                        <span className="text-2xs text-text-quaternary tabular-nums whitespace-nowrap flex-shrink-0">
                          {formatRelativeTime(change.created_at)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Linked Videos */}
          {linkedVideos.length > 0 && (
            <div className="rounded-lg border border-surface-border p-3.5">
              <div className="flex items-center gap-2 mb-3">
                <Video className="h-3.5 w-3.5 text-text-tertiary" />
                <h3 className="text-xs font-medium text-text-primary">Linked Videos ({linkedVideos.length})</h3>
              </div>
              <div className="space-y-2">
                {linkedVideos.map((video: any) => {
                  const statusInfo = VIDEO_STATUSES[video.status];
                  return (
                    <div key={video.id} className="flex items-center justify-between rounded-md bg-surface-tertiary/30 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-text-primary truncate">{video.title || 'Untitled'}</p>
                        {statusInfo && (
                          <Badge variant={statusInfo.variant} size="sm">{statusInfo.label}</Badge>
                        )}
                      </div>
                      {video.youtube_url && (
                        <a
                          href={video.youtube_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-text-tertiary hover:text-accent-primary transition-colors flex-shrink-0"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  );
                })}
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

      {/* Appeal Modal */}
      <Modal
        isOpen={showAppealModal}
        onClose={() => setShowAppealModal(false)}
        title="Generate Appeal"
        size="lg"
      >
        {!appealResult ? (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Generate a formal appeal letter for case <span className="font-mono text-accent-primary">{request.case_number}</span>.
            </p>
            <div>
              <label className="block text-xs font-medium text-text-primary mb-1.5">Denial Reason</label>
              <Select
                options={[
                  { value: '', label: 'Select reason...' },
                  ...appealReasons.map((r: any) => ({ value: r.value, label: r.label })),
                ]}
                value={appealReason}
                onChange={setAppealReason}
              />
              {appealReason && appealReasons.find((r: any) => r.value === appealReason)?.description && (
                <p className="mt-1 text-2xs text-text-quaternary">
                  {appealReasons.find((r: any) => r.value === appealReason)?.description}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-text-primary mb-1.5">Agency's Explanation (optional)</label>
              <textarea
                className="w-full rounded-lg border border-surface-border bg-surface-tertiary/30 px-3 py-2 text-xs text-text-primary placeholder-text-quaternary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary/40 min-h-[60px] transition-all duration-150"
                value={appealExplanation}
                onChange={e => setAppealExplanation(e.target.value)}
                placeholder="Paste the agency's denial explanation..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowAppealModal(false)}>Cancel</Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!appealReason || appealLoading}
                onClick={handleGenerateAppeal}
                icon={appealLoading ? <Spinner size="sm" /> : <Gavel className="h-3 w-3" />}
              >
                {appealLoading ? 'Generating...' : 'Generate Appeal'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="success" size="sm">Appeal Generated</Badge>
              <span className="text-xs text-text-tertiary font-mono">{appealResult.appeal_number}</span>
            </div>
            <div className="rounded-lg border border-surface-border bg-surface-tertiary/30 p-3.5 text-xs text-text-secondary whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed">
              {appealResult.appeal_text}
            </div>
            {appealResult.recommendations && appealResult.recommendations.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-text-primary mb-1.5">Recommendations</h4>
                <ul className="space-y-1">
                  {appealResult.recommendations.map((rec: string, i: number) => (
                    <li key={i} className="text-2xs text-text-tertiary flex items-start gap-1.5">
                      <span className="text-accent-primary mt-0.5">-</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowAppealModal(false)}>Close</Button>
              <Button variant="primary" size="sm" onClick={handleDownloadAppealPdf} icon={<FileDown className="h-3 w-3" />}>
                Download Appeal PDF
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
