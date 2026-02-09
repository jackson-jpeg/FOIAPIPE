import { type ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/cn';

interface StatCardProps {
  label: string;
  value: string;
  trend?: { value: number; isPositive: boolean };
  accentColor?: 'cyan' | 'green' | 'amber' | 'red' | 'purple';
  icon?: ReactNode;
}

const borderColorMap = {
  cyan: 'border-l-accent-cyan',
  green: 'border-l-accent-green',
  amber: 'border-l-accent-amber',
  red: 'border-l-accent-red',
  purple: 'border-l-accent-purple',
};

const iconBgMap = {
  cyan: 'bg-accent-cyan/10 text-accent-cyan',
  green: 'bg-accent-green/10 text-accent-green',
  amber: 'bg-accent-amber/10 text-accent-amber',
  red: 'bg-accent-red/10 text-accent-red',
  purple: 'bg-accent-purple/10 text-accent-purple',
};

export function StatCard({
  label,
  value,
  trend,
  accentColor = 'cyan',
  icon,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-surface-border bg-surface-secondary border-l-4 p-5',
        borderColorMap[accentColor]
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
            {label}
          </p>
          <p className="text-2xl font-bold font-mono text-text-primary">{value}</p>
          {trend && (
            <div className="flex items-center gap-1">
              {trend.isPositive ? (
                <TrendingUp className="h-3.5 w-3.5 text-accent-green" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-accent-red" />
              )}
              <span
                className={cn(
                  'text-xs font-medium',
                  trend.isPositive ? 'text-accent-green' : 'text-accent-red'
                )}
              >
                {trend.isPositive ? '+' : ''}
                {trend.value}%
              </span>
            </div>
          )}
        </div>
        {icon && (
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg',
              iconBgMap[accentColor]
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
