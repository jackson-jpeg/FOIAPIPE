import { useEffect, useState } from 'react';
import { Settings, Save, Building2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { useSettingsStore } from '@/stores/settingsStore';
import { useToast } from '@/components/ui/Toast';
import { getAgencies, type Agency } from '@/api/agencies';

export function SettingsPage() {
  const { settings, loading, saving, fetchSettings, updateSettings } = useSettingsStore();
  const { addToast } = useToast();

  const [autoSubmitEnabled, setAutoSubmitEnabled] = useState(false);
  const [autoSubmitThreshold, setAutoSubmitThreshold] = useState(7);
  const [maxAutoSubmitsPerDay, setMaxAutoSubmitsPerDay] = useState(10);
  const [scanInterval, setScanInterval] = useState(30);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);

  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [agenciesLoading, setAgenciesLoading] = useState(true);

  // Load settings on mount
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Sync local state when settings load
  useEffect(() => {
    if (settings && Object.keys(settings).length > 0) {
      setAutoSubmitEnabled(Boolean(settings.auto_submit_enabled));
      setAutoSubmitThreshold(Number(settings.auto_submit_severity_threshold) || 7);
      setMaxAutoSubmitsPerDay(Number(settings.max_auto_submits_per_day) || 10);
      setScanInterval(Number(settings.scan_interval_minutes) || 30);
      setEmailNotifications(Boolean(settings.email_notifications_enabled ?? true));
      setSmsNotifications(Boolean(settings.sms_notifications_enabled));
    }
  }, [settings]);

  // Load agencies on mount
  useEffect(() => {
    async function loadAgencies() {
      try {
        const data = await getAgencies({ page_size: 100 });
        setAgencies(data.items ?? data ?? []);
      } catch {
        // silently fail, table will show empty state
      } finally {
        setAgenciesLoading(false);
      }
    }
    loadAgencies();
  }, []);

  const handleSave = async () => {
    try {
      await updateSettings({
        auto_submit_enabled: autoSubmitEnabled,
        auto_submit_severity_threshold: autoSubmitThreshold,
        max_auto_submits_per_day: maxAutoSubmitsPerDay,
        scan_interval_minutes: scanInterval,
        email_notifications_enabled: emailNotifications,
        sms_notifications_enabled: smsNotifications,
      });
      addToast({ type: 'success', title: 'Settings saved successfully' });
    } catch {
      addToast({ type: 'error', title: 'Failed to save settings' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6 text-accent-cyan" />
          <h1 className="text-2xl font-semibold text-text-primary">Settings</h1>
        </div>
        <Button
          variant="primary"
          onClick={handleSave}
          loading={saving}
          icon={<Save className="h-4 w-4" />}
        >
          Save Settings
        </Button>
      </div>

      {loading ? (
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-surface-border bg-surface-secondary p-5 space-y-4">
              <Skeleton variant="text" className="h-5 w-40" />
              <Skeleton variant="text" className="h-4 w-full" />
              <Skeleton variant="text" className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Scanner Configuration */}
          <Card title="Scanner Configuration">
            <div className="space-y-5">
              {/* Auto-submit toggle */}
              <label className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-surface-tertiary">
                <div>
                  <p className="text-sm font-medium text-text-primary">Auto-submit FOIA requests</p>
                  <p className="mt-0.5 text-xs text-text-tertiary">
                    Automatically file FOIA requests for high-severity articles
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoSubmitEnabled}
                  onClick={() => setAutoSubmitEnabled(!autoSubmitEnabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary ${
                    autoSubmitEnabled ? 'bg-accent-cyan' : 'bg-surface-border'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${
                      autoSubmitEnabled ? 'translate-x-5' : 'translate-x-0.5'
                    } mt-0.5`}
                  />
                </button>
              </label>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Input
                  label="Severity Threshold (1-10)"
                  type="number"
                  min={1}
                  max={10}
                  value={autoSubmitThreshold}
                  onChange={(e) => setAutoSubmitThreshold(Number(e.target.value))}
                  disabled={!autoSubmitEnabled}
                />
                <Input
                  label="Max Auto-Submits Per Day"
                  type="number"
                  min={1}
                  max={100}
                  value={maxAutoSubmitsPerDay}
                  onChange={(e) => setMaxAutoSubmitsPerDay(Number(e.target.value))}
                  disabled={!autoSubmitEnabled}
                />
                <Input
                  label="Scan Interval (minutes)"
                  type="number"
                  min={5}
                  max={1440}
                  value={scanInterval}
                  onChange={(e) => setScanInterval(Number(e.target.value))}
                />
              </div>
            </div>
          </Card>

          {/* Notification Preferences */}
          <Card title="Notification Preferences">
            <div className="space-y-1">
              <label className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-surface-tertiary">
                <div>
                  <p className="text-sm font-medium text-text-primary">Email Notifications</p>
                  <p className="mt-0.5 text-xs text-text-tertiary">
                    Receive alerts and status updates via email
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={emailNotifications}
                  onClick={() => setEmailNotifications(!emailNotifications)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary ${
                    emailNotifications ? 'bg-accent-cyan' : 'bg-surface-border'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${
                      emailNotifications ? 'translate-x-5' : 'translate-x-0.5'
                    } mt-0.5`}
                  />
                </button>
              </label>

              <label className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-surface-tertiary">
                <div>
                  <p className="text-sm font-medium text-text-primary">SMS Notifications</p>
                  <p className="mt-0.5 text-xs text-text-tertiary">
                    Receive critical alerts via text message
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={smsNotifications}
                  onClick={() => setSmsNotifications(!smsNotifications)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary ${
                    smsNotifications ? 'bg-accent-cyan' : 'bg-surface-border'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${
                      smsNotifications ? 'translate-x-5' : 'translate-x-0.5'
                    } mt-0.5`}
                  />
                </button>
              </label>
            </div>
          </Card>

          {/* Agency Management */}
          <Card title="Agency Management" padding={false}>
            {agenciesLoading ? (
              <div className="p-5 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton variant="text" className="h-4 flex-1" />
                    <Skeleton variant="text" className="h-4 w-20" />
                    <Skeleton variant="text" className="h-4 w-32" />
                    <Skeleton variant="text" className="h-5 w-16" />
                  </div>
                ))}
              </div>
            ) : agencies.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Building2 className="mb-3 h-10 w-10 text-text-tertiary" />
                <p className="text-sm text-text-tertiary">No agencies configured</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-surface-border">
                      <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-tertiary">
                        Name
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-tertiary">
                        Jurisdiction
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-tertiary">
                        FOIA Email
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-tertiary">
                        Phone
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-tertiary">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {agencies.map((agency) => (
                      <tr
                        key={agency.id}
                        className="transition-colors hover:bg-surface-tertiary"
                      >
                        <td className="whitespace-nowrap px-5 py-3 text-sm font-medium text-text-primary">
                          {agency.name}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-sm text-text-secondary">
                          {agency.state || '--'}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-sm text-text-secondary">
                          {agency.foia_email || '--'}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-sm text-text-secondary">
                          {(agency as Agency & { phone?: string }).phone || '--'}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3">
                          <Badge
                            variant={
                              (agency as Agency & { active?: boolean }).active !== false
                                ? 'success'
                                : 'default'
                            }
                            size="sm"
                            dot
                          >
                            {(agency as Agency & { active?: boolean }).active !== false
                              ? 'Active'
                              : 'Inactive'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
