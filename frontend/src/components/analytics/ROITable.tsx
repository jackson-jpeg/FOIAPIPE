import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface ROIItem {
  foia_id: string;
  case_number: string;
  cost: number;
  revenue: number;
  roi: number;
}

interface ROITableProps {
  data: ROIItem[];
}

export function ROITable({ data }: ROITableProps) {
  return (
    <Card title="FOIA ROI Analysis">
      {data.length === 0 ? (
        <p className="text-sm text-text-tertiary text-center py-8">No ROI data yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border/50">
                <th className="text-left py-2.5 px-3 text-xs font-medium text-text-secondary">Case</th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-text-secondary">Cost</th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-text-secondary">Revenue</th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-text-secondary">ROI</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item.foia_id} className="border-t border-surface-border/30 hover:bg-surface-hover transition-colors">
                  <td className="py-2.5 px-3 font-mono text-xs text-text-primary">{item.case_number || 'N/A'}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-text-secondary">${item.cost.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-accent-green">${item.revenue.toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-right">
                    <Badge variant={item.roi > 0 ? 'success' : item.roi === 0 ? 'default' : 'danger'} size="sm">
                      {item.roi > 0 ? '+' : ''}{item.roi}%
                    </Badge>
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
