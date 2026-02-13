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
          <label className="block text-3xs font-medium uppercase tracking-wider text-text-quaternary">
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
              'h-8 w-full rounded-lg bg-transparent px-3 text-sm text-text-primary placeholder:text-text-quaternary',
              'border glass-border transition-colors duration-150',
              'focus:border-accent-primary/40 focus:outline-none',
              'disabled:pointer-events-none disabled:opacity-40',
              error
                ? 'border-accent-red focus:border-accent-red'
                : 'hover:border-glass-border-hover',
              icon && 'pl-9',
              className
            )}
            disabled={disabled}
            {...props}
          />
        </div>
        {error && <p className="text-3xs text-accent-red">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
