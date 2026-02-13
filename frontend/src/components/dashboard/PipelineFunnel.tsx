import { Card } from '@/components/ui/Card';
import { ArrowRight } from 'lucide-react';

interface FunnelStage {
  stage: string;
  count: number;
  color: string;
}

interface PipelineFunnelProps {
  stages: FunnelStage[];
}

export function PipelineFunnel({ stages }: PipelineFunnelProps) {
  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  return (
    <Card title="Pipeline Overview">
      <div className="flex items-end gap-1">
        {stages.map((stage, i) => {
          const height = Math.max((stage.count / maxCount) * 100, 12);
          const conversionRate =
            i > 0 && stages[i - 1].count > 0
              ? ((stage.count / stages[i - 1].count) * 100).toFixed(0)
              : null;

          return (
            <div key={stage.stage} className="flex items-end flex-1 min-w-0">
              {i > 0 && (
                <div className="flex flex-col items-center justify-end pb-6 px-0.5 shrink-0">
                  <span className="text-3xs font-mono text-text-quaternary tabular-nums mb-0.5">
                    {conversionRate}%
                  </span>
                  <ArrowRight className="h-2.5 w-2.5 text-text-quaternary" />
                </div>
              )}
              <div className="flex flex-col items-center flex-1 min-w-0 gap-1">
                <span className="text-sm font-mono font-semibold text-text-primary tabular-nums">
                  {stage.count.toLocaleString()}
                </span>
                <div
                  className="w-full rounded-sm transition-all duration-700 ease-out-expo"
                  style={{
                    height: `${height}px`,
                    backgroundColor: stage.color,
                    opacity: 0.7,
                    minHeight: '12px',
                  }}
                />
                <span className="text-3xs font-mono uppercase text-text-quaternary text-center leading-tight truncate w-full">
                  {stage.stage}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
