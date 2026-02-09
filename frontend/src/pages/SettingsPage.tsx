import { useEffect, useState } from 'react';
import { Save, Building2 } from 'lucide-react';
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

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

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

  useEffect(() => {
    async function loadAgencies() {
      try {
        const data = await getAgencies({ page_size: 100 });
        setAgencies(data.items ?? data ?? []);
      } catch {
        // silently fail
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

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-[18px] w-8 shrink-0 cursor-pointer rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary ${
        checked ? 'bg-accent-primary' : 'bg-surface-border-light'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-150 ${
          checked ? 'translate-x-[14px]' : 'translate-x-0.5'
        } mt-[2px]`}
      />
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary tracking-tight">Settings</h1>
        <Button
          variant="primary"
          onClick={handleSave}
          loading={saving}
          icon={<Save className="h-3.5 w-3.5" />}
        >
          Save
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
        <div className="space-y-4">
          {/* Scanner Configuration */}
          <Card title="Scanner Configuration">
            <div className="space-y-4">
              <label className="flex items-center justify-between rounded-lg p-2.5 -mx-2.5 transition-colors hover:bg-surface-hover cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-text-primary">Auto-submit FOIA requests</p>
                  <p className="mt-0.5 text-2xs text-text-tertiary">
                    Automatically file FOIA requests for high-severity articles
                  </p>
                </div>
                <Toggle checked={autoSubmitEnabled} onChange={() => setAutoSubmitEnabled(!autoSubmitEnabled)} />
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
              <label className="flex items-center justify-between rounded-lg p-2.5 -mx-2.5 transition-colors hover:bg-surface-hover cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-text-primary">Email Notifications</p>
                  <p className="mt-0.5 text-2xs text-text-tertiary">
                    Receive alerts and status updates via email
                  </p>
                </div>
                <Toggle checked={emailNotifications} onChange={() => setEmailNotifications(!emailNotifications)} />
              </label>

              <label className="flex items-center justify-between rounded-lg p-2.5 -mx-2.5 transition-colors hover:bg-surface-hover cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-text-primary">SMS Notifications</p>
                  <p className="mt-0.5 text-2xs text-text-tertiary">
                    Receive critical alerts via text message
                  </p>
                </div>
                <Toggle checked={smsNotifications} onChange={() => setSmsNotifications(!smsNotifications)} />
              </label>
            </div>
          </Card>

          {/* Agency Management */}
          <Card title="Agency Management" padding={false}>
            {agenciesLoading ? (
              <div className="p-5 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton variant="text" className="h-3 flex-1" />
                    <Skeleton variant="text" className="h-3 w-20" />
                    <Skeleton variant="text" className="h-3 w-32" />
                    <Skeleton variant="text" className="h-4 w-14" />
                  </div>
                ))}
              </div>
            ) : agencies.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Building2 className="mb-2 h-6 w-6 text-text-quaternary" />
                <p className="text-xs text-text-tertiary">No agencies configured</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-surface-border bg-surface-tertiary/50">
                      <th className="px-5 py-2.5 text-left text-2xs font-medium text-text-tertiary">
                        Name
                      </th>
                      <th className="px-5 py-2.5 text-left text-2xs font-medium text-text-tertiary">
                        Jurisdiction
                      </th>
                      <th className="px-5 py-2.5 text-left text-2xs font-medium text-text-tertiary">
                        FOIA Email
                      </th>
                      <th className="px-5 py-2.5 text-left text-2xs font-medium text-text-tertiary">
                        Phone
                      </th>
                      <th className="px-5 py-2.5 text-left text-2xs font-medium text-text-tertiary">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border/30">
                    {agencies.map((agency) => (
                      <tr
                        key={agency.id}
                        className="transition-colors hover:bg-surface-hover"
                      >
                        <td className="whitespace-nowrap px-5 py-2.5 text-sm font-medium text-text-primary">
                          {agency.name}
                        </td>
                        <td className="whitespace-nowrap px-5 py-2.5 text-sm text-text-secondary">
                          {agency.state || '--'}
                        </td>
                        <td className="whitespace-nowrap px-5 py-2.5 text-sm text-text-secondary">
                          {agency.foia_email || '--'}
                        </td>
                        <td className="whitespace-nowrap px-5 py-2.5 text-sm text-text-secondary">
                          {(agency as Agency & { phone?: string }).phone || '--'}
                        </td>
                        <td className="whitespace-nowrap px-5 py-2.5">
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
