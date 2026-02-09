import client from './client';

export async function getOverview(range: string = '30d') {
  const { data } = await client.get('/analytics/overview', { params: { range } });
  return data;
}

export async function getRevenue(range: string = '30d') {
  const { data } = await client.get('/analytics/revenue', { params: { range } });
  return data;
}

export async function getViews(range: string = '30d') {
  const { data } = await client.get('/analytics/views', { params: { range } });
  return data;
}

export async function getTopVideos(range: string = '30d', sort: string = 'views') {
  const { data } = await client.get('/analytics/top-videos', { params: { range, sort } });
  return data;
}

export async function getByAgency(range: string = '30d') {
  const { data } = await client.get('/analytics/by-agency', { params: { range } });
  return data;
}

export async function getByIncidentType(range: string = '30d') {
  const { data } = await client.get('/analytics/by-incident-type', { params: { range } });
  return data;
}

export async function getFunnel() {
  const { data } = await client.get('/analytics/funnel');
  return data;
}

export async function getVelocity() {
  const { data } = await client.get('/analytics/pipeline-velocity');
  return data;
}

export async function getRoi() {
  const { data } = await client.get('/analytics/roi');
  return data;
}

export async function getRevenueTransactions(params: Record<string, any> = {}) {
  const { data } = await client.get('/analytics/revenue/transactions', { params });
  return data;
}

export async function createTransaction(payload: Record<string, any>) {
  const { data } = await client.post('/analytics/revenue/transactions', payload);
  return data;
}

export async function getRevenueSummary(range: string = '30d') {
  const { data } = await client.get('/analytics/revenue/summary', { params: { range } });
  return data;
}
