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

export interface ScanLog {
  id: string;
  scan_type: string;
  status: string;
  source: string | null;
  articles_found: number;
  articles_new: number;
  articles_duplicate: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
}

export interface ScanLogList {
  items: ScanLog[];
  total: number;
  page: number;
  page_size: number;
}

export async function getScanLogs(params: Record<string, any> = {}): Promise<ScanLogList> {
  const { data } = await client.get('/news/scan-logs', { params });
  return data;
}

export interface CircuitBreaker {
  id: string;
  source_name: string;
  source_url: string;
  is_enabled: boolean;
  is_circuit_open: boolean;
  consecutive_failures: number;
  total_failures: number;
  total_successes: number;
  last_success_at: string | null;
  last_failure_at: string | null;
  circuit_opened_at: string | null;
  last_error_message: string | null;
}

export async function getCircuitBreakers(): Promise<{ items: CircuitBreaker[]; total: number }> {
  const { data } = await client.get('/circuit-breakers/');
  return data;
}

export async function resetCircuitBreaker(sourceName: string): Promise<void> {
  await client.post(`/circuit-breakers/${encodeURIComponent(sourceName)}/reset`);
}
