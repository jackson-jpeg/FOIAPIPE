import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface BadgeProps {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'default';
  children: ReactNode;
  size?: 'sm' | 'md';
  dot?: boolean;
}

const variantStyles = {
  success: 'bg-accent-green-muted text-accent-green',
  warning: 'bg-accent-amber-muted text-accent-amber',
  danger: 'bg-accent-red-muted text-accent-red',
  info: 'bg-accent-blue-muted text-accent-blue',
  purple: 'bg-accent-purple-muted text-accent-purple',
  default: 'bg-surface-tertiary text-text-secondary',
};

const dotColorStyles = {
  success: 'bg-accent-green',
  warning: 'bg-accent-amber',
  danger: 'bg-accent-red',
  info: 'bg-accent-blue',
  purple: 'bg-accent-purple',
  default: 'bg-text-tertiary',
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
