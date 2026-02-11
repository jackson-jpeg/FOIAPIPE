import { type ReactNode, type CSSProperties } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Sparkline } from './Sparkline';

interface StatCardProps {
  label: string;
  value: string;
  trend?: { value: number; isPositive: boolean };
  icon?: ReactNode;
  sparkline?: number[];
  gradient?: 'amber' | 'blue' | 'emerald' | 'purple' | 'rose' | 'cyan';
  className?: string;
  style?: CSSProperties;
}

export function StatCard({
  label,
  value,
  trend,
  icon,
  sparkline,
  gradient,
  className,
  style,
}: StatCardProps) {
  const gradientClass = gradient ? `gradient-${gradient}` : 'bg-surface-secondary';

  return (
    <div
      className={cn(
        'group rounded-xl border border-surface-border/50 transition-all duration-200 p-6 cursor-pointer',
        'hover:border-accent-primary/30 hover:-translate-y-0.5',
        gradientClass,
        className
      )}
      style={style}
    >
      <div className="flex items-center justify-between mb-3">
        {icon && (
          <span className={cn(
            'inline-flex items-center justify-center w-11 h-11 rounded-lg',
            'transition-transform group-hover:scale-110',
            gradient === 'amber' && 'bg-amber-500/15 text-amber-400',
            gradient === 'blue' && 'bg-blue-500/15 text-blue-400',
            gradient === 'emerald' && 'bg-emerald-500/15 text-emerald-400',
            gradient === 'purple' && 'bg-purple-500/15 text-purple-400',
            gradient === 'rose' && 'bg-rose-500/15 text-rose-400',
            gradient === 'cyan' && 'bg-cyan-500/15 text-cyan-400',
            !gradient && 'bg-surface-tertiary text-text-secondary'
          )}>
            {icon}
          </span>
        )}
        {trend && (
          <span className={cn(
            'text-xs font-medium flex items-center gap-1',
            trend.isPositive ? 'text-accent-green' : 'text-accent-red'
          )}>
            {trend.isPositive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {trend.isPositive ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>
      <p className="text-sm font-medium text-text-secondary mb-1">{label}</p>
      <p className="text-4xl font-bold text-text-primary tracking-tight tabular-nums">{value}</p>
      {sparkline && sparkline.length > 0 && (
        <div className="mt-4 h-8 opacity-50 transition-opacity group-hover:opacity-100">
          <Sparkline
            data={sparkline}
            width={120}
            height={32}
            color="rgba(6, 182, 212, 0.5)"
            className="text-accent-primary"
          />
        </div>
      )}
    </div>
  );
}
