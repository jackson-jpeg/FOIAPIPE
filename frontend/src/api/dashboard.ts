import client from './client';

export interface DashboardStats {
  total_articles: number;
  active_foias: number;
  videos_in_pipeline: number;
  total_views: number;
  revenue_mtd: number;
  articles_trend: number;
  foias_trend: number;
  videos_trend: number;
  views_trend: number;
  revenue_trend: number;
}

export interface DashboardResponse {
  stats: DashboardStats;
  pipeline: { stage: string; count: number; color: string }[];
  recent_articles: { id: string; title: string; source: string; severity: string; created_at: string }[];
  top_videos: { id: string; title: string; views: number; status: string; published_at: string | null }[];
  activities: { id: string; type: string; message: string; timestamp: string }[];
}

export async function getDashboardStats(): Promise<DashboardResponse> {
  const { data } = await client.get('/dashboard/stats');
  return data;
}
