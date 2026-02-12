import client from './client';

export interface AuditLogEntry {
  id: string;
  foia_request_id: string;
  case_number: string;
  from_status: string;
  to_status: string;
  changed_by: string;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface GeneralAuditLogEntry {
  id: string;
  action: string;
  user: string;
  resource_type: string | null;
  resource_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

export interface AuditLogResponse {
  items: AuditLogEntry[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface GeneralAuditLogResponse {
  items: GeneralAuditLogEntry[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AuditLogParams {
  page?: number;
  page_size?: number;
  case_number?: string;
  changed_by?: string;
  date_from?: string;
  date_to?: string;
}

export interface GeneralAuditLogParams {
  page?: number;
  page_size?: number;
  action?: string;
  user?: string;
  resource_type?: string;
  resource_id?: string;
  date_from?: string;
  date_to?: string;
  success_only?: boolean;
}

export interface AuditSummary {
  period_days: number;
  total_events: number;
  success_count: number;
  failure_count: number;
  success_rate: number;
  top_actions: Record<string, number>;
  top_users: Record<string, number>;
  recent_failures: {
    action: string;
    user: string;
    error_message: string | null;
    created_at: string;
  }[];
}

export interface SecurityEventsResponse {
  period_days: number;
  login_events: {
    action: string;
    user: string;
    ip_address: string | null;
    success: boolean;
    created_at: string;
  }[];
  suspicious_ips: Record<string, number>;
  sensitive_operations: {
    action: string;
    user: string;
    resource_type: string | null;
    resource_id: string | null;
    ip_address: string | null;
    created_at: string;
  }[];
  total_failed_logins: number;
}

export async function getStatusChanges(params: AuditLogParams = {}): Promise<AuditLogResponse> {
  const { data } = await client.get('/audit-logs/status-changes', { params });
  return data;
}

export async function listAuditLogs(params: GeneralAuditLogParams = {}): Promise<GeneralAuditLogResponse> {
  const { data } = await client.get('/audit-logs', { params });
  return data;
}

export async function getAuditSummary(days = 30): Promise<AuditSummary> {
  const { data } = await client.get('/audit-logs/summary', { params: { days } });
  return data;
}

export async function getSecurityEvents(days = 7): Promise<SecurityEventsResponse> {
  const { data } = await client.get('/audit-logs/security-events', { params: { days } });
  return data;
}
