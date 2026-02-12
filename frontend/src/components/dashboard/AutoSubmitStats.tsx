import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, AlertTriangle, ShieldX, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { getAutoSubmitStats, type AutoSubmitStats as AutoSubmitStatsType } from '@/api/dashboard';
import { cn } from '@/lib/cn';

const MODE_BADGE = {
  off: { variant: 'default' as const, label: 'Off' },
  dry_run: { variant: 'warning' as const, label: 'Dry Run' },
  live: { variant: 'danger' as const, label: 'Live' },
};

const SKIP_REASON_LABELS: Record<string, string> = {
  daily_quota: 'Daily Quota',
  agency_cooldown: 'Agency Cooldown',
  cost_cap: 'Cost Cap',
  other: 'Other',
};

export function AutoSubmitStats() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AutoSubmitStatsType | null>(null);

  useEffect(() => {
    getAutoSubmitStats().then(setStats).catch(() => {});
  }, []);

  if (!stats) return null;

  const badge = MODE_BADGE[stats.mode as keyof typeof MODE_BADGE]
    ?? { variant: 'default' as const, label: stats.mode };

  return (
    <Card
      title="Auto-Submit"
      action={<Badge variant={badge.variant} size="sm">{badge.label}</Badge>}
    >
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className={cn(
            'text-2xl font-bold tabular-nums',
            stats.today.filed > 0 ? 'text-accent-green' : 'text-text-primary',
          )}>
            {stats.today.filed}
          </p>
          <div className="flex items-center justify-center gap-1 mt-1">
            <FileText className="h-3 w-3 text-text-quaternary" />
            <span className="text-xs text-text-tertiary">Filed</span>
          </div>
        </div>
        <div>
          <p className={cn(
            'text-2xl font-bold tabular-nums',
            stats.today.dry_run > 0 ? 'text-accent-amber' : 'text-text-primary',
          )}>
            {stats.today.dry_run}
          </p>
          <div className="flex items-center justify-center gap-1 mt-1">
            <AlertTriangle className="h-3 w-3 text-text-quaternary" />
            <span className="text-xs text-text-tertiary">Dry Run</span>
          </div>
        </div>
        <div>
          <p className={cn(
            'text-2xl font-bold tabular-nums',
            stats.today.skipped > 0 ? 'text-accent-red' : 'text-text-primary',
          )}>
            {stats.today.skipped}
          </p>
          <div className="flex items-center justify-center gap-1 mt-1">
            <ShieldX className="h-3 w-3 text-text-quaternary" />
            <span className="text-xs text-text-tertiary">Skipped</span>
          </div>
        </div>
      </div>

      {/* Skip reasons — only when there's signal */}
      {stats.today.skipped > 0 && Object.keys(stats.today.skip_reasons).length > 0 && (
        <div className="mt-4 pt-4 border-t border-surface-border/30 space-y-2">
          <p className="text-2xs text-text-quaternary uppercase tracking-wider">Skip Reasons</p>
          {Object.entries(stats.today.skip_reasons).map(([reason, count]) => (
            <div key={reason} className="flex items-center justify-between">
              <span className="text-xs text-text-secondary">
                {SKIP_REASON_LABELS[reason] || reason}
              </span>
              <span className="text-xs text-text-tertiary tabular-nums">{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Week summary + audit link */}
      <div className="mt-4 pt-4 border-t border-surface-border/30 flex items-center justify-between">
        <span className="text-xs text-text-tertiary tabular-nums">
          Week: {stats.week.filed} filed, {stats.week.dry_run} dry run, {stats.week.skipped} skipped
        </span>
        <button
          onClick={() => navigate('/audit')}
          className="text-xs text-accent-primary hover:text-accent-primary-hover flex items-center gap-1 transition-colors duration-150"
        >
          Log <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </Card>
  );
}
