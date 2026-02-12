import client from './client';

export interface AppSetting {
  key: string;
  value: string;
  value_type: string;
  description: string | null;
}

export interface SystemSettings {
  scan_interval_minutes: number;
  scan_enabled: boolean;
  auto_submit_enabled: boolean;
  auto_submit_severity_threshold: number;
  max_auto_submits_per_day: number;
  email_notifications_enabled: boolean;
  sms_notifications_enabled: boolean;
}

/** Parse backend settings array into a flat key→value map */
function parseSettings(settingsArray: AppSetting[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const s of settingsArray) {
    if (s.value_type === 'boolean') {
      result[s.key] = s.value === 'true';
    } else if (s.value_type === 'integer') {
      result[s.key] = parseInt(s.value, 10);
    } else if (s.value_type === 'float') {
      result[s.key] = parseFloat(s.value);
    } else {
      result[s.key] = s.value;
    }
  }
  return result;
}

export async function getSettings(): Promise<Record<string, unknown>> {
  const { data } = await client.get('/settings');
  return parseSettings(data.settings || []);
}

export async function updateSettings(updates: Partial<SystemSettings>): Promise<Record<string, unknown>> {
  // Convert flat object to backend's expected array format
  const payload = Object.entries(updates).map(([key, value]) => ({
    key,
    value: String(value),
  }));
  await client.put('/settings', payload);
  // Re-fetch to get the canonical values
  return getSettings();
}
