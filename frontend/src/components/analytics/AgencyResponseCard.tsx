import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';

interface AgencyResponse {
  agency_id: string;
  agency_name: string;
  abbreviation: string | null;
  total_requests: number;
  status_breakdown: {
    fulfilled: number;
    partial: number;
    denied: number;
    pending: number;
    processing: number;
    acknowledged: number;
  };
  fulfillment_rate: number;
  denial_rate: number;
  response_time: {
    avg_days: number;
    min_days: number;
    max_days: number;
  };
  cost: {
    avg: number;
    min: number;
    max: number;
    total: number;
  };
  videos: {
    count: number;
    total_revenue: number;
  };
}

interface AgencyResponseCardProps {
  data: AgencyResponse[];
}

export function AgencyResponseCard({ data }: AgencyResponseCardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (data.length === 0) {
    return (
      <Card title="Agency Response Analytics">
        <p className="text-sm text-text-tertiary text-center py-8">No agency data yet</p>
      </Card>
    );
  }

  return (
    <Card title="Agency Response Analytics">
      <div className="space-y-2">
        {data.map((agency) => {
          const isExpanded = expandedId === agency.agency_id;
          const roi = agency.cost.total > 0
            ? ((agency.videos.total_revenue - agency.cost.total) / agency.cost.total * 100)
            : 0;

          return (
            <div key={agency.agency_id} className="rounded-lg border border-surface-border/50">
              {/* Summary Row */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : agency.agency_id)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-hover transition-colors rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {agency.abbreviation || agency.agency_name}
                    </p>
                    <p className="text-2xs text-text-quaternary">
                      {agency.total_requests} requests
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant={agency.fulfillment_rate >= 70 ? 'success' : agency.fulfillment_rate >= 40 ? 'warning' : 'danger'}
                    size="sm"
                  >
                    {agency.fulfillment_rate}% fulfilled
                  </Badge>
                  <span className="text-xs tabular-nums text-text-secondary">
                    {agency.response_time.avg_days}d avg
                  </span>
                  <svg
                    className={cn('h-4 w-4 text-text-quaternary transition-transform', isExpanded && 'rotate-180')}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-1 border-t border-surface-border/30">
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    {/* Status Breakdown */}
                    <div>
                      <p className="font-medium text-text-secondary mb-2">Status Breakdown</p>
                      <div className="space-y-1">
                        {Object.entries(agency.status_breakdown)
                          .filter(([, count]) => count > 0)
                          .map(([status, count]) => (
                            <div key={status} className="flex justify-between">
                              <span className="text-text-tertiary capitalize">{status}</span>
                              <span className="tabular-nums text-text-primary">{count}</span>
                            </div>
                          ))}
                      </div>
                      {/* Status bar */}
                      <div className="mt-2 h-2 rounded-full bg-surface-border/50 overflow-hidden flex">
                        {agency.status_breakdown.fulfilled > 0 && (
                          <div
                            className="bg-accent-green h-full"
                            style={{ width: `${(agency.status_breakdown.fulfilled / agency.total_requests) * 100}%` }}
                          />
                        )}
                        {agency.status_breakdown.partial > 0 && (
                          <div
                            className="bg-accent-yellow h-full"
                            style={{ width: `${(agency.status_breakdown.partial / agency.total_requests) * 100}%` }}
                          />
                        )}
                        {agency.status_breakdown.denied > 0 && (
                          <div
                            className="bg-accent-red h-full"
                            style={{ width: `${(agency.status_breakdown.denied / agency.total_requests) * 100}%` }}
                          />
                        )}
                      </div>
                    </div>

                    {/* Response Time */}
                    <div>
                      <p className="font-medium text-text-secondary mb-2">Response Time</p>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-text-tertiary">Average</span>
                          <span className="tabular-nums text-text-primary font-medium">{agency.response_time.avg_days}d</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-tertiary">Fastest</span>
                          <span className="tabular-nums text-text-primary">{agency.response_time.min_days}d</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-tertiary">Slowest</span>
                          <span className="tabular-nums text-text-primary">{agency.response_time.max_days}d</span>
                        </div>
                      </div>
                    </div>

                    {/* Cost & Revenue */}
                    <div>
                      <p className="font-medium text-text-secondary mb-2">Cost & Revenue</p>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-text-tertiary">Total Spent</span>
                          <span className="tabular-nums text-text-primary">${agency.cost.total.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-tertiary">Avg Cost</span>
                          <span className="tabular-nums text-text-primary">${agency.cost.avg.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-tertiary">Videos</span>
                          <span className="tabular-nums text-text-primary">{agency.videos.count}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-tertiary">Revenue</span>
                          <span className="tabular-nums text-text-primary">${agency.videos.total_revenue.toFixed(2)}</span>
                        </div>
                        {agency.cost.total > 0 && (
                          <div className="flex justify-between pt-1 border-t border-surface-border/30">
                            <span className="text-text-tertiary">ROI</span>
                            <Badge variant={roi >= 0 ? 'success' : 'danger'} size="sm">
                              {roi >= 0 ? '+' : ''}{roi.toFixed(0)}%
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
