import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface BadgeProps {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'default';
  children: ReactNode;
  size?: 'sm' | 'md';
  dot?: boolean;
}

const variantStyles = {
  success: 'bg-emerald-500/10 text-emerald-400 ring-1 ring-inset ring-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-400 ring-1 ring-inset ring-amber-500/20',
  danger: 'bg-red-500/10 text-red-400 ring-1 ring-inset ring-red-500/20',
  info: 'bg-cyan-500/10 text-cyan-400 ring-1 ring-inset ring-cyan-500/20',
  purple: 'bg-purple-500/10 text-purple-400 ring-1 ring-inset ring-purple-500/20',
  default: 'bg-slate-500/10 text-slate-400 ring-1 ring-inset ring-slate-500/20',
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
  sm: 'px-1.5 py-0.5 text-2xs gap-1',
  md: 'px-2 py-0.5 text-xs gap-1.5',
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
