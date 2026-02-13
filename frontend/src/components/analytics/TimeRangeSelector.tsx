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
    <div className="flex items-center gap-0.5 glass-2 rounded-lg p-0.5">
      {ranges.map(r => (
        <button
          key={r.key}
          onClick={() => onChange(r.key)}
          className={cn(
            'px-2 py-0.5 text-3xs font-medium rounded-md transition-colors duration-100',
            value === r.key
              ? 'bg-accent-primary text-white'
              : 'text-text-quaternary hover:text-text-secondary'
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
