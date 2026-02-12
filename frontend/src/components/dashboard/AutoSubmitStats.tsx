import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, AlertTriangle, Ban, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getAutoSubmitStats, type AutoSubmitStats as AutoSubmitStatsType } from '@/api/dashboard';
import { cn } from '@/lib/cn';

export function AutoSubmitStats() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AutoSubmitStatsType | null>(null);

  useEffect(() => {
    getAutoSubmitStats().then(setStats).catch(() => {});
  }, []);

  if (!stats) return null;

  const modeBadge = {
    off: { variant: 'default' as const, label: 'Off' },
    dry_run: { variant: 'warning' as const, label: 'Dry Run' },
    live: { variant: 'danger' as const, label: 'Live' },
  }[stats.mode] ?? { variant: 'default' as const, label: stats.mode };

  const skipReasonLabels: Record<string, string> = {
    daily_quota: 'Daily Quota',
    agency_cooldown: 'Agency Cooldown',
    cost_cap: 'Cost Cap',
    other: 'Other',
  };

  return (
    <Card
      title="Auto-Submit"
      action={<Badge variant={modeBadge.variant} size="sm">{modeBadge.label}</Badge>}
    >
      {/* Today's stats */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className={cn(
            'text-xl font-bold tabular-nums',
            stats.today.filed > 0 ? 'text-emerald-400' : 'text-text-primary',
          )}>
            {stats.today.filed}
          </p>
          <div className="flex items-center justify-center gap-1 mt-0.5">
            <FileText className="h-3 w-3 text-text-quaternary" />
            <span className="text-xs text-text-tertiary">Filed</span>
          </div>
        </div>
        <div>
          <p className={cn(
            'text-xl font-bold tabular-nums',
            stats.today.dry_run > 0 ? 'text-amber-400' : 'text-text-primary',
          )}>
            {stats.today.dry_run}
          </p>
          <div className="flex items-center justify-center gap-1 mt-0.5">
            <AlertTriangle className="h-3 w-3 text-text-quaternary" />
            <span className="text-xs text-text-tertiary">Dry Run</span>
          </div>
        </div>
        <div>
          <p className={cn(
            'text-xl font-bold tabular-nums',
            stats.today.skipped > 0 ? 'text-red-400' : 'text-text-primary',
          )}>
            {stats.today.skipped}
          </p>
          <div className="flex items-center justify-center gap-1 mt-0.5">
            <Ban className="h-3 w-3 text-text-quaternary" />
            <span className="text-xs text-text-tertiary">Skipped</span>
          </div>
        </div>
      </div>

      {/* Skip reasons breakdown */}
      {stats.today.skipped > 0 && Object.keys(stats.today.skip_reasons).length > 0 && (
        <div className="mt-3 pt-3 border-t border-surface-border/30 space-y-1.5">
          <p className="text-2xs text-text-quaternary uppercase tracking-wider">Skip Reasons</p>
          {Object.entries(stats.today.skip_reasons).map(([reason, count]) => (
            <div key={reason} className="flex items-center justify-between">
              <span className="text-xs text-text-secondary">
                {skipReasonLabels[reason] || reason}
              </span>
              <span className="text-xs text-text-tertiary tabular-nums">{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Week summary */}
      <div className="mt-3 pt-3 border-t border-surface-border/30">
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-tertiary">This week</span>
          <span className="text-xs text-text-secondary tabular-nums">
            {stats.week.filed} filed &middot; {stats.week.dry_run} dry run &middot; {stats.week.skipped} skipped
          </span>
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/audit')}
        className="w-full mt-3"
        icon={<ArrowRight className="h-3.5 w-3.5" />}
      >
        View Decision Log
      </Button>
    </Card>
  );
}
