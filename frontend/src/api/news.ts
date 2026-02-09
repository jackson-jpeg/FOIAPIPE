import client from './client';

export async function getArticles(params: Record<string, any> = {}) {
  const { data } = await client.get('/news', { params });
  return data;
}

export async function getArticle(id: string) {
  const { data } = await client.get(`/news/${id}`);
  return data;
}

export async function updateArticle(id: string, update: Record<string, any>) {
  const { data } = await client.patch(`/news/${id}`, update);
  return data;
}

export async function fileFoiaFromArticle(id: string, agencyId?: string) {
  const { data } = await client.post(`/news/${id}/file-foia`, { agency_id: agencyId });
  return data;
}

export async function bulkAction(payload: { article_ids: string[]; action: string }) {
  const { data } = await client.post('/news/bulk-action', payload);
  return data;
}

export async function getScanStatus() {
  const { data } = await client.get('/news/scan-status');
  return data;
}

export async function triggerScan() {
  const { data } = await client.post('/news/scan-now');
  return data;
}
