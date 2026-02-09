import client from './client';

export interface SystemSettings {
  scan_interval_minutes: number;
  scan_enabled: boolean;
  auto_submit_enabled: boolean;
  auto_submit_severity_threshold: number;
  max_auto_submits_per_day: number;
  email_notifications_enabled: boolean;
  sms_notifications_enabled: boolean;
  youtube_api_key: string;
  openai_api_key: string;
  notification_email: string;
}

export async function getSettings() {
  const response = await client.get('/settings');
  return response.data;
}

export async function updateSettings(data: Partial<SystemSettings>) {
  const response = await client.put('/settings', data);
  return response.data;
}

export async function testConnection(service: string) {
  const response = await client.post(`/settings/test/${service}`);
  return response.data;
}
