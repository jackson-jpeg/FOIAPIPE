import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface BadgeProps {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'default';
  children: ReactNode;
  size?: 'sm' | 'md';
  dot?: boolean;
}

const variantStyles = {
  success: 'bg-accent-green/10 text-accent-green',
  warning: 'bg-accent-amber/10 text-accent-amber',
  danger: 'bg-accent-red/10 text-accent-red',
  info: 'bg-accent-cyan/10 text-accent-cyan',
  purple: 'bg-accent-purple/10 text-accent-purple',
  default: 'bg-surface-tertiary text-text-secondary',
};

const dotColorStyles = {
  success: 'bg-accent-green',
  warning: 'bg-accent-amber',
  danger: 'bg-accent-red',
  info: 'bg-accent-cyan',
  purple: 'bg-accent-purple',
  default: 'bg-text-tertiary',
};

const sizeStyles = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-xs',
};

export function Badge({ variant = 'default', children, size = 'md', dot = false }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        variantStyles[variant],
        sizeStyles[size]
      )}
    >
      {dot && (
        <span
          className={cn('h-1.5 w-1.5 rounded-full', dotColorStyles[variant])}
        />
      )}
      {children}
    </span>
  );
}
