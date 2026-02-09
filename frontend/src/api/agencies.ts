import client from './client';

export interface Agency {
  id: string;
  name: string;
  state: string;
  foia_email: string;
  foia_portal_url: string;
  avg_response_days: number;
  created_at: string;
  updated_at: string;
}

export interface AgencyListParams {
  page?: number;
  page_size?: number;
  state?: string;
  search?: string;
}

export async function getAgencies(_params?: AgencyListParams) {
  const response = await client.get('/agencies', { params: _params });
  return response.data;
}

export async function getAgency(id: string) {
  const response = await client.get(`/agencies/${id}`);
  return response.data;
}

export async function createAgency(_data: Partial<Agency>) {
  const response = await client.post('/agencies', _data);
  return response.data;
}

export async function updateAgency(id: string, _data: Partial<Agency>) {
  const response = await client.put(`/agencies/${id}`, _data);
  return response.data;
}
