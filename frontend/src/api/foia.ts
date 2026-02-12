import client from './client';

export interface FoiaRequest {
  id: string;
  case_number: string;
  agency_id: string;
  agency_name?: string;
  news_article_id?: string;
  article_headline?: string;
  status: string;
  priority: string;
  request_text: string;
  submitted_at: string | null;
  due_date: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  agency_reference_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  fulfilled_at?: string | null;
}

export interface FoiaListParams {
  page?: number;
  page_size?: number;
  status?: string;
  agency_id?: string;
  search?: string;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
}

export async function getFoiaRequests(params: Record<string, any> = {}) {
  const { data } = await client.get('/foia', { params });
  return data;
}

export async function getFoiaRequest(id: string) {
  const { data } = await client.get(`/foia/${id}`);
  return data;
}

export async function createFoiaRequest(payload: Record<string, any>) {
  const { data } = await client.post('/foia', payload);
  return data;
}

export async function updateFoiaRequest(id: string, update: Record<string, any>) {
  const { data } = await client.patch(`/foia/${id}`, update);
  return data;
}

export async function submitFoiaRequest(id: string) {
  const { data } = await client.post(`/foia/${id}/submit`);
  return data;
}

export async function generatePdf(id: string) {
  const { data } = await client.post(`/foia/${id}/generate-pdf`, {}, { responseType: 'blob' });
  return data;
}

export async function getStatusSummary() {
  const { data } = await client.get('/foia/status-summary');
  return data;
}

export async function getDeadlines() {
  const { data } = await client.get('/foia/deadlines');
  return data;
}

export async function batchSubmit(payload: { agency_ids: string[]; request_text?: string; priority?: string; auto_submit?: boolean }) {
  const { data } = await client.post('/foia/batch-submit', payload);
  return data;
}

export async function getCostPrediction(params: { agency_id: string; incident_type?: string; estimated_duration_minutes?: number }) {
  const { data } = await client.get('/foia/cost-prediction', { params });
  return data;
}

export async function getRoiProjection(params: { predicted_cost: number; incident_type?: string; virality_score?: number }) {
  const { data } = await client.get('/foia/roi-projection', { params });
  return data;
}

export async function getFoiaSuggestions(id: string) {
  const { data } = await client.post(`/foia/${id}/suggestions`);
  return data;
}

export async function previewFoiaSuggestions(requestText: string, agencyName?: string, incidentType?: string) {
  const { data } = await client.post('/foia/suggestions/preview', {
    request_text: requestText,
    agency_name: agencyName,
    incident_type: incidentType,
  });
  return data;
}
