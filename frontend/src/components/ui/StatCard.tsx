import { type ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Sparkline } from './Sparkline';

interface StatCardProps {
  label: string;
  value: string;
  trend?: { value: number; isPositive: boolean };
  icon?: ReactNode;
  sparkline?: number[]; // Optional ambient data visualization
  gradient?: 'amber' | 'blue' | 'emerald' | 'purple' | 'rose'; // Gradient variant for personality
}

export function StatCard({
  label,
  value,
  trend,
  icon,
  sparkline,
  gradient,
}: StatCardProps) {
  const gradientClass = gradient ? `gradient-${gradient}` : 'bg-white';

  return (
    <div className={cn(
      'group rounded-xl shadow-card transition-all duration-200 p-6 cursor-pointer',
      'hover:shadow-card-hover hover:scale-[1.02]',
      gradientClass
    )}>
      <div className="flex items-center justify-between mb-3">
        {icon && (
          <span className={cn(
            'inline-flex items-center justify-center w-10 h-10 rounded-lg',
            'transition-transform group-hover:scale-110',
            gradient === 'amber' && 'bg-amber-100 text-amber-600',
            gradient === 'blue' && 'bg-blue-100 text-blue-600',
            gradient === 'emerald' && 'bg-emerald-100 text-emerald-600',
            gradient === 'purple' && 'bg-purple-100 text-purple-600',
            gradient === 'rose' && 'bg-rose-100 text-rose-600',
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
      <p className="text-3xl font-bold text-text-primary tracking-tight tabular-nums">{value}</p>
      {/* Ambient sparkline visualization */}
      {sparkline && sparkline.length > 0 && (
        <div className="mt-4 h-8 opacity-50 transition-opacity group-hover:opacity-100">
          <Sparkline
            data={sparkline}
            width={120}
            height={32}
            color="rgba(217, 119, 6, 0.5)"
            className="text-accent-primary"
          />
        </div>
      )}
    </div>
  );
}
