import { type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

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
      <select
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className={cn(
          'w-full appearance-none rounded-lg border bg-surface-tertiary px-3 py-2 pr-8 text-sm text-text-primary transition-colors',
          'focus:border-accent-cyan focus:outline-none focus:ring-1 focus:ring-accent-cyan',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error
            ? 'border-accent-red focus:border-accent-red focus:ring-accent-red'
            : 'border-surface-border',
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
      {error && <p className="text-xs text-accent-red">{error}</p>}
    </div>
  );
}
