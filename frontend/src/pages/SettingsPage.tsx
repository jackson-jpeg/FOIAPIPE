import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Save,
  RefreshCw,
  Wifi,
  Database,
  HardDrive,
  Mail,
  Youtube,
  Bot,
  Building2,
  ArrowRight,
  Shield,
  Bell,
  Scan,
  AlertTriangle,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { useSettingsStore } from '@/stores/settingsStore';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import client from '@/api/client';
import { getSystemMetrics, type SystemMetrics } from '@/api/dashboard';
import { getAuditSummary, type AuditSummary } from '@/api/audit';
import { getBackupInfo } from '@/api/exports';

interface SystemHealth {
  status: string;
  checks: Record<string, { status: string; error?: string; [key: string]: any }>;
}

export function SettingsPage() {
  const navigate = useNavigate();
  const { settings, loading, saving, fetchSettings, updateSettings } = useSettingsStore();
  const { addToast } = useToast();

  const [autoSubmitMode, setAutoSubmitMode] = useState<'off' | 'dry_run' | 'live'>('off');
  const [autoSubmitThreshold, setAutoSubmitThreshold] = useState(7);
  const [maxAutoSubmitsPerDay, setMaxAutoSubmitsPerDay] = useState(10);
  const [maxAutoSubmitsPerAgencyPerWeek, setMaxAutoSubmitsPerAgencyPerWeek] = useState(3);
  const [autoSubmitCostCap, setAutoSubmitCostCap] = useState(50);
  const [scanInterval, setScanInterval] = useState(30);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);

  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [refreshingHealth, setRefreshingHealth] = useState(false);

  const [sysMetrics, setSysMetrics] = useState<SystemMetrics | null>(null);
  const [auditSummary, setAuditSummary] = useState<AuditSummary | null>(null);
  const [backupInfo, setBackupInfo] = useState<any>(null);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (settings && Object.keys(settings).length > 0) {
      // Backwards compat: if auto_submit_mode exists use it, else map old boolean
      if (settings.auto_submit_mode) {
        setAutoSubmitMode(settings.auto_submit_mode as 'off' | 'dry_run' | 'live');
      } else if (settings.auto_submit_enabled) {
        setAutoSubmitMode('live');
      } else {
        setAutoSubmitMode('off');
      }
      setAutoSubmitThreshold(Number(settings.auto_submit_severity_threshold) || 7);
      setMaxAutoSubmitsPerDay(Number(settings.max_auto_submits_per_day) || 10);
      setMaxAutoSubmitsPerAgencyPerWeek(Number(settings.max_auto_submits_per_agency_per_week) || 3);
      setAutoSubmitCostCap(Number(settings.auto_submit_cost_cap) || 50);
      setScanInterval(Number(settings.scan_interval_minutes) || 30);
      setEmailNotifications(Boolean(settings.email_notifications_enabled ?? true));
      setSmsNotifications(Boolean(settings.sms_notifications_enabled));
    }
  }, [settings]);

  const loadHealth = async () => {
    try {
      const { data } = await client.get('/health/detailed');
      setHealth(data);
    } catch {
      // silently fail
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    loadHealth();
    getSystemMetrics().then(setSysMetrics).catch(() => {});
    getAuditSummary(30).then(setAuditSummary).catch(() => {});
    getBackupInfo().then(setBackupInfo).catch(() => {});
  }, []);

  const handleRefreshHealth = async () => {
    setRefreshingHealth(true);
    await loadHealth();
    setRefreshingHealth(false);
    addToast({ type: 'success', title: 'Health status refreshed' });
  };

  const handleSave = async () => {
    try {
      await updateSettings({
        auto_submit_mode: autoSubmitMode,
        auto_submit_severity_threshold: autoSubmitThreshold,
        max_auto_submits_per_day: maxAutoSubmitsPerDay,
        max_auto_submits_per_agency_per_week: maxAutoSubmitsPerAgencyPerWeek,
        auto_submit_cost_cap: autoSubmitCostCap,
        scan_interval_minutes: scanInterval,
        email_notifications_enabled: emailNotifications,
        sms_notifications_enabled: smsNotifications,
      });
      addToast({ type: 'success', title: 'Settings saved successfully' });
    } catch {
      addToast({ type: 'error', title: 'Failed to save settings' });
    }
  };

  const Toggle = ({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-[18px] w-8 shrink-0 cursor-pointer rounded-full transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary',
        'disabled:pointer-events-none disabled:opacity-40',
        checked ? 'bg-accent-primary' : 'bg-surface-border-light',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-text-primary shadow-sm transition-transform duration-150 mt-[2px]',
          checked ? 'translate-x-[14px]' : 'translate-x-0.5',
        )}
      />
    </button>
  );

  const statusBadge = (status: string) => {
    const variant = status === 'ok' || status === 'configured' ? 'success'
      : status === 'error' ? 'danger'
      : status === 'degraded' || status === 'incomplete' ? 'warning'
      : 'default';
    return <Badge variant={variant} size="sm">{status}</Badge>;
  };

  const serviceItems = [
    { key: 'database', label: 'PostgreSQL', icon: Database, description: 'Primary data store' },
    { key: 'redis', label: 'Redis', icon: Wifi, description: 'Cache & task queue' },
    { key: 'storage', label: 'File Storage (S3/R2)', icon: HardDrive, description: 'Video & document storage' },
    { key: 'email_smtp', label: 'SMTP Email', icon: Mail, description: 'FOIA request delivery' },
    { key: 'claude_api', label: 'Claude AI', icon: Bot, description: 'Article analysis & suggestions' },
  ];

  // Count healthy services
  const healthyCount = health
    ? serviceItems.filter(s => {
        const check = health.checks?.[s.key];
        return check?.status === 'ok' || check?.status === 'configured';
      }).length
    : 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="heading-3 mb-2">Settings</h1>
          <p className="text-sm text-text-secondary">
            Configure scanner behavior, notifications, and system integrations
          </p>
        </div>
        <Button
          variant="primary"
          onClick={handleSave}
          loading={saving}
          icon={<Save className="h-4 w-4" />}
        >
          Save Changes
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-surface-border bg-surface-secondary p-5 space-y-3">
              <Skeleton variant="text" className="h-3.5 w-32" />
              <Skeleton variant="text" className="h-3 w-full" />
              <Skeleton variant="text" className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column */}
          <div className="space-y-6">
            {/* System Status */}
            <Card
              title="System Status"
              action={
                <div className="flex items-center gap-2">
                  {health && (
                    <span className="text-xs text-text-tertiary tabular-nums">
                      {healthyCount}/{serviceItems.length + 1} healthy
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRefreshHealth}
                    loading={refreshingHealth}
                    icon={<RefreshCw className="h-3 w-3" />}
                  >
                    Refresh
                  </Button>
                </div>
              }
            >
              {healthLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <Skeleton variant="text" className="h-3.5 w-32" />
                      <Skeleton variant="text" className="h-3.5 w-16" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {serviceItems.map(({ key, label, icon: Icon, description }) => {
                    const check = health?.checks?.[key];
                    const status = check?.status || 'unknown';
                    const isHealthy = status === 'ok' || status === 'configured';
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between rounded-lg px-3 py-2.5 -mx-3 hover:bg-surface-hover transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'flex items-center justify-center h-8 w-8 rounded-lg',
                            isHealthy ? 'bg-emerald-500/10 text-emerald-400' :
                            status === 'error' ? 'bg-red-500/10 text-red-400' :
                            'bg-surface-tertiary text-text-tertiary'
                          )}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="text-sm text-text-primary">{label}</span>
                            <p className="text-2xs text-text-quaternary">{description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {check?.host && (
                            <span className="text-2xs text-text-quaternary font-mono hidden sm:inline">{check.host}</span>
                          )}
                          {statusBadge(status)}
                        </div>
                      </div>
                    );
                  })}

                  {/* YouTube API */}
                  <div className="flex items-center justify-between rounded-lg px-3 py-2.5 -mx-3 hover:bg-surface-hover transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-tertiary text-text-tertiary">
                        <Youtube className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="text-sm text-text-primary">YouTube API</span>
                        <p className="text-2xs text-text-quaternary">Video publishing</p>
                      </div>
                    </div>
                    <Badge variant="default" size="sm">not_configured</Badge>
                  </div>

                  {/* Circuit Breakers */}
                  {health?.checks?.circuit_breakers && (
                    <div className="flex items-center justify-between rounded-lg px-3 py-2.5 -mx-3 hover:bg-surface-hover transition-colors border-t border-surface-border/30 mt-2 pt-2">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-tertiary text-text-tertiary">
                          <Shield className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="text-sm text-text-primary">News Source Health</span>
                          <p className="text-2xs text-text-quaternary">Circuit breaker status</p>
                        </div>
                      </div>
                      <span className="text-xs text-text-secondary font-mono tabular-nums">
                        {health.checks.circuit_breakers.healthy_sources}/{health.checks.circuit_breakers.total_sources} healthy
                      </span>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Quick Links */}
            <Card title="Quick Links">
              <div className="space-y-1">
                <button
                  onClick={() => navigate('/agencies')}
                  className="w-full flex items-center justify-between rounded-lg px-3 py-2.5 -mx-3 hover:bg-surface-hover transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-blue-500/10 text-blue-400">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-sm text-text-primary">Agency Management</span>
                      <p className="text-2xs text-text-quaternary">Add, edit, or configure law enforcement agencies</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-text-quaternary" />
                </button>
                <button
                  onClick={() => navigate('/audit')}
                  className="w-full flex items-center justify-between rounded-lg px-3 py-2.5 -mx-3 hover:bg-surface-hover transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-purple-500/10 text-purple-400">
                      <Shield className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-sm text-text-primary">Audit Log</span>
                      <p className="text-2xs text-text-quaternary">View FOIA status change history</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-text-quaternary" />
                </button>
              </div>
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Scanner Configuration */}
            <Card title="Scanner Configuration" action={<Scan className="h-4 w-4 text-text-quaternary" />}>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-text-primary mb-2">Auto-submit Mode</p>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setAutoSubmitMode('off')}
                      className={cn(
                        'rounded-lg border px-3 py-2.5 text-center transition-all text-sm',
                        autoSubmitMode === 'off'
                          ? 'border-text-tertiary bg-surface-tertiary text-text-primary font-medium'
                          : 'border-surface-border text-text-tertiary hover:border-text-quaternary hover:bg-surface-hover',
                      )}
                    >
                      Off
                    </button>
                    <button
                      type="button"
                      onClick={() => setAutoSubmitMode('dry_run')}
                      className={cn(
                        'rounded-lg border px-3 py-2.5 text-center transition-all text-sm flex items-center justify-center gap-1.5',
                        autoSubmitMode === 'dry_run'
                          ? 'border-amber-500/60 bg-amber-500/10 text-amber-400 font-medium'
                          : 'border-surface-border text-text-tertiary hover:border-amber-500/30 hover:bg-surface-hover',
                      )}
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Dry Run
                    </button>
                    <button
                      type="button"
                      onClick={() => setAutoSubmitMode('live')}
                      className={cn(
                        'rounded-lg border px-3 py-2.5 text-center transition-all text-sm flex items-center justify-center gap-1.5',
                        autoSubmitMode === 'live'
                          ? 'border-red-500/60 bg-red-500/10 text-red-400 font-medium'
                          : 'border-surface-border text-text-tertiary hover:border-red-500/30 hover:bg-surface-hover',
                      )}
                    >
                      Live
                      {autoSubmitMode === 'live' && (
                        <Badge variant="danger" size="sm">Caution</Badge>
                      )}
                    </button>
                  </div>
                  <p className="mt-2 text-2xs text-text-tertiary">
                    {autoSubmitMode === 'off' && 'Auto-submit is disabled. FOIAs must be filed manually.'}
                    {autoSubmitMode === 'dry_run' && 'Dry run mode: FOIAs will be drafted for review but NOT emailed to agencies.'}
                    {autoSubmitMode === 'live' && 'Live mode: FOIAs will be automatically emailed to agencies. These are legally binding requests.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Input
                    label="Severity Threshold (1-10)"
                    type="number"
                    min={1}
                    max={10}
                    value={autoSubmitThreshold}
                    onChange={(e) => setAutoSubmitThreshold(Number(e.target.value))}
                    disabled={autoSubmitMode === 'off'}
                  />
                  <Input
                    label="Max / Day"
                    type="number"
                    min={1}
                    max={100}
                    value={maxAutoSubmitsPerDay}
                    onChange={(e) => setMaxAutoSubmitsPerDay(Number(e.target.value))}
                    disabled={autoSubmitMode === 'off'}
                  />
                  <Input
                    label="Max / Agency / Week"
                    type="number"
                    min={1}
                    max={50}
                    value={maxAutoSubmitsPerAgencyPerWeek}
                    onChange={(e) => setMaxAutoSubmitsPerAgencyPerWeek(Number(e.target.value))}
                    disabled={autoSubmitMode === 'off'}
                  />
                  <Input
                    label="Cost Cap ($)"
                    type="number"
                    min={0}
                    step={5}
                    value={autoSubmitCostCap}
                    onChange={(e) => setAutoSubmitCostCap(Number(e.target.value))}
                    disabled={autoSubmitMode === 'off'}
                  />
                </div>

                <Input
                  label="Scan Interval (min)"
                  type="number"
                  min={5}
                  max={1440}
                  value={scanInterval}
                  onChange={(e) => setScanInterval(Number(e.target.value))}
                />
              </div>
            </Card>

            {/* Notification Preferences */}
            <Card title="Notification Preferences" action={<Bell className="h-4 w-4 text-text-quaternary" />}>
              <div className="space-y-1">
                <label className="flex items-center justify-between rounded-lg p-2.5 -mx-2.5 transition-colors hover:bg-surface-hover cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-blue-500/10 text-blue-400">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-primary">Email Notifications</p>
                      <p className="mt-0.5 text-2xs text-text-tertiary">
                        Receive alerts and status updates via email
                      </p>
                    </div>
                  </div>
                  <Toggle checked={emailNotifications} onChange={() => setEmailNotifications(!emailNotifications)} />
                </label>

                <label className="flex items-center justify-between rounded-lg p-2.5 -mx-2.5 transition-colors hover:bg-surface-hover cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-400">
                      <Bell className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-primary">SMS Notifications</p>
                      <p className="mt-0.5 text-2xs text-text-tertiary">
                        Receive critical alerts via text message
                      </p>
                    </div>
                  </div>
                  <Toggle checked={smsNotifications} onChange={() => setSmsNotifications(!smsNotifications)} />
                </label>
              </div>
            </Card>

            {/* System Metrics */}
            {sysMetrics && (
              <Card title="System Performance">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">Health Score</span>
                    <span className={cn(
                      'text-sm font-bold tabular-nums',
                      sysMetrics.overall_health_score >= 90 ? 'text-emerald-400' :
                      sysMetrics.overall_health_score >= 70 ? 'text-amber-400' : 'text-red-400'
                    )}>
                      {sysMetrics.overall_health_score}/100
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">Scan Success (24h)</span>
                    <span className="text-sm text-text-primary tabular-nums">
                      {sysMetrics.background_tasks.past_24h.successful_scans}/{sysMetrics.background_tasks.past_24h.successful_scans + sysMetrics.background_tasks.past_24h.failed_scans}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">Redis Hit Rate</span>
                    <span className="text-sm text-text-primary tabular-nums">
                      {sysMetrics.redis.error ? 'Offline' : `${sysMetrics.redis.hit_rate ?? 0}%`}
                    </span>
                  </div>
                  {!sysMetrics.system_resources.error && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-text-secondary">Memory</span>
                        <span className="text-sm text-text-primary tabular-nums">{sysMetrics.system_resources.memory_used_mb} MB</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-text-secondary">CPU</span>
                        <span className="text-sm text-text-primary tabular-nums">{sysMetrics.system_resources.cpu_percent}%</span>
                      </div>
                    </>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">Circuit Breakers</span>
                    <span className="text-sm text-text-primary tabular-nums">
                      {sysMetrics.circuit_breakers.circuits_open} / {sysMetrics.circuit_breakers.total_sources} open
                    </span>
                  </div>
                </div>
              </Card>
            )}

            {/* Audit Summary */}
            {auditSummary && (
              <Card title="Audit Summary (30d)">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">Total Events</span>
                    <span className="text-sm font-medium text-text-primary tabular-nums">{auditSummary.total_events.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">Success Rate</span>
                    <Badge variant={auditSummary.success_rate >= 95 ? 'success' : auditSummary.success_rate >= 80 ? 'warning' : 'danger'} size="sm">
                      {auditSummary.success_rate}%
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">Failures</span>
                    <span className={cn('text-sm tabular-nums', auditSummary.failure_count > 0 ? 'text-red-400' : 'text-text-primary')}>
                      {auditSummary.failure_count}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/audit')}
                    className="w-full mt-2"
                    icon={<ArrowRight className="h-3.5 w-3.5" />}
                  >
                    View Full Audit Log
                  </Button>
                </div>
              </Card>
            )}

            {/* Data Backup */}
            {backupInfo && (
              <Card title="Data Backup">
                <div className="space-y-2">
                  {Object.entries(backupInfo.available_exports || {}).map(([key, exp]: [string, any]) => (
                    <div key={key} className="flex items-center justify-between rounded-lg px-3 py-2 -mx-3 hover:bg-surface-hover transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface-tertiary text-text-tertiary">
                          <HardDrive className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <span className="text-sm text-text-primary capitalize">{key}</span>
                          {exp.count !== undefined && (
                            <p className="text-2xs text-text-quaternary">{exp.count} records</p>
                          )}
                        </div>
                      </div>
                      <Badge variant="default" size="sm">{exp.format}</Badge>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
