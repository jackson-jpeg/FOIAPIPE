import { cn } from '@/lib/cn';

const ranges = [
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: 'ytd', label: 'YTD' },
  { key: 'all', label: 'All' },
];

interface TimeRangeSelectorProps {
  value: string;
  onChange: (range: string) => void;
}

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-surface-border bg-surface-secondary p-0.5">
      {ranges.map(r => (
        <button
          key={r.key}
          onClick={() => onChange(r.key)}
          className={cn(
            'px-2.5 py-1 text-2xs font-medium rounded-md transition-all duration-100',
            value === r.key
              ? 'bg-accent-primary text-white shadow-sm shadow-accent-primary/20'
              : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-tertiary/50'
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
