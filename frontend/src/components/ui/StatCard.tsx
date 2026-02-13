import { type ReactNode, type CSSProperties } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Sparkline } from './Sparkline';

type StatVariant = 'hero' | 'metric' | 'inline';

interface StatCardProps {
  label: string;
  value: string;
  trend?: { value: number; isPositive: boolean };
  icon?: ReactNode;
  sparkline?: number[];
  variant?: StatVariant;
  className?: string;
  style?: CSSProperties;
  /** @deprecated Use variant instead */
  gradient?: string;
}

export function StatCard({
  label,
  value,
  trend,
  sparkline,
  variant = 'metric',
  className,
  style,
}: StatCardProps) {
  if (variant === 'hero') {
    return (
      <div
        className={cn('glass-1 rounded-lg px-4 py-3', className)}
        style={style}
      >
        <p className="text-2xs font-medium uppercase tracking-wider text-text-tertiary mb-1">{label}</p>
        <p className="text-data-2xl font-mono text-text-primary">{value}</p>
        {trend && (
          <span className={cn(
            'inline-flex items-center gap-1 text-2xs font-medium mt-1',
            trend.isPositive ? 'text-accent-green' : 'text-accent-red'
          )}>
            {trend.isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {trend.isPositive ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div
        className={cn('glass-1 rounded-lg px-3 py-2 flex items-baseline gap-2', className)}
        style={style}
      >
        <span className="text-lg font-mono text-text-primary tabular-nums">{value}</span>
        <span className="text-2xs text-text-tertiary">{label}</span>
        {trend && (
          <span className={cn(
            'inline-flex items-center gap-0.5 text-3xs font-medium ml-auto',
            trend.isPositive ? 'text-accent-green' : 'text-accent-red'
          )}>
            {trend.isPositive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
            {trend.isPositive ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>
    );
  }

  // Default: metric variant
  return (
    <div
      className={cn('glass-2 rounded-lg px-3 py-2.5', className)}
      style={style}
    >
      <p className="text-2xs font-medium uppercase tracking-wider text-text-tertiary mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className="text-data-lg font-mono text-text-primary">{value}</p>
        {trend && (
          <span className={cn(
            'inline-flex items-center gap-0.5 rounded px-1 py-px text-3xs font-medium',
            trend.isPositive
              ? 'bg-accent-green-subtle text-accent-green'
              : 'bg-accent-red-subtle text-accent-red'
          )}>
            {trend.isPositive ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>
      {sparkline && sparkline.length > 0 && (
        <div className="mt-2 h-6 opacity-40">
          <Sparkline
            data={sparkline}
            width={120}
            height={24}
            color="rgba(6, 182, 212, 0.5)"
            className="text-accent-primary"
          />
        </div>
      )}
    </div>
  );
}
