import { type ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Sparkline } from './Sparkline';

interface StatCardProps {
  label: string;
  value: string;
  trend?: { value: number; isPositive: boolean };
  accentColor?: string;
  icon?: ReactNode;
  sparkline?: number[]; // Optional ambient data visualization
}

export function StatCard({
  label,
  value,
  trend,
  icon,
  sparkline,
}: StatCardProps) {
  return (
    <div className="group rounded-xl border border-surface-border bg-surface-secondary p-5 shadow-card transition-all duration-200 hover:border-surface-border-light hover:shadow-card-hover">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-text-tertiary uppercase tracking-wider">{label}</p>
        {icon && (
          <div className="text-text-quaternary transition-colors group-hover:text-text-tertiary">
            {icon}
          </div>
        )}
      </div>
      <p className="text-2xl font-semibold text-text-primary tracking-tight tabular-nums">{value}</p>
      {trend && (
        <div className="mt-2 flex items-center gap-1">
          {trend.isPositive ? (
            <TrendingUp className="h-3 w-3 text-accent-green" />
          ) : (
            <TrendingDown className="h-3 w-3 text-accent-red" />
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
      {/* Ambient sparkline visualization */}
      {sparkline && sparkline.length > 0 && (
        <div className="mt-3 h-8 opacity-60 transition-opacity group-hover:opacity-100">
          <Sparkline
            data={sparkline}
            width={120}
            height={32}
            color="rgba(232, 97, 77, 0.5)"
            className="text-accent-primary"
          />
        </div>
      )}
    </div>
  );
}
