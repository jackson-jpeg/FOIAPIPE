import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Clock, Calendar, Zap } from 'lucide-react';
import * as analyticsApi from '@/api/analytics';

interface OptimalTime {
  hour: number;
  avg_views: number;
}

interface OptimalTimesData {
  has_data: boolean;
  top_weekday_hours: OptimalTime[];
  top_weekend_hours: OptimalTime[];
}

interface Recommendation {
  ready_count: number;
  next_optimal_time: string | null;
  ready_videos: { id: string; title: string }[];
}

export function PublishingInsightsCard() {
  const [times, setTimes] = useState<OptimalTimesData | null>(null);
  const [recs, setRecs] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      analyticsApi.getOptimalPublishTimes().catch(() => null),
      analyticsApi.getPublishingRecommendations().catch(() => null),
    ]).then(([t, r]) => {
      setTimes(t);
      setRecs(r);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card title="Publishing Insights">
        <div className="py-8 text-center text-sm text-text-tertiary">Loading...</div>
      </Card>
    );
  }

  const formatHour = (h: number) => {
    if (h === 0) return '12 AM';
    if (h === 12) return '12 PM';
    return h > 12 ? `${h - 12} PM` : `${h} AM`;
  };

  return (
    <Card title="Publishing Insights">
      <div className="space-y-4">
        {/* Ready Videos */}
        {recs && recs.ready_count > 0 && (
          <div className="flex items-start gap-3">
            <Zap className="h-4 w-4 text-accent-amber mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-text-primary font-medium">
                {recs.ready_count} video{recs.ready_count !== 1 ? 's' : ''} ready to publish
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {recs.ready_videos.slice(0, 3).map(v => (
                  <Badge key={v.id} variant="info" size="sm">{v.title || 'Untitled'}</Badge>
                ))}
                {recs.ready_count > 3 && (
                  <Badge variant="default" size="sm">+{recs.ready_count - 3} more</Badge>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Optimal Times */}
        {times?.has_data && (
          <>
            {times.top_weekday_hours.length > 0 && (
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-accent-blue mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-text-secondary font-medium mb-1">Best weekday hours</p>
                  <div className="flex gap-1.5">
                    {times.top_weekday_hours.slice(0, 4).map(t => (
                      <div key={t.hour} className="rounded-md bg-surface-tertiary/50 px-2 py-1">
                        <p className="text-xs font-mono text-text-primary">{formatHour(t.hour)}</p>
                        <p className="text-2xs text-text-quaternary">{t.avg_views.toLocaleString()} views</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {times.top_weekend_hours.length > 0 && (
              <div className="flex items-start gap-3">
                <Clock className="h-4 w-4 text-accent-purple mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-text-secondary font-medium mb-1">Best weekend hours</p>
                  <div className="flex gap-1.5">
                    {times.top_weekend_hours.slice(0, 4).map(t => (
                      <div key={t.hour} className="rounded-md bg-surface-tertiary/50 px-2 py-1">
                        <p className="text-xs font-mono text-text-primary">{formatHour(t.hour)}</p>
                        <p className="text-2xs text-text-quaternary">{t.avg_views.toLocaleString()} views</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {!times?.has_data && (!recs || recs.ready_count === 0) && (
          <p className="text-sm text-text-tertiary text-center py-4">
            Publish more videos to see optimal timing insights
          </p>
        )}
      </div>
    </Card>
  );
}
