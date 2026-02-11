import { type InputHTMLAttributes, type ReactNode, forwardRef } from 'react';
import { cn } from '@/lib/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className, disabled, ...props }, ref) => {
    return (
      <div className="space-y-2">
        {label && (
          <label className="block text-sm font-medium text-text-secondary">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              'h-11 w-full rounded-lg border bg-surface-primary px-4 text-base text-text-primary placeholder:text-text-quaternary',
              'transition-all duration-150',
              'focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20',
              'disabled:pointer-events-none disabled:opacity-40 disabled:bg-surface-tertiary',
              error
                ? 'border-accent-red focus:border-accent-red focus:ring-accent-red/20'
                : 'border-surface-border hover:border-accent-primary/50',
              icon && 'pl-11',
              className
            )}
            disabled={disabled}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-accent-red">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
