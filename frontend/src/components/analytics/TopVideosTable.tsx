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
    <Card title="Top Videos">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-border">
              <th className="px-3 py-2 text-left text-xs font-medium text-text-tertiary uppercase">Video</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-text-tertiary uppercase">Views</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-text-tertiary uppercase">Revenue</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-text-tertiary uppercase">RPM</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-text-tertiary uppercase">CTR</th>
            </tr>
          </thead>
          <tbody>
            {videos.map((v, i) => (
              <tr key={v.id} className="border-b border-surface-border hover:bg-surface-tertiary/50">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-text-tertiary w-4">{i + 1}</span>
                    <div className="h-8 w-14 bg-surface-tertiary rounded overflow-hidden flex-shrink-0">
                      {v.thumbnail_url ? (
                        <img src={v.thumbnail_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center"><Film className="h-4 w-4 text-text-tertiary" /></div>
                      )}
                    </div>
                    <span className="text-sm text-text-primary truncate max-w-[200px]">{v.title || 'Untitled'}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-right text-sm font-mono text-text-secondary">{formatCompactNumber(v.views)}</td>
                <td className="px-3 py-2 text-right text-sm font-mono text-accent-green">{formatCurrency(v.revenue)}</td>
                <td className="px-3 py-2 text-right text-sm font-mono text-text-secondary">${v.rpm.toFixed(2)}</td>
                <td className="px-3 py-2 text-right text-sm font-mono text-text-secondary">{v.ctr.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
