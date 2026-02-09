import { Card } from '@/components/ui/Card';
import { formatCompactNumber, formatCurrency } from '@/lib/formatters';
import { Film } from 'lucide-react';

interface TopVideo {
  id: string;
  title: string;
  thumbnail_url: string | null;
  views: number;
  revenue: number;
  rpm: number;
  ctr: number;
  published_at: string | null;
}

interface TopVideosTableProps {
  videos: TopVideo[];
}

export function TopVideosTable({ videos }: TopVideosTableProps) {
  return (
    <Card title="Top Videos" padding={false}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-border">
              <th className="px-4 py-2 text-left text-2xs font-medium text-text-tertiary">Video</th>
              <th className="px-3 py-2 text-right text-2xs font-medium text-text-tertiary">Views</th>
              <th className="px-3 py-2 text-right text-2xs font-medium text-text-tertiary">Revenue</th>
              <th className="px-3 py-2 text-right text-2xs font-medium text-text-tertiary">RPM</th>
              <th className="px-3 py-2 text-right text-2xs font-medium text-text-tertiary">CTR</th>
            </tr>
          </thead>
          <tbody>
            {videos.map((v, i) => (
              <tr key={v.id} className="border-b border-surface-border/30 transition-colors hover:bg-surface-hover">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xs text-text-quaternary w-3 tabular-nums">{i + 1}</span>
                    <div className="h-7 w-12 bg-surface-tertiary rounded overflow-hidden flex-shrink-0">
                      {v.thumbnail_url ? (
                        <img src={v.thumbnail_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center"><Film className="h-3 w-3 text-text-quaternary" /></div>
                      )}
                    </div>
                    <span className="text-xs text-text-primary truncate max-w-[180px]">{v.title || 'Untitled'}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-right text-xs tabular-nums text-text-secondary">{formatCompactNumber(v.views)}</td>
                <td className="px-3 py-2 text-right text-xs tabular-nums text-accent-green">{formatCurrency(v.revenue)}</td>
                <td className="px-3 py-2 text-right text-xs tabular-nums text-text-secondary">${v.rpm.toFixed(2)}</td>
                <td className="px-3 py-2 text-right text-xs tabular-nums text-text-secondary">{v.ctr.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
