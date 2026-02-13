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
  Rss,
  Globe,
  Plus,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  Gavel,
  Play,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { useSettingsStore } from '@/stores/settingsStore';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import client from '@/api/client';
import { getSystemMetrics, type SystemMetrics } from '@/api/dashboard';
import { getAuditSummary, type AuditSummary } from '@/api/audit';
import { getBackupInfo } from '@/api/exports';
import {
  getNewsSources,
  createNewsSource,
  updateNewsSource,
  deleteNewsSource,
  type NewsSource,
} from '@/api/newsSources';
import { getTaskHealth, triggerTask, type TaskHealthResponse } from '@/api/tasks';

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

  // News Sources state
  const [newsSources, setNewsSources] = useState<NewsSource[]>([]);
  const [newsSourcesLoading, setNewsSourcesLoading] = useState(true);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [editingSource, setEditingSource] = useState<NewsSource | null>(null);
  const [sourceForm, setSourceForm] = useState({
    name: '',
    url: '',
    source_type: 'rss' as 'rss' | 'web_scrape',
    selectors: '',
    scan_interval_minutes: 30,
    is_active: true,
  });
  const [sourceSaving, setSourceSaving] = useState(false);

  // Task Health state
  const [taskHealth, setTaskHealth] = useState<TaskHealthResponse | null>(null);
  const [taskHealthLoading, setTaskHealthLoading] = useState(true);
  const [triggeringTask, setTriggeringTask] = useState<string | null>(null);

  // Auto-Appeal state
  const [autoAppealMode, setAutoAppealMode] = useState<'off' | 'dry_run' | 'live'>('off');
  const [maxAppealsPerDay, setMaxAppealsPerDay] = useState(3);
  const [appealAgencyCooldownDays, setAppealAgencyCooldownDays] = useState(30);

  // Confirmation dialogs
  const [confirmLiveSubmit, setConfirmLiveSubmit] = useState(false);
  const [confirmLiveAppeal, setConfirmLiveAppeal] = useState(false);

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
      setAutoAppealMode((settings.auto_appeal_mode as 'off' | 'dry_run' | 'live') || 'off');
      setMaxAppealsPerDay(Number(settings.max_appeals_per_day) || 3);
      setAppealAgencyCooldownDays(Number(settings.appeal_agency_cooldown_days) || 30);
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

  const loadNewsSources = async () => {
    try {
      setNewsSourcesLoading(true);
      const data = await getNewsSources();
      setNewsSources(data.items);
    } catch {
      // silently fail
    } finally {
      setNewsSourcesLoading(false);
    }
  };

  const loadTaskHealth = async () => {
    try {
      setTaskHealthLoading(true);
      const data = await getTaskHealth();
      setTaskHealth(data);
    } catch {
      // silently fail
    } finally {
      setTaskHealthLoading(false);
    }
  };

  const handleTriggerTask = async (scheduleName: string) => {
    setTriggeringTask(scheduleName);
    try {
      await triggerTask(scheduleName);
      addToast({ type: 'success', title: `Task "${scheduleName.replace(/-/g, ' ')}" triggered` });
    } catch {
      addToast({ type: 'error', title: 'Failed to trigger task' });
    } finally {
      setTriggeringTask(null);
    }
  };

  useEffect(() => {
    loadHealth();
    loadNewsSources();
    loadTaskHealth();
    getSystemMetrics().then(setSysMetrics).catch(() => addToast({ type: 'error', title: 'Failed to load system metrics' }));
    getAuditSummary(30).then(setAuditSummary).catch(() => addToast({ type: 'error', title: 'Failed to load audit summary' }));
    getBackupInfo().then(setBackupInfo).catch(() => addToast({ type: 'error', title: 'Failed to load backup info' }));
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
        auto_appeal_mode: autoAppealMode,
        max_appeals_per_day: maxAppealsPerDay,
        appeal_agency_cooldown_days: appealAgencyCooldownDays,
      } as any);
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

  const openAddSource = () => {
    setEditingSource(null);
    setSourceForm({ name: '', url: '', source_type: 'rss', selectors: '', scan_interval_minutes: 30, is_active: true });
    setShowSourceModal(true);
  };

  const openEditSource = (source: NewsSource) => {
    setEditingSource(source);
    const selectorsStr = source.selectors
      ? JSON.stringify(source.selectors, null, 2)
      : '';
    setSourceForm({
      name: source.name,
      url: source.url,
      source_type: source.source_type,
      selectors: selectorsStr,
      scan_interval_minutes: source.scan_interval_minutes,
      is_active: source.is_active,
    });
    setShowSourceModal(true);
  };

  const handleSaveSource = async () => {
    setSourceSaving(true);
    try {
      const payload: any = {
        name: sourceForm.name,
        url: sourceForm.url,
        source_type: sourceForm.source_type,
        scan_interval_minutes: sourceForm.scan_interval_minutes,
        is_active: sourceForm.is_active,
      };
      if (sourceForm.selectors.trim()) {
        try {
          payload.selectors = JSON.parse(sourceForm.selectors);
        } catch {
          addToast({ type: 'error', title: 'Invalid JSON in selectors field' });
          setSourceSaving(false);
          return;
        }
      }
      if (editingSource) {
        await updateNewsSource(editingSource.id, payload);
        addToast({ type: 'success', title: 'Feed source updated' });
      } else {
        await createNewsSource(payload);
        addToast({ type: 'success', title: 'Feed source added' });
      }
      setShowSourceModal(false);
      loadNewsSources();
    } catch {
      addToast({ type: 'error', title: 'Failed to save feed source' });
    } finally {
      setSourceSaving(false);
    }
  };

  const handleToggleSource = async (source: NewsSource) => {
    try {
      await updateNewsSource(source.id, { is_active: !source.is_active });
      setNewsSources(prev => prev.map(s => s.id === source.id ? { ...s, is_active: !s.is_active } : s));
      addToast({ type: 'success', title: `${source.name} ${source.is_active ? 'disabled' : 'enabled'}` });
    } catch {
      addToast({ type: 'error', title: 'Failed to toggle source' });
    }
  };

  const handleDeleteSource = async (source: NewsSource) => {
    try {
      await deleteNewsSource(source.id);
      setNewsSources(prev => prev.filter(s => s.id !== source.id));
      addToast({ type: 'success', title: `${source.name} deleted` });
    } catch {
      addToast({ type: 'error', title: 'Failed to delete source' });
    }
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
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="heading-3">Settings</h1>
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
            <div key={i} className="glass-2 rounded-lg p-5 space-y-3">
              <Skeleton variant="text" className="h-3.5 w-32" />
              <Skeleton variant="text" className="h-3 w-full" />
              <Skeleton variant="text" className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left column */}
          <div className="space-y-4">
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
                    <div className="flex items-center justify-between rounded-lg px-3 py-2.5 -mx-3 hover:bg-surface-hover transition-colors border-t border-glass-border mt-2 pt-2">
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

            {/* Feed Sources */}
            <Card
              title="Feed Sources"
              action={
                <Button variant="ghost" size="sm" onClick={openAddSource} icon={<Plus className="h-3 w-3" />}>
                  Add
                </Button>
              }
            >
              {newsSourcesLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <Skeleton variant="text" className="h-3.5 w-40" />
                      <Skeleton variant="text" className="h-3.5 w-16" />
                    </div>
                  ))}
                </div>
              ) : newsSources.length === 0 ? (
                <p className="text-sm text-text-tertiary py-4 text-center">No feed sources configured. Using hardcoded defaults.</p>
              ) : (
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {newsSources.map((source) => (
                    <div
                      key={source.id}
                      className="flex items-center justify-between rounded-lg px-3 py-2.5 -mx-3 hover:bg-surface-hover transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          'flex items-center justify-center h-8 w-8 rounded-lg flex-shrink-0',
                          source.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-surface-tertiary text-text-tertiary'
                        )}>
                          {source.source_type === 'rss' ? <Rss className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0">
                          <span className={cn('text-sm truncate block', source.is_active ? 'text-text-primary' : 'text-text-tertiary')}>
                            {source.name}
                          </span>
                          <p className="text-2xs text-text-quaternary truncate">{source.url.substring(0, 50)}...</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          onClick={() => handleToggleSource(source)}
                          className="p-1.5 rounded-md hover:bg-surface-tertiary text-text-tertiary hover:text-text-primary transition-colors"
                          title={source.is_active ? 'Disable' : 'Enable'}
                        >
                          {source.is_active ? <Power className="h-3 w-3" /> : <PowerOff className="h-3 w-3" />}
                        </button>
                        <button
                          onClick={() => openEditSource(source)}
                          className="p-1.5 rounded-md hover:bg-surface-tertiary text-text-tertiary hover:text-text-primary transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteSource(source)}
                          className="p-1.5 rounded-md hover:bg-red-500/10 text-text-tertiary hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Background Tasks */}
            <Card
              title="Background Tasks"
              action={
                <div className="flex items-center gap-2">
                  {taskHealth && (
                    <span className="text-xs text-text-tertiary tabular-nums">
                      {taskHealth.summary.green}/{taskHealth.summary.total} healthy
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadTaskHealth}
                    loading={taskHealthLoading}
                    icon={<RefreshCw className="h-3 w-3" />}
                  >
                    Refresh
                  </Button>
                </div>
              }
            >
              {taskHealthLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <Skeleton variant="text" className="h-3.5 w-40" />
                      <Skeleton variant="text" className="h-3.5 w-16" />
                    </div>
                  ))}
                </div>
              ) : taskHealth ? (
                <div className="space-y-1 max-h-96 overflow-y-auto">
                  {Object.entries(taskHealth.tasks).map(([name, task]) => {
                    const healthIcon = task.health === 'green' ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      : task.health === 'amber' ? <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                      : task.health === 'red' ? <XCircle className="h-3.5 w-3.5 text-red-400" />
                      : <HelpCircle className="h-3.5 w-3.5 text-text-quaternary" />;

                    const lastRunStr = task.last_run
                      ? new Date(task.last_run).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : 'Never';

                    return (
                      <div
                        key={name}
                        className="flex items-center justify-between rounded-lg px-3 py-2.5 -mx-3 hover:bg-surface-hover transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={cn(
                            'flex items-center justify-center h-8 w-8 rounded-lg flex-shrink-0',
                            task.health === 'green' ? 'bg-emerald-500/10' :
                            task.health === 'amber' ? 'bg-amber-500/10' :
                            task.health === 'red' ? 'bg-red-500/10' :
                            'bg-surface-tertiary'
                          )}>
                            {healthIcon}
                          </div>
                          <div className="min-w-0">
                            <span className="text-sm text-text-primary truncate block">{name.replace(/-/g, ' ')}</span>
                            <p className="text-2xs text-text-quaternary">{task.schedule}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {task.last_duration !== null && (
                            <span className="text-2xs text-text-quaternary tabular-nums">{task.last_duration}s</span>
                          )}
                          <span className="text-2xs text-text-tertiary tabular-nums">{lastRunStr}</span>
                          <button
                            onClick={() => handleTriggerTask(name)}
                            disabled={triggeringTask === name}
                            className="p-1 rounded hover:bg-accent-primary/10 text-text-quaternary hover:text-accent-primary transition-colors disabled:opacity-50"
                            title="Run now"
                          >
                            {triggeringTask === name ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <Play className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-text-tertiary py-4 text-center">No task data available</p>
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
          <div className="space-y-4">
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
                        'rounded-lg border px-3 py-2.5 text-center text-sm transition-colors duration-150',
                        autoSubmitMode === 'off'
                          ? 'border-surface-border-light bg-surface-tertiary text-text-primary font-medium'
                          : 'border-surface-border text-text-tertiary hover:bg-surface-hover',
                      )}
                    >
                      Off
                    </button>
                    <button
                      type="button"
                      onClick={() => setAutoSubmitMode('dry_run')}
                      className={cn(
                        'rounded-lg border px-3 py-2.5 text-center text-sm flex items-center justify-center gap-1.5 transition-colors duration-150',
                        autoSubmitMode === 'dry_run'
                          ? 'border-accent-amber/50 bg-accent-amber-subtle text-accent-amber font-medium'
                          : 'border-surface-border text-text-tertiary hover:bg-surface-hover',
                      )}
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Dry Run
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (autoSubmitMode !== 'live') {
                          setConfirmLiveSubmit(true);
                        }
                      }}
                      className={cn(
                        'rounded-lg border px-3 py-2.5 text-center text-sm flex items-center justify-center gap-1.5 transition-colors duration-150',
                        autoSubmitMode === 'live'
                          ? 'border-accent-red/50 bg-accent-red-subtle text-accent-red font-medium'
                          : 'border-surface-border text-text-tertiary hover:bg-surface-hover',
                      )}
                    >
                      Live
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-text-tertiary">
                    {autoSubmitMode === 'off' && 'Auto-submit is disabled. FOIAs must be filed manually.'}
                    {autoSubmitMode === 'dry_run' && 'Dry run: FOIAs will be drafted for review but NOT emailed to agencies.'}
                    {autoSubmitMode === 'live' && 'Live: FOIAs will be automatically emailed to agencies. These are legally binding.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Min. Severity (1-10)"
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

                <div className="border-t border-glass-border pt-4">
                  <Input
                    label="Scan Interval (min)"
                    type="number"
                    min={5}
                    max={1440}
                    value={scanInterval}
                    onChange={(e) => setScanInterval(Number(e.target.value))}
                  />
                </div>
              </div>
            </Card>

            {/* Auto-Appeal Configuration */}
            <Card title="Auto-Appeal" action={<Gavel className="h-4 w-4 text-text-quaternary" />}>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-text-primary mb-2">Auto-appeal Mode</p>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setAutoAppealMode('off')}
                      className={cn(
                        'rounded-lg border px-3 py-2.5 text-center text-sm transition-colors duration-150',
                        autoAppealMode === 'off'
                          ? 'border-surface-border-light bg-surface-tertiary text-text-primary font-medium'
                          : 'border-surface-border text-text-tertiary hover:bg-surface-hover',
                      )}
                    >
                      Off
                    </button>
                    <button
                      type="button"
                      onClick={() => setAutoAppealMode('dry_run')}
                      className={cn(
                        'rounded-lg border px-3 py-2.5 text-center text-sm flex items-center justify-center gap-1.5 transition-colors duration-150',
                        autoAppealMode === 'dry_run'
                          ? 'border-accent-amber/50 bg-accent-amber-subtle text-accent-amber font-medium'
                          : 'border-surface-border text-text-tertiary hover:bg-surface-hover',
                      )}
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Dry Run
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (autoAppealMode !== 'live') {
                          setConfirmLiveAppeal(true);
                        }
                      }}
                      className={cn(
                        'rounded-lg border px-3 py-2.5 text-center text-sm flex items-center justify-center gap-1.5 transition-colors duration-150',
                        autoAppealMode === 'live'
                          ? 'border-accent-red/50 bg-accent-red-subtle text-accent-red font-medium'
                          : 'border-surface-border text-text-tertiary hover:bg-surface-hover',
                      )}
                    >
                      Live
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-text-tertiary">
                    {autoAppealMode === 'off' && 'Auto-appeal is disabled. Appeals must be filed manually.'}
                    {autoAppealMode === 'dry_run' && 'Dry run: Appeals will be drafted for review but NOT sent.'}
                    {autoAppealMode === 'live' && 'Live: High-confidence appeals will be automatically emailed. These are legally binding.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Max Appeals / Day"
                    type="number"
                    min={1}
                    max={20}
                    value={maxAppealsPerDay}
                    onChange={(e) => setMaxAppealsPerDay(Number(e.target.value))}
                    disabled={autoAppealMode === 'off'}
                  />
                  <Input
                    label="Agency Cooldown (days)"
                    type="number"
                    min={1}
                    max={365}
                    value={appealAgencyCooldownDays}
                    onChange={(e) => setAppealAgencyCooldownDays(Number(e.target.value))}
                    disabled={autoAppealMode === 'off'}
                  />
                </div>
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

      {/* News Source Add/Edit Modal */}
      <Modal
        isOpen={showSourceModal}
        onClose={() => setShowSourceModal(false)}
        title={editingSource ? 'Edit Feed Source' : 'Add Feed Source'}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowSourceModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSaveSource} loading={sourceSaving}>
              {editingSource ? 'Update' : 'Add'} Source
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Source Name"
            placeholder="e.g. WFLA Crime"
            value={sourceForm.name}
            onChange={(e) => setSourceForm(prev => ({ ...prev, name: e.target.value }))}
          />
          <Input
            label="URL"
            placeholder="https://www.example.com/feed.rss"
            value={sourceForm.url}
            onChange={(e) => setSourceForm(prev => ({ ...prev, url: e.target.value }))}
          />
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSourceForm(prev => ({ ...prev, source_type: 'rss' }))}
                className={cn(
                  'rounded-lg border px-3 py-2 text-center text-sm flex items-center justify-center gap-2 transition-colors',
                  sourceForm.source_type === 'rss'
                    ? 'border-accent-primary/50 bg-accent-primary-subtle text-accent-primary font-medium'
                    : 'border-surface-border text-text-tertiary hover:bg-surface-hover',
                )}
              >
                <Rss className="h-3.5 w-3.5" /> RSS Feed
              </button>
              <button
                type="button"
                onClick={() => setSourceForm(prev => ({ ...prev, source_type: 'web_scrape' }))}
                className={cn(
                  'rounded-lg border px-3 py-2 text-center text-sm flex items-center justify-center gap-2 transition-colors',
                  sourceForm.source_type === 'web_scrape'
                    ? 'border-accent-primary/50 bg-accent-primary-subtle text-accent-primary font-medium'
                    : 'border-surface-border text-text-tertiary hover:bg-surface-hover',
                )}
              >
                <Globe className="h-3.5 w-3.5" /> Web Scrape
              </button>
            </div>
          </div>
          {sourceForm.source_type === 'web_scrape' && (
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">CSS Selectors (JSON)</label>
              <textarea
                className="w-full rounded-lg border border-surface-border bg-surface-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-quaternary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/30 font-mono"
                rows={3}
                placeholder='{"selectors": ["h2 a", "h3 a"]}'
                value={sourceForm.selectors}
                onChange={(e) => setSourceForm(prev => ({ ...prev, selectors: e.target.value }))}
              />
            </div>
          )}
          <Input
            label="Scan Interval (min)"
            type="number"
            min={5}
            max={1440}
            value={sourceForm.scan_interval_minutes}
            onChange={(e) => setSourceForm(prev => ({ ...prev, scan_interval_minutes: Number(e.target.value) }))}
          />
        </div>
      </Modal>

      {/* Confirmation: Auto-submit Live Mode */}
      <ConfirmDialog
        isOpen={confirmLiveSubmit}
        onClose={() => setConfirmLiveSubmit(false)}
        onConfirm={() => {
          setAutoSubmitMode('live');
          setConfirmLiveSubmit(false);
        }}
        title="Enable Live Auto-Submit?"
        message="This will automatically email FOIA requests to agencies. These are legally binding public records requests. Make sure your safety controls (daily limits, cost cap, cooldowns) are properly configured."
        confirmLabel="Enable Live Mode"
        variant="danger"
      />

      {/* Confirmation: Auto-appeal Live Mode */}
      <ConfirmDialog
        isOpen={confirmLiveAppeal}
        onClose={() => setConfirmLiveAppeal(false)}
        onConfirm={() => {
          setAutoAppealMode('live');
          setConfirmLiveAppeal(false);
        }}
        title="Enable Live Auto-Appeal?"
        message="This will automatically email appeal letters to agencies for denied FOIA requests. Appeals are legally binding communications. Verify your daily limits and cooldown settings."
        confirmLabel="Enable Live Mode"
        variant="danger"
      />
    </div>
  );
}
