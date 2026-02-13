import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface BadgeProps {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'default';
  children: ReactNode;
  size?: 'sm' | 'md';
  dot?: boolean;
}

const variantStyles = {
  success: 'bg-emerald-500/6 text-emerald-400',
  warning: 'bg-amber-500/6 text-amber-400',
  danger: 'bg-red-500/6 text-red-400',
  info: 'bg-cyan-500/6 text-cyan-400',
  purple: 'bg-purple-500/6 text-purple-400',
  default: 'bg-slate-500/6 text-slate-400',
};

const dotColorStyles = {
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  danger: 'bg-red-400',
  info: 'bg-cyan-400',
  purple: 'bg-purple-400',
  default: 'bg-slate-400',
};

const sizeStyles = {
  sm: 'px-1 py-px text-3xs gap-1',
  md: 'px-1.5 py-0.5 text-2xs gap-1.5',
};

export function Badge({ variant = 'default', children, size = 'md', dot = false }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md font-medium leading-none whitespace-nowrap',
        variantStyles[variant],
        sizeStyles[size]
      )}
    >
      {dot && (
        <span
          className={cn('h-1 w-1 rounded-full', dotColorStyles[variant])}
        />
      )}
      {children}
    </span>
  );
}
