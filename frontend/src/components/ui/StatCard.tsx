import { type ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/cn';

interface StatCardProps {
  label: string;
  value: string;
  trend?: { value: number; isPositive: boolean };
  accentColor?: string;
  icon?: ReactNode;
}

export function StatCard({
  label,
  value,
  trend,
  icon,
}: StatCardProps) {
  return (
    <div className="group rounded-xl border border-surface-border bg-surface-secondary p-4 shadow-card transition-all duration-200 hover:border-surface-border-light hover:shadow-card-hover">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-text-tertiary">{label}</p>
        {icon && (
          <div className="text-text-quaternary transition-colors group-hover:text-text-tertiary">
            {icon}
          </div>
        )}
      </div>
      <p className="text-xl font-semibold text-text-primary tracking-tight">{value}</p>
      {trend && (
        <div className="mt-1.5 flex items-center gap-1">
          {trend.isPositive ? (
            <TrendingUp className="h-3 w-3 text-accent-green" />
          ) : (
            <TrendingDown className="h-3 w-3 text-accent-red" />
          )}
          <span
            className={cn(
              'text-2xs font-medium',
              trend.isPositive ? 'text-accent-green' : 'text-accent-red'
            )}
          >
            {trend.isPositive ? '+' : ''}
            {trend.value}%
          </span>
        </div>
      )}
    </div>
  );
}
