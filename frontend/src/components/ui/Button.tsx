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
    'bg-accent-cyan text-surface-primary hover:bg-accent-cyan/90 active:bg-accent-cyan/80 disabled:bg-accent-cyan/40',
  danger:
    'bg-accent-red text-white hover:bg-accent-red/90 active:bg-accent-red/80 disabled:bg-accent-red/40',
  ghost:
    'bg-transparent text-text-secondary hover:bg-surface-tertiary hover:text-text-primary active:bg-surface-border disabled:text-text-tertiary',
  outline:
    'bg-transparent border border-surface-border text-text-secondary hover:border-accent-cyan hover:text-accent-cyan active:bg-surface-tertiary disabled:border-surface-border/50 disabled:text-text-tertiary',
};

const sizeStyles = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2.5',
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
        'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary',
        variantStyles[variant],
        sizeStyles[size],
        (disabled || loading) && 'cursor-not-allowed',
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
