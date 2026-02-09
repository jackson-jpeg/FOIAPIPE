import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
}

const variantStyles = {
  primary:
    'bg-accent-primary text-white shadow-sm shadow-accent-primary/20 hover:bg-accent-primary-hover active:bg-accent-primary-hover/90 disabled:opacity-40 disabled:shadow-none',
  danger:
    'bg-accent-red text-white shadow-sm shadow-accent-red/20 hover:bg-accent-red/80 active:bg-accent-red/70 disabled:opacity-40 disabled:shadow-none',
  ghost:
    'text-text-secondary hover:text-text-primary hover:bg-surface-tertiary active:bg-surface-border disabled:opacity-40',
  outline:
    'border border-surface-border-light text-text-secondary hover:text-text-primary hover:bg-surface-hover hover:border-surface-border-light active:bg-surface-tertiary disabled:opacity-40',
};

const sizeStyles = {
  sm: 'h-7 px-2.5 text-xs gap-1.5 rounded-md',
  md: 'h-8 px-3 text-sm gap-1.5 rounded-lg',
  lg: 'h-10 px-4 text-sm gap-2 rounded-lg',
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
        'inline-flex items-center justify-center font-medium transition-all duration-100 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/40 focus-visible:ring-offset-1 focus-visible:ring-offset-surface-primary',
        'active:scale-[0.97]',
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
