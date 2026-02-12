import { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusOrb } from '@/components/ui/StatusOrb';
import { PipelineFunnel } from '@/components/dashboard/PipelineFunnel';
import { getDashboardStats, type DashboardStats } from '@/api/dashboard';
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
};

export function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [articles, setArticles] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [pipeline, setPipeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
  }, []);

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div>
        <h1 className="heading-3 mb-2">Dashboard</h1>
        <p className="text-sm text-text-secondary">
          Monitor your accountability journalism workflow
        </p>
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
