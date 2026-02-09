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
    <div className="flex items-center gap-1 rounded-lg border border-surface-border bg-surface-secondary p-1">
      {ranges.map(r => (
        <button
          key={r.key}
          onClick={() => onChange(r.key)}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
            value === r.key ? 'bg-accent-cyan text-white' : 'text-text-secondary hover:text-text-primary hover:bg-surface-tertiary'
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
