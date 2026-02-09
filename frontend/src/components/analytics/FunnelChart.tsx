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
  const colors = ['#e8614d', '#60a5fa', '#a78bfa', '#34d399', '#fbbf24'];

  return (
    <Card title="Pipeline Funnel">
      <div className="space-y-2.5">
        {steps.map((step, i) => (
          <div key={step.label} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-secondary">{step.label}</span>
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-text-primary tabular-nums">{step.count}</span>
                {step.conversion_rate !== undefined && i > 0 && (
                  <span className="text-2xs text-text-quaternary tabular-nums">({step.conversion_rate}%)</span>
                )}
              </div>
            </div>
            <div className="h-4 bg-surface-tertiary/50 rounded-md overflow-hidden">
              <div
                className="h-full rounded-md transition-all duration-700 ease-out-expo"
                style={{ width: `${(step.count / maxCount) * 100}%`, backgroundColor: colors[i % colors.length], opacity: 0.8 }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
