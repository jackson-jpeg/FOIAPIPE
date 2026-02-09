import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface BadgeProps {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'default';
  children: ReactNode;
  size?: 'sm' | 'md';
  dot?: boolean;
}

const variantStyles = {
  success: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20',
  warning: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20',
  danger: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20',
  info: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20',
  purple: 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20',
  default: 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20',
};

const dotColorStyles = {
  success: 'bg-emerald-600',
  warning: 'bg-amber-600',
  danger: 'bg-red-600',
  info: 'bg-blue-600',
  purple: 'bg-purple-600',
  default: 'bg-gray-600',
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
