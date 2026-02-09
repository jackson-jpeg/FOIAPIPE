import { type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { ChevronDown } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string;
  options: SelectOption[];
  error?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
}

export function Select({
  label,
  options,
  value,
  onChange,
  error,
  placeholder,
  className,
  disabled,
  ...props
}: SelectProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-xs font-medium text-text-secondary">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className={cn(
            'h-8 w-full appearance-none rounded-lg border bg-surface-tertiary/40 pl-3 pr-8 text-sm text-text-primary',
            'transition-all duration-150',
            'focus:border-accent-primary/50 focus:bg-surface-tertiary/60 focus:outline-none focus:ring-2 focus:ring-accent-primary/10',
            'disabled:pointer-events-none disabled:opacity-40',
            error
              ? 'border-accent-red/50 focus:border-accent-red/50 focus:ring-accent-red/10'
              : 'border-surface-border hover:border-surface-border-light',
            className
          )}
          disabled={disabled}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
      </div>
      {error && <p className="text-xs text-accent-red">{error}</p>}
    </div>
  );
}
