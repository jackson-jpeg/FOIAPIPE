import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface PerformanceItem {
  agency_name: string;
  total_requests: number;
  fulfilled: number;
  denied: number;
  response_rate: number;
  denial_rate: number;
  avg_days_to_fulfill: number;
  avg_cost: number;
}

interface FoiaPerformanceTableProps {
  data: PerformanceItem[];
}

export function FoiaPerformanceTable({ data }: FoiaPerformanceTableProps) {
  return (
    <Card title="Agency FOIA Performance">
      {data.length === 0 ? (
        <p className="text-sm text-text-tertiary text-center py-8">No performance data yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border/50">
                <th className="text-left py-2.5 px-3 text-xs font-medium text-text-secondary">Agency</th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-text-secondary">Requests</th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-text-secondary">Response Rate</th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-text-secondary">Denial Rate</th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-text-secondary">Avg Days</th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-text-secondary">Avg Cost</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item.agency_name} className="border-t border-surface-border/30 hover:bg-surface-hover transition-colors">
                  <td className="py-2.5 px-3 text-text-primary font-medium">{item.agency_name}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-text-secondary">{item.total_requests}</td>
                  <td className="py-2.5 px-3 text-right">
                    <Badge variant={item.response_rate >= 70 ? 'success' : item.response_rate >= 40 ? 'warning' : 'danger'} size="sm">
                      {item.response_rate}%
                    </Badge>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <Badge variant={item.denial_rate <= 10 ? 'success' : item.denial_rate <= 30 ? 'warning' : 'danger'} size="sm">
                      {item.denial_rate}%
                    </Badge>
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-text-secondary">{item.avg_days_to_fulfill}d</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-text-secondary">${item.avg_cost.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
