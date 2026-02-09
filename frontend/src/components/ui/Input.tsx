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
      <div className="space-y-1.5">
        {label && (
          <label className="block text-xs font-medium text-text-secondary">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              'h-8 w-full rounded-lg border bg-surface-tertiary/40 px-3 text-sm text-text-primary placeholder:text-text-quaternary',
              'transition-all duration-150',
              'focus:border-accent-primary/50 focus:bg-surface-tertiary/60 focus:outline-none focus:ring-2 focus:ring-accent-primary/10',
              'disabled:pointer-events-none disabled:opacity-40',
              error
                ? 'border-accent-red/50 focus:border-accent-red/50 focus:ring-accent-red/10'
                : 'border-surface-border hover:border-surface-border-light',
              icon && 'pl-10',
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
