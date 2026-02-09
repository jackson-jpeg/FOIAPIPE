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
    <div className="flex items-center gap-5 rounded-xl border border-surface-border bg-surface-secondary px-4 py-2.5 shadow-card">
      <div className="flex items-center gap-2">
        <span className={cn(
          'h-2 w-2 rounded-full transition-colors',
          isScanning ? 'bg-accent-green animate-pulse-subtle' : 'bg-text-quaternary'
        )} />
        <span className="text-xs font-medium text-text-primary">
          {isScanning ? 'Scanning...' : 'Idle'}
        </span>
      </div>
      <div className="h-3 w-px bg-surface-border" />
      {lastScanAt && (
        <div className="flex items-center gap-1.5 text-2xs text-text-tertiary">
          <Activity className="h-3 w-3" />
          <span>Last: {formatRelativeTime(lastScanAt)}</span>
        </div>
      )}
      {!isScanning && nextScanAt && (
        <div className="flex items-center gap-1.5 text-2xs text-text-tertiary">
          <Clock className="h-3 w-3" />
          <span>Next: {formatRelativeTime(nextScanAt)}</span>
        </div>
      )}
      <div className="text-2xs text-text-tertiary">
        <span className="font-medium text-text-secondary tabular-nums">{articlesFoundLastScan}</span> found last scan
      </div>
    </div>
  );
}
