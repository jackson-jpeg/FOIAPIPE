import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency } from '@/lib/formatters';

interface ProfitItem {
  video_id: string;
  title: string;
  published_at: string | null;
  foia_cost: number;
  revenue: number;
  net_profit: number;
  roi_percent: number | null;
}

interface VideoProfitabilityTableProps {
  data: ProfitItem[];
}

export function VideoProfitabilityTable({ data }: VideoProfitabilityTableProps) {
  return (
    <Card title="Video Profitability Ranking">
      {data.length === 0 ? (
        <p className="text-sm text-text-tertiary text-center py-8">No profitability data yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border/50">
                <th className="text-left py-2.5 px-3 text-xs font-medium text-text-secondary">Video</th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-text-secondary">FOIA Cost</th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-text-secondary">Revenue</th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-text-secondary">Net Profit</th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-text-secondary">ROI</th>
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 15).map((item) => (
                <tr key={item.video_id} className="border-t border-surface-border/30 hover:bg-surface-hover transition-colors">
                  <td className="py-2.5 px-3 text-text-primary max-w-[200px] truncate">{item.title || 'Untitled'}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-text-secondary">{formatCurrency(item.foia_cost)}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-accent-emerald">{formatCurrency(item.revenue)}</td>
                  <td className={`py-2.5 px-3 text-right tabular-nums ${item.net_profit >= 0 ? 'text-accent-emerald' : 'text-accent-red'}`}>
                    {formatCurrency(item.net_profit)}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {item.roi_percent != null ? (
                      <Badge variant={item.roi_percent > 0 ? 'success' : 'danger'} size="sm">
                        {item.roi_percent > 0 ? '+' : ''}{item.roi_percent}%
                      </Badge>
                    ) : (
                      <span className="text-text-quaternary">--</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
