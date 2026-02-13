import client from './client';

export interface Agency {
  id: string;
  name: string;
  abbreviation: string | null;
  foia_email: string | null;
  foia_phone: string | null;
  foia_address: string | null;
  website: string | null;
  state: string;
  jurisdiction: string | null;
  is_active: boolean;
  avg_response_days: number | null;
  notes: string | null;
  foia_template: string | null;
  typical_cost_per_hour: number | null;
  report_card_grade: string | null;
  report_card_updated_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface AgencyListParams {
  page?: number;
  page_size?: number;
  state?: string;
  search?: string;
  is_active?: boolean;
  jurisdiction_type?: string;
}

export interface AgencyStats {
  total_requests: number;
  requests_by_status: Record<string, number>;
  fulfillment_rate: number;
  avg_cost: number | null;
  total_cost: number | null;
  avg_response_days_actual: number | null;
}

export interface AgencyRecentFoia {
  id: string;
  case_number: string;
  status: string;
  priority: string;
  submitted_at: string | null;
  created_at: string;
  request_text_preview: string;
}

export interface AgencyContact {
  id: string;
  agency_id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  contact_type: string | null;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface AgencyContactCreate {
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  contact_type?: string;
  is_primary?: boolean;
  notes?: string;
}

// ── Agency CRUD ─────────────────────────────────────────────────────────

export async function getAgencies(params?: AgencyListParams) {
  const response = await client.get('/agencies', { params });
  return response.data;
}

export async function getAgency(id: string) {
  const response = await client.get(`/agencies/${id}`);
  return response.data;
}

export async function createAgency(data: Partial<Agency>) {
  const response = await client.post('/agencies', data);
  return response.data;
}

export async function updateAgency(id: string, data: Partial<Agency>) {
  const response = await client.put(`/agencies/${id}`, data);
  return response.data;
}

export async function deleteAgency(id: string) {
  await client.delete(`/agencies/${id}`);
}

// ── Agency Stats & Recent FOIAs ─────────────────────────────────────────

export async function getAgencyStats(id: string): Promise<AgencyStats> {
  const response = await client.get(`/agencies/${id}/stats`);
  return response.data;
}

export async function getAgencyRecentFoias(id: string, limit = 5): Promise<AgencyRecentFoia[]> {
  const response = await client.get(`/agencies/${id}/recent-foias`, { params: { limit } });
  return response.data;
}

// ── Agency Contacts ─────────────────────────────────────────────────────

export async function getAgencyContacts(id: string): Promise<{ items: AgencyContact[]; total: number }> {
  const response = await client.get(`/agencies/${id}/contacts`);
  return response.data;
}

export async function createAgencyContact(agencyId: string, data: AgencyContactCreate): Promise<AgencyContact> {
  const response = await client.post(`/agencies/${agencyId}/contacts`, data);
  return response.data;
}

export async function updateAgencyContact(agencyId: string, contactId: string, data: Partial<AgencyContactCreate>): Promise<AgencyContact> {
  const response = await client.put(`/agencies/${agencyId}/contacts/${contactId}`, data);
  return response.data;
}

export async function deleteAgencyContact(agencyId: string, contactId: string) {
  await client.delete(`/agencies/${agencyId}/contacts/${contactId}`);
}

// ── Agency Templates ────────────────────────────────────────────────────

export async function getAgencyTemplate(agencyId: string): Promise<{ template: string; is_custom: boolean }> {
  const response = await client.get(`/agencies/${agencyId}/template`);
  return response.data;
}

export async function updateAgencyTemplate(agencyId: string, template: string): Promise<{ template: string }> {
  const response = await client.put(`/agencies/${agencyId}/template`, { template });
  return response.data;
}

export async function deleteAgencyTemplate(agencyId: string): Promise<void> {
  await client.delete(`/agencies/${agencyId}/template`);
}

export async function getAgencyContact(agencyId: string, contactId: string): Promise<AgencyContact> {
  const response = await client.get(`/agencies/${agencyId}/contacts/${contactId}`);
  return response.data;
}

// ── Report Card Grades ──────────────────────────────────────────────────

export async function getAgencyGrade(agencyId: string): Promise<{
  grade: string;
  score: number | null;
  breakdown?: Record<string, number>;
  metrics?: Record<string, number | null>;
}> {
  const response = await client.get(`/agencies/${agencyId}/grade`);
  return response.data;
}

export async function recalculateGrades(): Promise<{ updated: number; skipped: number; errors: number }> {
  const response = await client.post('/agencies/recalculate-grades');
  return response.data;
}
