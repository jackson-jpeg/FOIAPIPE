import { useEffect, useState } from 'react';
import { TimeRangeSelector } from '@/components/analytics/TimeRangeSelector';
import { RevenueChart } from '@/components/analytics/RevenueChart';
import { ViewsChart } from '@/components/analytics/ViewsChart';
import { TopVideosTable } from '@/components/analytics/TopVideosTable';
import { FunnelChart } from '@/components/analytics/FunnelChart';
import { StatCard } from '@/components/ui/StatCard';
import { StatCardSkeleton } from '@/components/ui/StatCardSkeleton';
import { DollarSign, Eye, Users, TrendingUp } from 'lucide-react';
import * as analyticsApi from '@/api/analytics';

export function AnalyticsPage() {
  const [range, setRange] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [viewsData, setViewsData] = useState<any[]>([]);
  const [topVideos, setTopVideos] = useState<any[]>([]);
  const [funnel, setFunnel] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [ov, rev, views, top, fun] = await Promise.all([
          analyticsApi.getOverview(range),
          analyticsApi.getRevenue(range),
          analyticsApi.getViews(range),
          analyticsApi.getTopVideos(range),
          analyticsApi.getFunnel(),
        ]);
        setOverview(ov);
        setRevenueData(rev.data || []);
        setViewsData(views.data || []);
        setTopVideos(top || []);
        setFunnel(fun);
      } catch {
        // Silently handle errors for empty state
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [range]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="heading-3 mb-2">Analytics</h1>
          <p className="text-sm text-text-secondary">
            Track YouTube performance metrics and revenue insights
          </p>
        </div>
        <TimeRangeSelector value={range} onChange={setRange} />
      </div>

      {/* Stat Cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : overview ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Gross Revenue"
            value={`$${overview.total_revenue?.toLocaleString() || '0'}`}
            trend={overview.trends?.revenue ? { value: overview.trends.revenue.value, isPositive: overview.trends.revenue.is_positive } : undefined}
            icon={<DollarSign className="h-5 w-5" />}
            gradient="emerald"
            sparkline={revenueData.slice(-7).map(d => d.value)}
          />
          <StatCard
            label="Total Views"
            value={overview.total_views?.toLocaleString() || '0'}
            trend={overview.trends?.views ? { value: overview.trends.views.value, isPositive: overview.trends.views.is_positive } : undefined}
            icon={<Eye className="h-5 w-5" />}
            gradient="blue"
            sparkline={viewsData.slice(-7).map(d => d.value)}
          />
          <StatCard
            label="Subscribers"
            value={overview.total_subscribers?.toLocaleString() || '0'}
            icon={<Users className="h-5 w-5" />}
            gradient="purple"
          />
          <StatCard
            label="Avg RPM"
            value={`$${overview.avg_rpm?.toFixed(2) || '0.00'}`}
            icon={<TrendingUp className="h-5 w-5" />}
            gradient="amber"
          />
        </div>
      ) : null}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueChart data={revenueData} />
        <ViewsChart data={viewsData} />
      </div>

      {/* Top Videos & Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TopVideosTable videos={topVideos} />
        </div>
        {funnel && <FunnelChart steps={funnel.steps || []} />}
      </div>
    </div>
  );
}
