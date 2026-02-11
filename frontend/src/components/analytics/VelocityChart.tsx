import { Card } from '@/components/ui/Card';

interface VelocityStage {
  stage: string;
  avg_days: number;
}

interface VelocityChartProps {
  data: VelocityStage[];
}

export function VelocityChart({ data }: VelocityChartProps) {
  const maxDays = Math.max(...data.map(d => d.avg_days), 1);
  const stageColors = ['#06b6d4', '#a855f7', '#22c55e'];

  return (
    <Card title="Pipeline Velocity">
      {data.length === 0 ? (
        <p className="text-sm text-text-tertiary text-center py-8">No velocity data yet</p>
      ) : (
        <div className="space-y-4">
          {data.map((stage, i) => (
            <div key={stage.stage} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-secondary">{stage.stage}</span>
                <span className="font-mono font-medium text-text-primary tabular-nums">
                  {stage.avg_days} days
                </span>
              </div>
              <div className="h-3 bg-surface-tertiary/50 rounded-md overflow-hidden">
                <div
                  className="h-full rounded-md transition-all duration-700 ease-out-expo"
                  style={{
                    width: `${Math.max((stage.avg_days / maxDays) * 100, 4)}%`,
                    backgroundColor: stageColors[i % stageColors.length],
                    opacity: 0.8,
                  }}
                />
              </div>
            </div>
          ))}
          <div className="pt-2 border-t border-surface-border/30">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-tertiary">Total avg pipeline</span>
              <span className="font-mono font-medium text-accent-primary tabular-nums">
                {data.reduce((sum, d) => sum + d.avg_days, 0).toFixed(1)} days
              </span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
