import client from './client';

function downloadBlob(data: Blob, filename: string) {
  const url = window.URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function exportFoias(params?: {
  status?: string;
  date_from?: string;
  date_to?: string;
}) {
  const { data } = await client.get('/exports/foias', {
    params,
    responseType: 'blob',
  });
  downloadBlob(data, `foias_export_${new Date().toISOString().slice(0, 10)}.csv`);
}

export async function exportArticles(params?: {
  min_severity?: number;
  date_from?: string;
  date_to?: string;
}) {
  const { data } = await client.get('/exports/articles', {
    params,
    responseType: 'blob',
  });
  downloadBlob(data, `articles_export_${new Date().toISOString().slice(0, 10)}.csv`);
}

export async function exportVideos(params?: {
  status?: string;
  date_from?: string;
  date_to?: string;
}) {
  const { data } = await client.get('/exports/videos', {
    params,
    responseType: 'blob',
  });
  downloadBlob(data, `videos_export_${new Date().toISOString().slice(0, 10)}.csv`);
}

export async function exportAnalyticsSummary(days = 30) {
  const { data } = await client.get('/exports/analytics-summary', {
    params: { days },
    responseType: 'blob',
  });
  downloadBlob(data, `analytics_summary_${new Date().toISOString().slice(0, 10)}.csv`);
}

export async function getBackupInfo(): Promise<{
  message: string;
  available_exports: Record<string, { endpoint: string; count?: number; format: string }>;
}> {
  const { data } = await client.get('/exports/full-backup');
  return data;
}
