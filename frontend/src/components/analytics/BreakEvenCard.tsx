import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency } from '@/lib/formatters';

interface BreakEvenData {
  total_revenue: number;
  total_expenses: number;
  foia_costs: number;
  net_profit: number;
  profitable_videos: number;
  total_videos: number;
  profitability_rate: number;
  avg_cost_per_video: number;
  avg_revenue_per_video: number;
  break_even_at: string;
}

interface BreakEvenCardProps {
  data: BreakEvenData | null;
}

export function BreakEvenCard({ data }: BreakEvenCardProps) {
  if (!data) return null;

  const isProfitable = data.net_profit >= 0;

  return (
    <Card title="Break-Even Analysis">
      <div className="space-y-4">
        {/* Profit status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">Overall Status</span>
          <Badge variant={isProfitable ? 'success' : 'danger'} size="md">
            {isProfitable ? 'Profitable' : 'Not Yet Profitable'}
          </Badge>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-surface-tertiary/30 p-3">
            <p className="text-2xs text-text-quaternary mb-0.5">Total Revenue</p>
            <p className="text-sm font-semibold text-accent-emerald tabular-nums">{formatCurrency(data.total_revenue)}</p>
          </div>
          <div className="rounded-lg bg-surface-tertiary/30 p-3">
            <p className="text-2xs text-text-quaternary mb-0.5">Total Expenses</p>
            <p className="text-sm font-semibold text-accent-red tabular-nums">{formatCurrency(data.total_expenses)}</p>
          </div>
          <div className="rounded-lg bg-surface-tertiary/30 p-3">
            <p className="text-2xs text-text-quaternary mb-0.5">FOIA Costs</p>
            <p className="text-sm font-semibold text-text-primary tabular-nums">{formatCurrency(data.foia_costs)}</p>
          </div>
          <div className="rounded-lg bg-surface-tertiary/30 p-3">
            <p className="text-2xs text-text-quaternary mb-0.5">Net Profit</p>
            <p className={`text-sm font-semibold tabular-nums ${isProfitable ? 'text-accent-emerald' : 'text-accent-red'}`}>
              {formatCurrency(data.net_profit)}
            </p>
          </div>
        </div>

        {/* Per-video metrics */}
        <div className="border-t border-surface-border/30 pt-3 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-text-tertiary">Profitable Videos</span>
            <span className="text-text-primary tabular-nums">{data.profitable_videos} / {data.total_videos} ({data.profitability_rate}%)</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-text-tertiary">Avg Cost per Video</span>
            <span className="text-text-primary tabular-nums">{formatCurrency(data.avg_cost_per_video)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-text-tertiary">Avg Revenue per Video</span>
            <span className="text-text-primary tabular-nums">{formatCurrency(data.avg_revenue_per_video)}</span>
          </div>
        </div>

        {/* Break-even status */}
        <div className="rounded-lg border border-surface-border p-3 text-center">
          <p className="text-xs text-text-tertiary">{data.break_even_at}</p>
        </div>
      </div>
    </Card>
  );
}
