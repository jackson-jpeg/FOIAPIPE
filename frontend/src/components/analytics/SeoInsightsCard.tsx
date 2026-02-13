import { useEffect, useState } from 'react';
import { Lightbulb, Clock, Hash, Tag, AlertCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { getSeoInsights, type SeoInsights } from '@/api/analytics';

export function SeoInsightsCard() {
  const [data, setData] = useState<SeoInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getSeoInsights()
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="glass-2 rounded-lg p-5">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 text-text-tertiary animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="glass-2 rounded-lg p-5">
        <div className="flex items-center gap-2 text-text-tertiary text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>SEO insights unavailable — publish more videos to generate data.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-2 rounded-lg p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-medium text-text-primary">SEO Insights</h3>
      </div>

      {/* Recommendations */}
      {data.recommendations.length > 0 && (
        <div className="space-y-2">
          {data.recommendations.map((rec, i) => (
            <div key={i} className="rounded-lg bg-accent-primary/5 border border-accent-primary/10 px-3.5 py-2.5">
              <p className="text-xs font-medium text-text-primary mb-0.5">{rec.title}</p>
              <p className="text-2xs text-text-secondary">{rec.detail}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Optimal Duration */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
            <Clock className="h-3 w-3" />
            Video Length Performance
          </div>
          <div className="space-y-1">
            {Object.entries(data.duration_buckets)
              .filter(([, b]) => b.count > 0)
              .sort((a, b) => b[1].avg_views - a[1].avg_views)
              .map(([label, bucket]) => (
                <div key={label} className="flex items-center justify-between text-xs px-2 py-1.5 rounded-md hover:bg-glass-highlight transition-colors">
                  <span className="text-text-primary font-mono">{label}</span>
                  <div className="flex items-center gap-3 text-text-tertiary tabular-nums">
                    <span>{bucket.avg_views.toLocaleString()} avg views</span>
                    <span>${bucket.avg_revenue.toFixed(2)} avg rev</span>
                    <Badge variant="default" size="sm">{bucket.count}</Badge>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Top Keywords */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
            <Hash className="h-3 w-3" />
            Top Title Keywords
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data.top_keywords.slice(0, 12).map(([keyword, views]) => (
              <span
                key={keyword}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-transparent text-2xs text-text-secondary"
              >
                {keyword}
                <span className="text-text-quaternary tabular-nums">{views.toLocaleString()}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Top Tags */}
        {data.top_tags.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
              <Tag className="h-3 w-3" />
              Best Performing Tags
            </div>
            <div className="space-y-1">
              {data.top_tags.slice(0, 8).map(tag => (
                <div key={tag.tag} className="flex items-center justify-between text-xs px-2 py-1 rounded-md hover:bg-glass-highlight transition-colors">
                  <span className="text-text-primary">{tag.tag}</span>
                  <span className="text-text-tertiary tabular-nums">{tag.avg_views.toLocaleString()} avg views</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Incident Type Revenue */}
        {data.incident_rankings.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
              <AlertCircle className="h-3 w-3" />
              Revenue by Incident Type
            </div>
            <div className="space-y-1">
              {data.incident_rankings.slice(0, 8).map(inc => (
                <div key={inc.incident_type} className="flex items-center justify-between text-xs px-2 py-1 rounded-md hover:bg-glass-highlight transition-colors">
                  <span className="text-text-primary capitalize">{inc.incident_type.replace(/_/g, ' ')}</span>
                  <div className="flex items-center gap-3 text-text-tertiary tabular-nums">
                    <span>${inc.avg_revenue.toFixed(2)} avg</span>
                    <Badge variant="default" size="sm">{inc.video_count} videos</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
