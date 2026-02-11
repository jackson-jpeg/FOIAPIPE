import client from './client';

interface AnalyticsOverview {
  total_views: number;
  total_revenue: number;
  total_videos: number;
  avg_rpm: number;
  total_watch_time_hours: number;
}

interface RevenueData {
  date: string;
  revenue: number;
  views: number;
}

interface ViewsData {
  date: string;
  views: number;
  watch_time_hours: number;
}

interface TopVideo {
  id: string;
  title: string;
  views: number;
  revenue: number;
  watch_time_hours: number;
  rpm: number;
}

export async function getOverview(range: string = '30d'): Promise<AnalyticsOverview> {
  const { data } = await client.get('/analytics/overview', { params: { range } });
  return data;
}

export async function getRevenue(range: string = '30d'): Promise<RevenueData[]> {
  const { data } = await client.get('/analytics/revenue', { params: { range } });
  return data;
}

export async function getViews(range: string = '30d'): Promise<ViewsData[]> {
  const { data } = await client.get('/analytics/views', { params: { range } });
  return data;
}

export async function getTopVideos(range: string = '30d', sort: string = 'views'): Promise<TopVideo[]> {
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

export async function getOptimalPublishTimes() {
  const { data } = await client.get('/analytics/publishing/optimal-times');
  return data;
}

export async function getPublishingRecommendations() {
  const { data } = await client.get('/analytics/publishing/recommendations');
  return data;
}

export async function getFoiaPerformance() {
  const { data } = await client.get('/analytics/foia/performance');
  return data;
}

export async function getVideoProfitability() {
  const { data } = await client.get('/analytics/videos/profitability');
  return data;
}

export async function getBreakEvenAnalysis() {
  const { data } = await client.get('/analytics/revenue/break-even');
  return data;
}
