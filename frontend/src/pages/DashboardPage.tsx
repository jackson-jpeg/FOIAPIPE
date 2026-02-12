import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Newspaper,
  FileText,
  Video,
  Eye,
  DollarSign,
  ArrowRight,
  ExternalLink,
  Clock,
  AlertTriangle,
  Activity,
  Cpu,
  Database,
  Wifi,
  Shield,
  TrendingUp,
  Download,
} from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusOrb } from '@/components/ui/StatusOrb';
import { PipelineFunnel } from '@/components/dashboard/PipelineFunnel';
import { AutoSubmitStats } from '@/components/dashboard/AutoSubmitStats';
import { useToast } from '@/components/ui/Toast';
import {
  getDashboardStats,
  getDashboardSummary,
  getSystemMetrics,
  type DashboardStats,
  type DashboardSummary,
  type SystemMetrics,
} from '@/api/dashboard';
import { exportFoias } from '@/api/exports';
import { useSSE } from '@/hooks/useSSE';
import { formatRelativeTime, formatCompactNumber, formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/cn';

// Activity type → icon color mapping
const ACTIVITY_COLORS: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'default'> = {
  foia_submitted: 'info',
  foia_fulfilled: 'success',
  foia_denied: 'danger',
  video_published: 'success',
  video_uploaded: 'purple',
  article_scanned: 'warning',
  article_reviewed: 'info',
  status_change: 'info',
  scan_complete: 'success',
};

export function DashboardPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [articles, setArticles] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [pipeline, setPipeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Extended data
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);

  const refreshDashboard = useCallback(async () => {
    try {
      const data = await getDashboardStats();
      setStats(data.stats);
      setPipeline(data.pipeline ?? []);
      setArticles(data.recent_articles ?? []);
      setVideos(data.top_videos ?? []);
      setActivities(data.activities ?? []);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const data = await getDashboardStats();
        setStats(data.stats);
        setPipeline(data.pipeline ?? []);
        setArticles(data.recent_articles ?? []);
        setVideos(data.top_videos ?? []);
        setActivities(data.activities ?? []);
      } catch {
        // Use empty state on error
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();

    // Load extended data in background
    getDashboardSummary().then(setSummary).catch(() => {});
    getSystemMetrics().then(setMetrics).catch(() => {});
  }, []);

  // SSE: refetch dashboard stats on any event
  const sseHandlers = useMemo(() => ({
    scan_complete: () => refreshDashboard(),
    foia_response: () => refreshDashboard(),
    foia_submitted: () => refreshDashboard(),
    video_published: () => refreshDashboard(),
    video_status_changed: () => refreshDashboard(),
    video_scheduled_publish: () => refreshDashboard(),
  }), [refreshDashboard]);
  useSSE(sseHandlers);

  const healthScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-400';
    if (score >= 70) return 'text-amber-400';
    return 'text-red-400';
  };

  const healthScoreBg = (score: number) => {
    if (score >= 90) return 'bg-emerald-500/10 border-emerald-500/20';
    if (score >= 70) return 'bg-amber-500/10 border-amber-500/20';
    return 'bg-red-500/10 border-red-500/20';
  };

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="heading-3 mb-2">Dashboard</h1>
          <p className="text-sm text-text-secondary">
            Monitor your accountability journalism workflow
          </p>
        </div>
        <Button
          variant="outline"
          onClick={async () => {
            try {
              await exportFoias();
              addToast({ type: 'success', title: 'FOIA data exported' });
            } catch {
              addToast({ type: 'error', title: 'Export failed' });
            }
          }}
          icon={<Download className="h-4 w-4" />}
        >
          Export FOIAs
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-surface-secondary border border-surface-border/50 p-6 space-y-3">
              <Skeleton variant="text" className="h-3 w-16" />
              <Skeleton variant="text" className="h-5 w-12" />
              <Skeleton variant="text" className="h-2.5 w-10" />
            </div>
          ))
        ) : (
          <>
            <div onClick={() => navigate('/news')} className="cursor-pointer">
              <StatCard
                label="Total Articles"
                value={stats ? formatCompactNumber(stats.total_articles) : '0'}
                trend={stats ? { value: stats.articles_trend, isPositive: stats.articles_trend >= 0 } : undefined}
                icon={<Newspaper size={22} />}
                gradient="amber"
                className="animate-fade-in"
                style={{ animationDelay: '0ms' } as React.CSSProperties}
              />
            </div>
            <div onClick={() => navigate('/foia')} className="cursor-pointer">
              <StatCard
                label="Active FOIAs"
                value={stats ? formatCompactNumber(stats.active_foias) : '0'}
                trend={stats ? { value: stats.foias_trend, isPositive: stats.foias_trend >= 0 } : undefined}
                icon={<FileText size={22} />}
                gradient="blue"
                className="animate-fade-in"
                style={{ animationDelay: '50ms' } as React.CSSProperties}
              />
            </div>
            <div onClick={() => navigate('/videos')} className="cursor-pointer">
              <StatCard
                label="Videos in Pipeline"
                value={stats ? formatCompactNumber(stats.videos_in_pipeline) : '0'}
                trend={stats ? { value: stats.videos_trend, isPositive: stats.videos_trend >= 0 } : undefined}
                icon={<Video size={22} />}
                gradient="purple"
                className="animate-fade-in"
                style={{ animationDelay: '100ms' } as React.CSSProperties}
              />
            </div>
            <div onClick={() => navigate('/analytics')} className="cursor-pointer">
              <StatCard
                label="Total Views"
                value={stats ? formatCompactNumber(stats.total_views) : '0'}
                trend={stats ? { value: stats.views_trend, isPositive: stats.views_trend >= 0 } : undefined}
                icon={<Eye size={22} />}
                gradient="emerald"
                className="animate-fade-in"
                style={{ animationDelay: '150ms' } as React.CSSProperties}
              />
            </div>
            <div onClick={() => navigate('/analytics')} className="cursor-pointer">
              <StatCard
                label="Revenue MTD"
                value={stats ? formatCurrency(stats.revenue_mtd) : '$0.00'}
                trend={stats ? { value: stats.revenue_trend, isPositive: stats.revenue_trend >= 0 } : undefined}
                icon={<DollarSign size={22} />}
                gradient="rose"
                className="animate-fade-in"
                style={{ animationDelay: '200ms' } as React.CSSProperties}
              />
            </div>
          </>
        )}
      </div>

      {/* Today's Snapshot + System Health (from summary & metrics) */}
      {(summary || metrics) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
          {/* Today's Numbers */}
          {summary && (
            <Card title="Today's Activity">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-text-primary tabular-nums">{summary.today.articles}</p>
                  <p className="text-xs text-text-tertiary">Articles</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-400 tabular-nums">{summary.today.high_severity_articles}</p>
                  <p className="text-xs text-text-tertiary">High Severity</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-400 tabular-nums">{summary.today.foias_submitted}</p>
                  <p className="text-xs text-text-tertiary">FOIAs Filed</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-400 tabular-nums">{summary.today.videos_published}</p>
                  <p className="text-xs text-text-tertiary">Published</p>
                </div>
              </div>

              {/* Alerts */}
              {(summary.system_health.overdue_foias > 0 || summary.system_health.videos_ready_for_upload > 0) && (
                <div className="mt-4 pt-4 border-t border-surface-border/30 space-y-2">
                  {summary.system_health.overdue_foias > 0 && (
                    <div className="flex items-center gap-2 text-amber-400">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">
                        {summary.system_health.overdue_foias} overdue FOIA{summary.system_health.overdue_foias !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                  {summary.system_health.videos_ready_for_upload > 0 && (
                    <div className="flex items-center gap-2 text-blue-400">
                      <Video className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">
                        {summary.system_health.videos_ready_for_upload} video{summary.system_health.videos_ready_for_upload !== 1 ? 's' : ''} ready to upload
                      </span>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}

          {/* System Health Score */}
          {metrics && (
            <Card title="System Health">
              <div className="flex flex-col items-center justify-center py-2">
                <div className={cn(
                  'flex items-center justify-center h-20 w-20 rounded-full border-2',
                  healthScoreBg(metrics.overall_health_score)
                )}>
                  <span className={cn('text-2xl font-bold tabular-nums', healthScoreColor(metrics.overall_health_score))}>
                    {metrics.overall_health_score}
                  </span>
                </div>
                <p className="text-xs text-text-tertiary mt-2">Health Score</p>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="h-3.5 w-3.5 text-text-quaternary" />
                    <span className="text-xs text-text-secondary">Database</span>
                  </div>
                  <span className="text-xs text-text-tertiary tabular-nums">
                    {metrics.database.table_counts.articles + metrics.database.table_counts.foias + metrics.database.table_counts.videos} records
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wifi className="h-3.5 w-3.5 text-text-quaternary" />
                    <span className="text-xs text-text-secondary">Redis</span>
                  </div>
                  <span className="text-xs text-text-tertiary">
                    {metrics.redis.error ? (
                      <Badge variant="danger" size="sm">offline</Badge>
                    ) : (
                      <span className="tabular-nums">{metrics.redis.hit_rate ?? 0}% hit rate</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5 text-text-quaternary" />
                    <span className="text-xs text-text-secondary">Background Tasks</span>
                  </div>
                  <span className="text-xs text-text-tertiary tabular-nums">
                    {metrics.background_tasks.past_24h.success_rate}% success
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5 text-text-quaternary" />
                    <span className="text-xs text-text-secondary">Circuit Breakers</span>
                  </div>
                  <span className="text-xs text-text-tertiary tabular-nums">
                    {metrics.circuit_breakers.health_score}% healthy
                  </span>
                </div>
                {!metrics.system_resources.error && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-3.5 w-3.5 text-text-quaternary" />
                      <span className="text-xs text-text-secondary">Resources</span>
                    </div>
                    <span className="text-xs text-text-tertiary tabular-nums">
                      {metrics.system_resources.memory_used_mb}MB / {metrics.system_resources.cpu_percent}% CPU
                    </span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Revenue P&L from Summary */}
          {summary && (
            <Card title="Monthly P&L">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">Revenue</span>
                  <span className="text-sm font-semibold text-emerald-400 tabular-nums">
                    ${summary.revenue.month_revenue.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">FOIA Costs</span>
                  <span className="text-sm font-semibold text-red-400 tabular-nums">
                    -${summary.revenue.month_costs.toLocaleString()}
                  </span>
                </div>
                <div className="border-t border-surface-border/30 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-text-primary">Net Profit</span>
                    <span className={cn(
                      'text-lg font-bold tabular-nums',
                      summary.revenue.month_profit >= 0 ? 'text-emerald-400' : 'text-red-400'
                    )}>
                      ${Math.abs(summary.revenue.month_profit).toLocaleString()}
                    </span>
                  </div>
                  {summary.revenue.month_roi_percent > 0 && (
                    <div className="flex items-center gap-1 mt-1 justify-end">
                      <TrendingUp className="h-3 w-3 text-emerald-400" />
                      <span className="text-xs text-emerald-400 tabular-nums">{summary.revenue.month_roi_percent}% ROI</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Agency Performance */}
              {summary.agency_performance.length > 0 && (
                <div className="mt-4 pt-4 border-t border-surface-border/30">
                  <p className="text-xs text-text-tertiary uppercase tracking-wider mb-2">Top Agencies</p>
                  <div className="space-y-1.5">
                    {summary.agency_performance.slice(0, 3).map((agency) => (
                      <div key={agency.id} className="flex items-center justify-between">
                        <span className="text-xs text-text-secondary truncate max-w-[140px]">
                          {agency.abbreviation || agency.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-text-tertiary tabular-nums">{agency.total_requests} req</span>
                          <Badge
                            variant={agency.fulfillment_rate >= 50 ? 'success' : 'default'}
                            size="sm"
                          >
                            {agency.fulfillment_rate}%
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}
          {/* Auto-Submit Decisions */}
          <AutoSubmitStats />
        </div>
      )}

      {/* Pipeline Funnel */}
      {!loading && (
        pipeline.length > 0 ? (
          <PipelineFunnel stages={pipeline} />
        ) : (
          <Card title="Pipeline Overview">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-3 rounded-sm bg-surface-border/50" />
                <div className="h-6 w-3 rounded-sm bg-surface-border/40" />
                <div className="h-4 w-3 rounded-sm bg-surface-border/30" />
                <div className="h-3 w-3 rounded-sm bg-surface-border/20" />
              </div>
              <p className="text-sm text-text-tertiary">Pipeline data will appear once articles and FOIAs flow through the system</p>
            </div>
          </Card>
        )
      )}

      {/* FOIA Status Breakdown (from summary) */}
      {summary && Object.keys(summary.foia_status).length > 0 && (
        <Card
          title="FOIA Status Breakdown"
          action={
            <button onClick={() => navigate('/foia')} className="text-xs text-accent-primary hover:text-accent-primary/80 flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </button>
          }
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {Object.entries(summary.foia_status).map(([status, count]) => (
              <div key={status} className="rounded-lg bg-surface-tertiary/30 border border-surface-border/30 px-3 py-2.5 text-center">
                <p className="text-lg font-bold text-text-primary tabular-nums">{count}</p>
                <p className="text-xs text-text-tertiary capitalize">{status.replace(/_/g, ' ')}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Articles */}
        <Card
          title="Recent Articles"
          action={
            <button onClick={() => navigate('/news')} className="text-xs text-accent-primary hover:text-accent-primary/80 flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </button>
          }
        >
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <Skeleton variant="text" className="h-3 w-full" />
                    <Skeleton variant="text" className="h-2.5 w-24" />
                  </div>
                  <Skeleton variant="text" className="h-4 w-12" />
                </div>
              ))}
            </div>
          ) : articles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Newspaper className="h-6 w-6 text-text-quaternary mb-2" />
              <p className="text-sm text-text-tertiary">No recent articles</p>
              <button
                onClick={() => navigate('/news')}
                className="mt-2 text-xs text-accent-primary hover:underline"
              >
                Go to News Scanner
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {articles.map((article) => (
                <div
                  key={article.id}
                  className="group flex items-start justify-between gap-3 rounded-lg px-3 py-2.5 -mx-3 transition-colors hover:bg-surface-hover cursor-pointer"
                  onClick={() => navigate('/news')}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-text-primary font-medium group-hover:text-accent-primary transition-colors">
                      {article.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-text-tertiary">{article.source}</span>
                      <span className="text-text-quaternary">&middot;</span>
                      <span className="text-xs text-text-quaternary flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(article.created_at)}
                      </span>
                    </div>
                  </div>
                  <Badge
                    variant={
                      article.severity === 'high' ? 'danger' :
                      article.severity === 'medium' ? 'warning' : 'success'
                    }
                    size="sm"
                  >
                    {article.severity}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Top Videos */}
        <Card
          title="Top Videos"
          action={
            <button onClick={() => navigate('/videos')} className="text-xs text-accent-primary hover:text-accent-primary/80 flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </button>
          }
        >
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <Skeleton variant="text" className="h-3 w-full" />
                    <Skeleton variant="text" className="h-2.5 w-24" />
                  </div>
                  <Skeleton variant="text" className="h-4 w-12" />
                </div>
              ))}
            </div>
          ) : videos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Video className="h-6 w-6 text-text-quaternary mb-2" />
              <p className="text-sm text-text-tertiary">No videos yet</p>
              <button
                onClick={() => navigate('/videos')}
                className="mt-2 text-xs text-accent-primary hover:underline"
              >
                Go to Video Pipeline
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              {videos.map((video, i) => (
                <div
                  key={video.id}
                  className="group flex items-start justify-between gap-3 rounded-lg px-3 py-2.5 -mx-3 transition-colors hover:bg-surface-hover cursor-pointer"
                  onClick={() => navigate('/videos')}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <span className={cn(
                      'mt-0.5 shrink-0 flex items-center justify-center h-5 w-5 rounded text-2xs font-bold tabular-nums',
                      i === 0 ? 'bg-amber-500/20 text-amber-400' :
                      i === 1 ? 'bg-slate-400/20 text-slate-400' :
                      i === 2 ? 'bg-orange-500/20 text-orange-400' :
                      'bg-surface-tertiary text-text-quaternary'
                    )}>
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-text-primary font-medium group-hover:text-accent-primary transition-colors">
                        {video.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-text-tertiary tabular-nums">
                          {formatCompactNumber(video.views)} views
                        </span>
                        <span className="text-text-quaternary">&middot;</span>
                        <span className="text-xs text-text-quaternary">
                          {video.published_at ? formatRelativeTime(video.published_at) : 'Unpublished'}
                        </span>
                      </div>
                    </div>
                  </div>
                  {video.youtube_url && (
                    <ExternalLink className="h-3.5 w-3.5 text-text-quaternary shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Activity Feed */}
      <Card
        title="Activity Feed"
        action={
          <button onClick={() => navigate('/audit')} className="text-xs text-accent-primary hover:text-accent-primary/80 flex items-center gap-1">
            Audit Log <ArrowRight className="h-3 w-3" />
          </button>
        }
      >
        {loading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton variant="circular" className="h-1.5 w-1.5" />
                <Skeleton variant="text" className="h-3 flex-1" />
                <Skeleton variant="text" className="h-2.5 w-16" />
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Clock className="h-6 w-6 text-text-quaternary mb-2" />
            <p className="text-sm text-text-tertiary">No recent activity</p>
            <p className="text-xs text-text-quaternary mt-1">Activity from scanning, FOIA submissions, and video processing will appear here</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2 -mx-3 transition-colors hover:bg-surface-hover"
              >
                <StatusOrb
                  color={ACTIVITY_COLORS[activity.type] || 'default'}
                  size="sm"
                  pulse={false}
                />
                <p className="flex-1 text-sm text-text-secondary">
                  {activity.message}
                </p>
                <span className="shrink-0 text-xs text-text-quaternary tabular-nums flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatRelativeTime(activity.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
