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

export interface DashboardSummary {
  timestamp: string;
  today: {
    articles: number;
    high_severity_articles: number;
    foias_submitted: number;
    videos_published: number;
  };
  week: { articles: number; foias: number; videos: number };
  month: { articles: number; foias: number; videos: number };
  foia_status: Record<string, number>;
  top_videos: { id: string; title: string; views: number; revenue: number }[];
  agency_performance: {
    id: string;
    name: string;
    abbreviation: string | null;
    total_requests: number;
    fulfilled_count: number;
    fulfillment_rate: number;
  }[];
  revenue: {
    month_revenue: number;
    month_costs: number;
    month_profit: number;
    month_roi_percent: number;
  };
  system_health: {
    circuit_breakers: { total_sources: number; circuits_open: number; all_healthy: boolean };
    overdue_foias: number;
    videos_ready_for_upload: number;
  };
  recent_activity: {
    articles: { id: string; headline: string; severity: string | null; source: string; created_at: string }[];
    foias: { id: string; case_number: string; agency_name: string | null; status: string; submitted_at: string | null }[];
  };
}

export interface SystemMetrics {
  timestamp: string;
  overall_health_score: number;
  database: {
    table_counts: { articles: number; foias: number; videos: number };
    recent_activity_hourly: { articles: number; foias: number };
  };
  redis: {
    total_connections_received?: number;
    total_commands_processed?: number;
    keyspace_hits?: number;
    keyspace_misses?: number;
    hit_rate?: number;
    error?: string;
  };
  background_tasks: {
    past_24h: { successful_scans: number; failed_scans: number; success_rate: number };
  };
  system_resources: {
    cpu_percent?: number;
    memory_used_mb?: number;
    memory_percent?: number;
    threads?: number;
    open_files?: number;
    error?: string;
  };
  circuit_breakers: {
    total_sources: number;
    circuits_open: number;
    health_score: number;
  };
}

export async function getDashboardStats(): Promise<DashboardResponse> {
  const { data } = await client.get('/dashboard/stats');
  return data;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const { data } = await client.get('/dashboard/summary');
  return data;
}

export async function getSystemMetrics(): Promise<SystemMetrics> {
  const { data } = await client.get('/dashboard/system-metrics');
  return data;
}

export interface AutoSubmitStats {
  mode: string;
  daily_quota: number;
  today: {
    filed: number;
    dry_run: number;
    skipped: number;
    skip_reasons: Record<string, number>;
    total_evaluated: number;
  };
  week: {
    filed: number;
    dry_run: number;
    skipped: number;
    total_evaluated: number;
  };
}

export async function getAutoSubmitStats(): Promise<AutoSubmitStats> {
  const { data } = await client.get('/dashboard/auto-submit-stats');
  return data;
}
