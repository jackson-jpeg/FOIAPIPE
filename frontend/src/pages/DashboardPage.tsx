import { useEffect, useState } from 'react';
import { Newspaper, FileText, Video, Eye, DollarSign } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusOrb } from '@/components/ui/StatusOrb';
import client from '@/api/client';
import { formatRelativeTime, formatCompactNumber, formatCurrency } from '@/lib/formatters';

interface DashboardStats {
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

interface RecentArticle {
  id: string;
  title: string;
  source: string;
  severity: 'high' | 'medium' | 'low';
  created_at: string;
}

interface TopVideo {
  id: string;
  title: string;
  views: number;
  status: string;
  published_at: string | null;
}

interface ActivityItem {
  id: string;
  type: string;
  message: string;
  timestamp: string;
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [articles, setArticles] = useState<RecentArticle[]>([]);
  const [videos, setVideos] = useState<TopVideo[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const response = await client.get('/dashboard/stats');
        const data = response.data;
        setStats(data.stats);
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
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-text-tertiary">
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
            <StatCard
              label="Total Articles"
              value={stats ? formatCompactNumber(stats.total_articles) : '0'}
              trend={stats ? { value: stats.articles_trend, isPositive: stats.articles_trend >= 0 } : undefined}
              icon={<Newspaper size={22} />}
              gradient="amber"
              className="animate-fade-in"
              style={{ animationDelay: '0ms' } as React.CSSProperties}
            />
            <StatCard
              label="Active FOIAs"
              value={stats ? formatCompactNumber(stats.active_foias) : '0'}
              trend={stats ? { value: stats.foias_trend, isPositive: stats.foias_trend >= 0 } : undefined}
              icon={<FileText size={22} />}
              gradient="blue"
              className="animate-fade-in"
              style={{ animationDelay: '50ms' } as React.CSSProperties}
            />
            <StatCard
              label="Videos in Pipeline"
              value={stats ? formatCompactNumber(stats.videos_in_pipeline) : '0'}
              trend={stats ? { value: stats.videos_trend, isPositive: stats.videos_trend >= 0 } : undefined}
              icon={<Video size={22} />}
              gradient="purple"
              className="animate-fade-in"
              style={{ animationDelay: '100ms' } as React.CSSProperties}
            />
            <StatCard
              label="Total Views"
              value={stats ? formatCompactNumber(stats.total_views) : '0'}
              trend={stats ? { value: stats.views_trend, isPositive: stats.views_trend >= 0 } : undefined}
              icon={<Eye size={22} />}
              gradient="emerald"
              className="animate-fade-in"
              style={{ animationDelay: '150ms' } as React.CSSProperties}
            />
            <StatCard
              label="Revenue MTD"
              value={stats ? formatCurrency(stats.revenue_mtd) : '$0.00'}
              trend={stats ? { value: stats.revenue_trend, isPositive: stats.revenue_trend >= 0 } : undefined}
              icon={<DollarSign size={22} />}
              gradient="rose"
              className="animate-fade-in"
              style={{ animationDelay: '200ms' } as React.CSSProperties}
            />
          </>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Articles */}
        <Card title="Recent Articles">
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
            <p className="text-sm text-text-tertiary py-4 text-center">No recent articles</p>
          ) : (
            <div className="space-y-1">
              {articles.map((article) => (
                <div
                  key={article.id}
                  className="group flex items-start justify-between gap-3 rounded-lg px-3 py-2.5 -mx-3 transition-colors hover:bg-surface-hover cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-text-primary font-medium">
                      {article.title}
                    </p>
                    <p className="mt-1 text-xs text-text-tertiary">
                      {article.source} &middot; {formatRelativeTime(article.created_at)}
                    </p>
                  </div>
                  <StatusOrb
                    color={
                      article.severity === 'high'
                        ? 'danger'
                        : article.severity === 'medium'
                        ? 'warning'
                        : 'success'
                    }
                    size="sm"
                    label={article.severity}
                  />
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Top Videos */}
        <Card title="Top Videos">
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
            <p className="text-sm text-text-tertiary py-4 text-center">No videos yet</p>
          ) : (
            <div className="space-y-1">
              {videos.map((video) => (
                <div
                  key={video.id}
                  className="group flex items-start justify-between gap-3 rounded-lg px-3 py-2.5 -mx-3 transition-colors hover:bg-surface-hover cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-text-primary font-medium">
                      {video.title}
                    </p>
                    <p className="mt-1 text-xs text-text-tertiary">
                      {formatCompactNumber(video.views)} views &middot;{' '}
                      {video.published_at ? formatRelativeTime(video.published_at) : 'Unpublished'}
                    </p>
                  </div>
                  <StatusOrb
                    color={
                      video.status === 'published'
                        ? 'success'
                        : video.status === 'processing'
                        ? 'warning'
                        : 'info'
                    }
                    size="sm"
                    label={video.status}
                  />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Activity Feed */}
      <Card title="Activity Feed">
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
          <p className="text-sm text-text-tertiary py-4 text-center">No recent activity</p>
        ) : (
          <div className="space-y-1">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-center gap-3 rounded-lg px-3 py-2 -mx-3 transition-colors hover:bg-surface-hover">
                <StatusOrb color="info" size="sm" pulse={false} />
                <p className="flex-1 text-sm text-text-secondary">
                  {activity.message}
                </p>
                <span className="shrink-0 text-xs text-text-tertiary tabular-nums">
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
