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
    'bg-accent-primary text-white hover:bg-accent-primary-hover disabled:opacity-40',
  secondary:
    'glass-2 glass-border text-text-primary hover:border-glass-border-hover disabled:opacity-40',
  danger:
    'bg-accent-red text-white hover:bg-red-600 disabled:opacity-40',
  ghost:
    'text-text-secondary hover:text-text-primary disabled:opacity-40',
  outline:
    'glass-border bg-transparent text-text-secondary hover:text-text-primary hover:border-glass-border-hover disabled:opacity-40',
};

const sizeStyles = {
  sm: 'h-7 px-2.5 text-xs gap-1.5 rounded-md',
  md: 'h-8 px-3.5 text-sm gap-2 rounded-lg',
  lg: 'h-10 px-5 text-base gap-2 rounded-lg',
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
        'inline-flex items-center justify-center font-medium transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary',
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
