import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
}

const variantStyles = {
  primary:
    'bg-gradient-to-br from-accent-primary to-accent-primary-hover text-white shadow-sm hover:shadow-md disabled:opacity-40 disabled:shadow-none',
  secondary:
    'bg-surface-tertiary text-text-primary shadow-sm hover:bg-surface-hover hover:shadow-md disabled:opacity-40',
  danger:
    'bg-gradient-to-br from-accent-red to-red-700 text-white shadow-sm hover:shadow-md disabled:opacity-40 disabled:shadow-none',
  ghost:
    'text-text-secondary hover:text-text-primary hover:bg-accent-primary-subtle disabled:opacity-40',
  outline:
    'border border-surface-border text-text-secondary hover:text-text-primary hover:bg-surface-hover hover:border-accent-primary/30 disabled:opacity-40',
};

const sizeStyles = {
  sm: 'h-8 px-3 text-xs gap-2 rounded-md', // 32px height (8pt grid)
  md: 'h-10 px-4 text-sm gap-2 rounded-lg', // 40px height (8pt grid)
  lg: 'h-12 px-5 text-base gap-2 rounded-lg', // 48px height (8pt grid)
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  icon,
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all duration-150 ease-spring',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary',
        'hover:scale-[1.01] active:scale-[0.99]', // Subtle tactile feedback
        variantStyles[variant],
        sizeStyles[size],
        (disabled || loading) && 'pointer-events-none',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Spinner size={size === 'lg' ? 'md' : 'sm'} />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}
