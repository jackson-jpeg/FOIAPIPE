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

export interface AuditLogResponse {
  items: AuditLogEntry[];
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

export async function getStatusChanges(params: AuditLogParams = {}): Promise<AuditLogResponse> {
  const { data } = await client.get('/audit-logs/status-changes', { params });
  return data;
}
