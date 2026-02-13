import { useEffect, useState } from 'react';
import { FileText, Building2, Clock, TrendingUp, CheckCircle2, XCircle, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/cn';
import client from '@/api/client';

interface PublicStats {
  total_filed: number;
  fulfillment_rate: number;
  avg_response_days: number;
  agency_count: number;
  denied_count: number;
  monthly_trends: { month: string; filed: number; fulfilled: number; denied: number }[];
  recent_filings: { case_number: string; status: string; agency: string; filed_at: string }[];
}

interface AgencyCard {
  id: string;
  name: string;
  abbreviation: string | null;
  grade: string;
  total_requests: number;
  fulfilled: number;
  denied: number;
  fulfillment_rate: number;
}

const gradeColors: Record<string, string> = {
  A: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  B: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  C: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  D: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  F: 'text-red-400 bg-red-500/10 border-red-500/30',
};

const statusColors: Record<string, string> = {
  submitted: 'bg-blue-500/10 text-blue-400',
  acknowledged: 'bg-sky-500/10 text-sky-400',
  processing: 'bg-amber-500/10 text-amber-400',
  fulfilled: 'bg-emerald-500/10 text-emerald-400',
  denied: 'bg-red-500/10 text-red-400',
};

export function PublicDashboardPage() {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [agencies, setAgencies] = useState<AgencyCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      client.get('/public/stats').then(r => r.data),
      client.get('/public/agency-report-cards').then(r => r.data),
    ])
      .then(([statsData, agencyData]) => {
        setStats(statsData);
        setAgencies(agencyData.agencies || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="animate-pulse text-white/40 text-sm">Loading transparency data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Hero */}
      <div className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-accent-primary flex items-center justify-center">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">FOIA Archive</h1>
          </div>
          <p className="text-lg text-white/60 max-w-2xl">
            Public accountability dashboard for Tampa Bay law enforcement FOIA requests.
            Tracking government transparency through data.
          </p>

          {/* Hero Stats */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-white/40 text-xs mb-2">
                  <FileText className="h-3.5 w-3.5" />
                  Total FOIAs Filed
                </div>
                <p className="text-3xl font-bold tabular-nums">{stats.total_filed.toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-white/40 text-xs mb-2">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Fulfillment Rate
                </div>
                <p className="text-3xl font-bold tabular-nums">{stats.fulfillment_rate}%</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-white/40 text-xs mb-2">
                  <Clock className="h-3.5 w-3.5" />
                  Avg. Response
                </div>
                <p className="text-3xl font-bold tabular-nums">{stats.avg_response_days}<span className="text-lg text-white/40 ml-1">days</span></p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-white/40 text-xs mb-2">
                  <Building2 className="h-3.5 w-3.5" />
                  Agencies Tracked
                </div>
                <p className="text-3xl font-bold tabular-nums">{stats.agency_count}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Agency Report Cards */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="h-4 w-4 text-white/40" />
              <h2 className="text-lg font-semibold">Agency Report Cards</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {agencies.map((agency) => {
                const gradeClass = gradeColors[agency.grade?.[0]] || 'text-white/40 bg-white/5 border-white/10';
                return (
                  <div key={agency.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{agency.name}</p>
                        {agency.abbreviation && (
                          <p className="text-xs text-white/40">{agency.abbreviation}</p>
                        )}
                      </div>
                      <div className={cn(
                        'flex items-center justify-center h-10 w-10 rounded-lg border text-lg font-bold flex-shrink-0',
                        gradeClass
                      )}>
                        {agency.grade}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-lg font-semibold tabular-nums">{agency.total_requests}</p>
                        <p className="text-2xs text-white/40">Filed</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold tabular-nums text-emerald-400">{agency.fulfilled}</p>
                        <p className="text-2xs text-white/40">Fulfilled</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold tabular-nums text-red-400">{agency.denied}</p>
                        <p className="text-2xs text-white/40">Denied</p>
                      </div>
                    </div>
                    <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${agency.fulfillment_rate}%` }}
                      />
                    </div>
                    <p className="mt-1 text-2xs text-white/40 text-right">{agency.fulfillment_rate}% fulfilled</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Filings & Monthly Trends */}
          <div className="space-y-6">
            {/* Monthly Trends */}
            {stats && stats.monthly_trends.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-4 w-4 text-white/40" />
                  <h2 className="text-lg font-semibold">Monthly Trends</h2>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                  {stats.monthly_trends.map((month) => (
                    <div key={month.month} className="flex items-center justify-between text-sm">
                      <span className="text-white/60 tabular-nums">{month.month}</span>
                      <div className="flex items-center gap-3 text-xs tabular-nums">
                        <span className="text-white/80">{month.filed} filed</span>
                        <span className="text-emerald-400">{month.fulfilled} ful.</span>
                        <span className="text-red-400">{month.denied} den.</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Filings */}
            {stats && stats.recent_filings.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="h-4 w-4 text-white/40" />
                  <h2 className="text-lg font-semibold">Recent Filings</h2>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 divide-y divide-white/5">
                  {stats.recent_filings.map((filing) => (
                    <div key={filing.case_number} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-mono text-white/80">{filing.case_number}</p>
                        <p className="text-2xs text-white/40">{filing.agency}</p>
                      </div>
                      <span className={cn(
                        'text-2xs px-2 py-0.5 rounded-full font-medium',
                        statusColors[filing.status] || 'bg-white/5 text-white/40'
                      )}>
                        {filing.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-white/10 text-center">
          <p className="text-xs text-white/30">
            FOIA Archive is an automated public records pipeline. Data is updated in real-time.
          </p>
        </div>
      </div>
    </div>
  );
}
