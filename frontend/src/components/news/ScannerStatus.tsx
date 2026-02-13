import { cn } from '@/lib/cn';
import { Activity, Clock } from 'lucide-react';
import { formatRelativeTime } from '@/lib/formatters';

interface ScannerStatusProps {
  isScanning: boolean;
  lastScanAt: string | null;
  nextScanAt: string | null;
  articlesFoundLastScan: number;
}

export function ScannerStatus({ isScanning, lastScanAt, nextScanAt, articlesFoundLastScan }: ScannerStatusProps) {
  return (
    <div className="flex items-center gap-4 glass-2 rounded-lg px-3 py-2 text-2xs font-mono">
      <div className="flex items-center gap-1.5">
        <span className={cn(
          'h-1.5 w-1.5 rounded-full transition-colors',
          isScanning ? 'bg-accent-green animate-pulse-subtle' : 'bg-text-quaternary'
        )} />
        <span className="text-2xs font-medium text-text-primary">
          {isScanning ? 'Scanning' : 'Idle'}
        </span>
      </div>
      <div className="h-3 w-px bg-glass-border" />
      {lastScanAt && (
        <div className="flex items-center gap-1 text-text-tertiary">
          <Activity className="h-2.5 w-2.5" />
          <span>{formatRelativeTime(lastScanAt)}</span>
        </div>
      )}
      {!isScanning && nextScanAt && (
        <div className="flex items-center gap-1 text-text-tertiary">
          <Clock className="h-2.5 w-2.5" />
          <span>Next: {formatRelativeTime(nextScanAt)}</span>
        </div>
      )}
      <div className="text-text-tertiary">
        <span className="text-text-secondary tabular-nums">{articlesFoundLastScan}</span> found
      </div>
    </div>
  );
}
