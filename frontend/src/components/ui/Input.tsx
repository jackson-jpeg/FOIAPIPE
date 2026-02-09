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
              'w-full rounded-lg border bg-surface-tertiary px-3 py-2 text-sm text-text-primary placeholder-text-tertiary transition-colors',
              'focus:border-accent-cyan focus:outline-none focus:ring-1 focus:ring-accent-cyan',
              'disabled:cursor-not-allowed disabled:opacity-50',
              error
                ? 'border-accent-red focus:border-accent-red focus:ring-accent-red'
                : 'border-surface-border',
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
