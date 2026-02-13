import client from './client';

export interface NewsSource {
  id: string;
  name: string;
  url: string;
  source_type: 'rss' | 'web_scrape';
  selectors: Record<string, unknown> | null;
  scan_interval_minutes: number;
  is_active: boolean;
  last_scanned_at: string | null;
  error_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface NewsSourceList {
  items: NewsSource[];
  total: number;
}

export interface NewsSourceListParams {
  search?: string;
  source_type?: string;
  is_active?: boolean;
}

export async function getNewsSources(params?: NewsSourceListParams): Promise<NewsSourceList> {
  const { data } = await client.get('/news-sources', { params });
  return data;
}

export async function getNewsSource(id: string): Promise<NewsSource> {
  const { data } = await client.get(`/news-sources/${id}`);
  return data;
}

export async function createNewsSource(body: Partial<NewsSource>): Promise<NewsSource> {
  const { data } = await client.post('/news-sources', body);
  return data;
}

export async function updateNewsSource(id: string, body: Partial<NewsSource>): Promise<NewsSource> {
  const { data } = await client.put(`/news-sources/${id}`, body);
  return data;
}

export async function deleteNewsSource(id: string): Promise<void> {
  await client.delete(`/news-sources/${id}`);
}
