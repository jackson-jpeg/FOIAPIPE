import { useEffect, useState } from 'react';
import { formatRelativeTime } from '@/lib/formatters';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getScanLogs, type ScanLog } from '@/api/news';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function ScanLogTable() {
  const [logs, setLogs] = useState<ScanLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 10;

  useEffect(() => {
    setLoading(true);
    getScanLogs({ page, page_size: pageSize })
      .then((data) => {
        setLogs(data.items);
        setTotal(data.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.ceil(total / pageSize);

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: 'success' | 'danger' | 'warning' | 'info'; label: string }> = {
      completed: { variant: 'success', label: 'Completed' },
      failed: { variant: 'danger', label: 'Failed' },
      running: { variant: 'warning', label: 'Running' },
    };
    const badge = map[status] ?? { variant: 'info' as const, label: status };
    return <Badge variant={badge.variant} size="sm">{badge.label}</Badge>;
  };

  const typeBadge = (type: string) => {
    const map: Record<string, { variant: 'purple' | 'info' | 'default'; label: string }> = {
      rss: { variant: 'purple', label: 'RSS' },
      scrape: { variant: 'info', label: 'Scrape' },
      imap: { variant: 'default', label: 'IMAP' },
    };
    const badge = map[type] ?? { variant: 'default' as const, label: type };
    return <Badge variant={badge.variant} size="sm">{badge.label}</Badge>;
  };

  if (loading && logs.length === 0) {
    return (
      <div className="rounded-xl border border-surface-border bg-surface-secondary p-6">
        <h3 className="text-sm font-semibold text-text-primary mb-4">Scan History</h3>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg shimmer bg-surface-tertiary/40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-surface-border bg-surface-secondary overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-border/30">
        <h3 className="text-sm font-semibold text-text-primary">Scan History</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-surface-border/30 bg-surface-secondary/30">
              <th className="px-4 py-2.5 text-left font-medium text-text-tertiary">Time</th>
              <th className="px-4 py-2.5 text-left font-medium text-text-tertiary">Type</th>
              <th className="px-4 py-2.5 text-left font-medium text-text-tertiary">Status</th>
              <th className="px-4 py-2.5 text-right font-medium text-text-tertiary">Found</th>
              <th className="px-4 py-2.5 text-right font-medium text-text-tertiary">New</th>
              <th className="px-4 py-2.5 text-right font-medium text-text-tertiary">Dupes</th>
              <th className="px-4 py-2.5 text-right font-medium text-text-tertiary">Duration</th>
              <th className="px-4 py-2.5 text-left font-medium text-text-tertiary">Error</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-surface-border/20 hover:bg-surface-hover transition-colors">
                <td className="px-4 py-2.5 text-text-secondary whitespace-nowrap">
                  {formatRelativeTime(log.started_at)}
                </td>
                <td className="px-4 py-2.5">{typeBadge(log.scan_type)}</td>
                <td className="px-4 py-2.5">{statusBadge(log.status)}</td>
                <td className="px-4 py-2.5 text-right text-text-primary tabular-nums font-medium">{log.articles_found}</td>
                <td className="px-4 py-2.5 text-right text-accent-green tabular-nums font-medium">{log.articles_new}</td>
                <td className="px-4 py-2.5 text-right text-text-tertiary tabular-nums">{log.articles_duplicate}</td>
                <td className="px-4 py-2.5 text-right text-text-tertiary tabular-nums whitespace-nowrap">
                  {log.duration_seconds != null ? `${log.duration_seconds.toFixed(1)}s` : '—'}
                </td>
                <td className="px-4 py-2.5 text-text-tertiary max-w-[200px] truncate" title={log.error_message ?? undefined}>
                  {log.error_message ? (
                    <span className="text-accent-red">{log.error_message}</span>
                  ) : '—'}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-text-quaternary">
                  No scan logs yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-surface-border/30">
          <span className="text-2xs text-text-tertiary tabular-nums">
            {((page - 1) * pageSize) + 1}&ndash;{Math.min(page * pageSize, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} icon={<ChevronLeft className="h-3 w-3" />}>
              Prev
            </Button>
            <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} icon={<ChevronRight className="h-3 w-3" />}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
