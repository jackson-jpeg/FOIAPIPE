import { useEffect, useState } from 'react';
import { TimeRangeSelector } from '@/components/analytics/TimeRangeSelector';
import { RevenueChart } from '@/components/analytics/RevenueChart';
import { ViewsChart } from '@/components/analytics/ViewsChart';
import { TopVideosTable } from '@/components/analytics/TopVideosTable';
import { FunnelChart } from '@/components/analytics/FunnelChart';
import { AgencyBreakdownChart } from '@/components/analytics/AgencyBreakdownChart';
import { ROITable } from '@/components/analytics/ROITable';
import { VelocityChart } from '@/components/analytics/VelocityChart';
import { FoiaPerformanceTable } from '@/components/analytics/FoiaPerformanceTable';
import { VideoProfitabilityTable } from '@/components/analytics/VideoProfitabilityTable';
import { BreakEvenCard } from '@/components/analytics/BreakEvenCard';
import { RevenueTransactionsTable } from '@/components/analytics/RevenueTransactionsTable';
import { IncidentTypeChart } from '@/components/analytics/IncidentTypeChart';
import { PublishingInsightsCard } from '@/components/analytics/PublishingInsightsCard';
import { AgencyResponseCard } from '@/components/analytics/AgencyResponseCard';
import { StatCard } from '@/components/ui/StatCard';
import { StatCardSkeleton } from '@/components/ui/StatCardSkeleton';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { DollarSign, Eye, Users, TrendingUp, Target, Download } from 'lucide-react';
import * as analyticsApi from '@/api/analytics';
import { exportAnalyticsSummary } from '@/api/exports';

export function AnalyticsPage() {
  const { addToast } = useToast();
  const [range, setRange] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [overview, setOverview] = useState<any>(null);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [viewsData, setViewsData] = useState<any[]>([]);
  const [topVideos, setTopVideos] = useState<any[]>([]);
  const [funnel, setFunnel] = useState<any>(null);
  const [agencyData, setAgencyData] = useState<any[]>([]);
  const [roiData, setRoiData] = useState<any[]>([]);
  const [velocityData, setVelocityData] = useState<any[]>([]);
  const [foiaPerformance, setFoiaPerformance] = useState<any[]>([]);
  const [profitability, setProfitability] = useState<any[]>([]);
  const [breakEven, setBreakEven] = useState<any>(null);
  const [incidentData, setIncidentData] = useState<any[]>([]);
  const [agencyResponseData, setAgencyResponseData] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [ov, rev, views, top, fun, agency, roi, velocity, foiaPerf, profit, be, incident, agencyResp] = await Promise.all([
          analyticsApi.getOverview(range),
          analyticsApi.getRevenue(range),
          analyticsApi.getViews(range),
          analyticsApi.getTopVideos(range),
          analyticsApi.getFunnel(),
          analyticsApi.getByAgency(range).catch(() => []),
          analyticsApi.getRoi().catch(() => []),
          analyticsApi.getVelocity().catch(() => []),
          analyticsApi.getFoiaPerformance().catch(() => []),
          analyticsApi.getVideoProfitability().catch(() => []),
          analyticsApi.getBreakEvenAnalysis().catch(() => null),
          analyticsApi.getByIncidentType(range).catch(() => []),
          analyticsApi.getAgencyResponseAnalytics().catch(() => []),
        ]);
        setOverview(ov);
        setRevenueData((rev as any)?.data || rev || []);
        setViewsData((views as any)?.data || views || []);
        setTopVideos(top || []);
        setFunnel(fun);
        setAgencyData(agency || []);
        setRoiData(roi || []);
        setVelocityData(velocity || []);
        setFoiaPerformance(foiaPerf || []);
        setProfitability(profit || []);
        setBreakEven(be);
        setIncidentData(incident || []);
        setAgencyResponseData(agencyResp || []);
      } catch (error) {
        console.error('Analytics load error:', error);
        addToast({ type: 'error', title: 'Failed to load some analytics data' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [range]);

  const netProfit = overview
    ? (overview.total_revenue || 0) - (overview.total_costs || 0)
    : 0;

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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              setExporting(true);
              try {
                const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365;
                await exportAnalyticsSummary(days);
                addToast({ type: 'success', title: 'Analytics exported' });
              } catch {
                addToast({ type: 'error', title: 'Export failed' });
              } finally {
                setExporting(false);
              }
            }}
            loading={exporting}
            icon={<Download className="h-4 w-4" />}
          >
            Export CSV
          </Button>
          <TimeRangeSelector value={range} onChange={setRange} />
        </div>
      </div>

      {/* Stat Cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : overview ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard
            label="Gross Revenue"
            value={`$${(overview.total_revenue || 0).toLocaleString()}`}
            trend={overview.trends?.revenue ? { value: overview.trends.revenue.value, isPositive: overview.trends.revenue.is_positive } : undefined}
            icon={<DollarSign className="h-5 w-5" />}
            gradient="emerald"
            sparkline={revenueData.slice(-7).map(d => d.value)}
          />
          <StatCard
            label="Net Profit"
            value={`$${netProfit.toLocaleString()}`}
            icon={<Target className="h-5 w-5" />}
            gradient={netProfit >= 0 ? 'cyan' : 'rose'}
          />
          <StatCard
            label="Total Views"
            value={(overview.total_views || 0).toLocaleString()}
            trend={overview.trends?.views ? { value: overview.trends.views.value, isPositive: overview.trends.views.is_positive } : undefined}
            icon={<Eye className="h-5 w-5" />}
            gradient="blue"
            sparkline={viewsData.slice(-7).map(d => d.value)}
          />
          <StatCard
            label="Subscribers"
            value={(overview.total_subscribers || 0).toLocaleString()}
            icon={<Users className="h-5 w-5" />}
            gradient="purple"
          />
          <StatCard
            label="Avg RPM"
            value={`$${(overview.avg_rpm || 0).toFixed(2)}`}
            icon={<TrendingUp className="h-5 w-5" />}
            gradient="amber"
          />
        </div>
      ) : null}

      {/* Revenue & Views Charts */}
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

      {/* Agency Breakdown & Incident Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AgencyBreakdownChart data={agencyData} />
        <IncidentTypeChart data={incidentData} />
      </div>

      {/* Pipeline Velocity & Publishing Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <VelocityChart data={velocityData} />
        <PublishingInsightsCard />
      </div>

      {/* FOIA Performance & Break-Even */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <FoiaPerformanceTable data={foiaPerformance} />
        </div>
        <BreakEvenCard data={breakEven} />
      </div>

      {/* Agency Response Analytics */}
      <AgencyResponseCard data={agencyResponseData} />

      {/* Revenue Transactions */}
      <RevenueTransactionsTable range={range} />

      {/* Video Profitability */}
      <VideoProfitabilityTable data={profitability} />

      {/* ROI Analysis */}
      <ROITable data={roiData} />
    </div>
  );
}
