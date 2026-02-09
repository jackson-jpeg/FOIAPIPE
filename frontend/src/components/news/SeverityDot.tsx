import { cn } from '@/lib/cn';

interface SeverityDotProps {
  score: number;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export function SeverityDot({ score, size = 'md', showLabel = false }: SeverityDotProps) {
  const color = score >= 8 ? 'bg-accent-red' : score >= 5 ? 'bg-accent-amber' : 'bg-accent-green';
  const ring = score >= 8 ? 'ring-accent-red/30' : score >= 5 ? 'ring-accent-amber/30' : 'ring-accent-green/30';
  const label = score >= 8 ? 'Critical' : score >= 5 ? 'Medium' : 'Low';
  const sizeClass = size === 'sm' ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5';

  return (
    <div className="flex items-center gap-2">
      <span className={cn('rounded-full ring-2', color, ring, sizeClass)} />
      {showLabel && (
        <span className="text-xs text-text-secondary">{label} ({score})</span>
      )}
    </div>
  );
}
