import { Card } from '@/components/ui/Card';

interface FunnelStep {
  label: string;
  count: number;
  conversion_rate?: number;
}

interface FunnelChartProps {
  steps: FunnelStep[];
}

export function FunnelChart({ steps }: FunnelChartProps) {
  const maxCount = Math.max(...steps.map(s => s.count), 1);
  const colors = ['#06b6d4', '#3b82f6', '#a855f7', '#22c55e', '#f59e0b'];

  return (
    <Card title="Pipeline Funnel">
      <div className="space-y-3">
        {steps.map((step, i) => (
          <div key={step.label} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">{step.label}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-text-primary">{step.count}</span>
                {step.conversion_rate !== undefined && i > 0 && (
                  <span className="text-xs text-text-tertiary">({step.conversion_rate}%)</span>
                )}
              </div>
            </div>
            <div className="h-6 bg-surface-tertiary rounded-md overflow-hidden">
              <div
                className="h-full rounded-md transition-all duration-500"
                style={{ width: `${(step.count / maxCount) * 100}%`, backgroundColor: colors[i % colors.length] }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
