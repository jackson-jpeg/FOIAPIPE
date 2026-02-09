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
    'bg-accent-primary text-white shadow-sm shadow-accent-primary/20 hover:bg-accent-primary-hover disabled:opacity-40 disabled:shadow-none',
  secondary:
    'bg-surface-tertiary text-text-primary shadow-card hover:bg-surface-hover hover:shadow-card-hover disabled:opacity-40',
  danger:
    'bg-accent-red text-white shadow-sm shadow-accent-red/20 hover:bg-accent-red/90 disabled:opacity-40 disabled:shadow-none',
  ghost:
    'text-text-secondary hover:text-text-primary hover:bg-surface-tertiary disabled:opacity-40',
  outline:
    'border border-surface-border-light text-text-secondary hover:text-text-primary hover:bg-surface-hover hover:border-surface-border-light disabled:opacity-40',
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
        'active:scale-[0.98]', // Spring scale on press
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
