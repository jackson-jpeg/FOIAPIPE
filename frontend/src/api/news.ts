import client from './client';
import type {
  NewsArticleList,
  NewsArticle,
  NewsArticleUpdate,
  NewsScanStatus,
  BulkActionRequest,
  FileFoiaResponse,
} from '@/types';

export async function getArticles(params: Record<string, any> = {}): Promise<NewsArticleList> {
  const { data } = await client.get('/news', { params });
  return data;
}

export async function getArticle(id: string): Promise<NewsArticle> {
  const { data } = await client.get(`/news/${id}`);
  return data;
}

export async function updateArticle(id: string, update: NewsArticleUpdate): Promise<NewsArticle> {
  const { data } = await client.patch(`/news/${id}`, update);
  return data;
}

export async function fileFoiaFromArticle(id: string, agencyId?: string): Promise<FileFoiaResponse> {
  const { data } = await client.post(`/news/${id}/file-foia`, { agency_id: agencyId });
  return data;
}

export async function bulkAction(payload: BulkActionRequest): Promise<{ affected: number; action: string }> {
  const { data } = await client.post('/news/bulk-action', payload);
  return data;
}

export async function getScanStatus(): Promise<NewsScanStatus> {
  const { data } = await client.get('/news/scan-status');
  return data;
}

export async function triggerScan(): Promise<{ message: string }> {
  const { data } = await client.post('/news/scan-now');
  return data;
}
