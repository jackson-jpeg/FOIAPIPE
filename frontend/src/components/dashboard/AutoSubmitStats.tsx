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
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className={cn(
            'text-lg font-mono tabular-nums',
            stats.today.filed > 0 ? 'text-accent-green' : 'text-text-primary',
          )}>
            {stats.today.filed}
          </p>
          <div className="flex items-center justify-center gap-1 mt-0.5">
            <FileText className="h-2.5 w-2.5 text-text-quaternary" />
            <span className="text-3xs uppercase tracking-wider text-text-quaternary">Filed</span>
          </div>
        </div>
        <div>
          <p className={cn(
            'text-lg font-mono tabular-nums',
            stats.today.dry_run > 0 ? 'text-accent-amber' : 'text-text-primary',
          )}>
            {stats.today.dry_run}
          </p>
          <div className="flex items-center justify-center gap-1 mt-0.5">
            <AlertTriangle className="h-2.5 w-2.5 text-text-quaternary" />
            <span className="text-3xs uppercase tracking-wider text-text-quaternary">Dry Run</span>
          </div>
        </div>
        <div>
          <p className={cn(
            'text-lg font-mono tabular-nums',
            stats.today.skipped > 0 ? 'text-accent-red' : 'text-text-primary',
          )}>
            {stats.today.skipped}
          </p>
          <div className="flex items-center justify-center gap-1 mt-0.5">
            <ShieldX className="h-2.5 w-2.5 text-text-quaternary" />
            <span className="text-3xs uppercase tracking-wider text-text-quaternary">Skipped</span>
          </div>
        </div>
      </div>

      {stats.today.skipped > 0 && Object.keys(stats.today.skip_reasons).length > 0 && (
        <div className="mt-3 pt-3 border-t border-glass-border space-y-1.5">
          <p className="text-3xs text-text-quaternary uppercase tracking-wider">Skip Reasons</p>
          {Object.entries(stats.today.skip_reasons).map(([reason, count]) => (
            <div key={reason} className="flex items-center justify-between">
              <span className="text-2xs text-text-secondary">
                {SKIP_REASON_LABELS[reason] || reason}
              </span>
              <span className="text-2xs font-mono text-text-tertiary tabular-nums">{count}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-glass-border flex items-center justify-between">
        <span className="text-2xs font-mono text-text-quaternary tabular-nums">
          Week: {stats.week.filed} filed, {stats.week.dry_run} dry, {stats.week.skipped} skip
        </span>
        <button
          onClick={() => navigate('/audit')}
          className="text-2xs text-accent-primary hover:text-accent-primary-hover flex items-center gap-1 transition-colors duration-150"
        >
          Log <ArrowRight className="h-2.5 w-2.5" />
        </button>
      </div>
    </Card>
  );
}
