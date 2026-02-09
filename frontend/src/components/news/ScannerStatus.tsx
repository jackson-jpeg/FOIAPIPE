import { cn } from '@/lib/cn';
import { Activity, Pause } from 'lucide-react';
import { formatRelativeTime } from '@/lib/formatters';

interface ScannerStatusProps {
  isScanning: boolean;
  lastScanAt: string | null;
  nextScanAt: string | null;
  articlesFoundLastScan: number;
}

export function ScannerStatus({ isScanning, lastScanAt, nextScanAt, articlesFoundLastScan }: ScannerStatusProps) {
  return (
    <div className="flex items-center gap-6 rounded-lg border border-surface-border bg-surface-secondary px-4 py-3">
      <div className="flex items-center gap-2">
        <span className={cn(
          'h-2.5 w-2.5 rounded-full',
          isScanning ? 'bg-accent-cyan animate-pulse' : 'bg-text-tertiary'
        )} />
        <span className="text-sm font-medium text-text-primary">
          {isScanning ? 'Scanning...' : 'Idle'}
        </span>
      </div>
      {lastScanAt && (
        <div className="flex items-center gap-1.5 text-sm text-text-secondary">
          <Activity className="h-3.5 w-3.5" />
          <span>Last scan: {formatRelativeTime(lastScanAt)}</span>
        </div>
      )}
      {!isScanning && nextScanAt && (
        <div className="flex items-center gap-1.5 text-sm text-text-secondary">
          <Pause className="h-3.5 w-3.5" />
          <span>Next: {formatRelativeTime(nextScanAt)}</span>
        </div>
      )}
      <div className="text-sm text-text-secondary">
        <span className="font-mono text-text-primary">{articlesFoundLastScan}</span> articles last scan
      </div>
    </div>
  );
}
