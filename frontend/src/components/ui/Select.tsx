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
        <label className="block text-3xs font-medium uppercase tracking-wider text-text-quaternary">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className={cn(
            'h-8 w-full appearance-none rounded-lg bg-transparent pl-3 pr-8 text-sm text-text-primary',
            'border glass-border transition-colors duration-150',
            'focus:border-accent-primary/40 focus:outline-none',
            'disabled:pointer-events-none disabled:opacity-40',
            error
              ? 'border-accent-red focus:border-accent-red'
              : 'hover:border-glass-border-hover',
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
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-text-tertiary" />
      </div>
      {error && <p className="text-3xs text-accent-red">{error}</p>}
    </div>
  );
}
