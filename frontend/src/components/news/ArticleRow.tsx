import { useState } from 'react';
import { SeverityDot } from './SeverityDot';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDateTime } from '@/lib/formatters';
import { INCIDENT_TYPES } from '@/lib/constants';
import { ChevronDown, ChevronRight, ExternalLink, FileText, X } from 'lucide-react';

interface Article {
  id: string;
  headline: string;
  source: string;
  url: string;
  summary: string | null;
  body: string | null;
  published_at: string | null;
  incident_type: string | null;
  severity_score: number | null;
  detected_agency: string | null;
  is_reviewed: boolean;
  is_dismissed: boolean;
  auto_foia_eligible: boolean;
  auto_foia_filed: boolean;
}

interface ArticleRowProps {
  article: Article;
  selected: boolean;
  onToggleSelect: () => void;
  onFileFoia: (id: string) => void;
  onDismiss: (id: string) => void;
  onMarkReviewed: (id: string) => void;
}

export function ArticleRow({ article, selected, onToggleSelect, onFileFoia, onDismiss, onMarkReviewed }: ArticleRowProps) {
  const [expanded, setExpanded] = useState(false);
  const incidentInfo = article.incident_type
    ? INCIDENT_TYPES[article.incident_type as keyof typeof INCIDENT_TYPES]
    : null;

  return (
    <>
      <tr
        className="border-b border-surface-border hover:bg-surface-tertiary/50 cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className="h-4 w-4 rounded border-surface-border bg-surface-tertiary accent-accent-cyan"
          />
        </td>
        <td className="px-3 py-3">
          <SeverityDot score={article.severity_score ?? 0} />
        </td>
        <td className="px-3 py-3 max-w-md">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown className="h-4 w-4 text-text-tertiary flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-text-tertiary flex-shrink-0" />}
            <span className="text-sm text-text-primary truncate">{article.headline}</span>
          </div>
        </td>
        <td className="px-3 py-3 text-sm text-text-secondary">{article.source}</td>
        <td className="px-3 py-3 text-sm text-text-secondary">{article.detected_agency || '\u2014'}</td>
        <td className="px-3 py-3">
          {incidentInfo && (
            <Badge variant={incidentInfo.variant as 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'default'} size="sm">
              {incidentInfo.label}
            </Badge>
          )}
        </td>
        <td className="px-3 py-3 text-sm text-text-secondary font-mono">
          {article.published_at ? formatDateTime(article.published_at) : '\u2014'}
        </td>
        <td className="px-3 py-3">
          <div className="flex items-center gap-1">
            {article.is_reviewed && <Badge variant="success" size="sm">Reviewed</Badge>}
            {article.is_dismissed && <Badge variant="default" size="sm">Dismissed</Badge>}
            {article.auto_foia_filed && <Badge variant="info" size="sm">FOIA Filed</Badge>}
            {article.auto_foia_eligible && !article.auto_foia_filed && <Badge variant="purple" size="sm">Eligible</Badge>}
          </div>
        </td>
        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            {!article.auto_foia_filed && !article.is_dismissed && (
              <Button variant="primary" size="sm" onClick={() => onFileFoia(article.id)}>
                <FileText className="h-3.5 w-3.5" />
              </Button>
            )}
            {!article.is_dismissed && (
              <Button variant="ghost" size="sm" onClick={() => onDismiss(article.id)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-surface-border bg-surface-tertiary/30">
          <td colSpan={9} className="px-6 py-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-text-primary font-medium">{article.headline}</p>
                  <div className="flex items-center gap-3 text-xs text-text-tertiary">
                    <span>{article.source}</span>
                    {article.detected_agency && <span>Agency: {article.detected_agency}</span>}
                    <SeverityDot score={article.severity_score ?? 0} size="sm" showLabel />
                  </div>
                </div>
                <a href={article.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-accent-cyan hover:underline">
                  Original Article <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              {(article.body || article.summary) && (
                <p className="text-sm text-text-secondary leading-relaxed max-h-40 overflow-y-auto">
                  {article.body || article.summary}
                </p>
              )}
              <div className="flex items-center gap-2 pt-2">
                {!article.is_reviewed && (
                  <Button variant="outline" size="sm" onClick={() => onMarkReviewed(article.id)}>Mark Reviewed</Button>
                )}
                {!article.auto_foia_filed && !article.is_dismissed && (
                  <Button variant="primary" size="sm" onClick={() => onFileFoia(article.id)}>File FOIA Request</Button>
                )}
                {!article.is_dismissed && (
                  <Button variant="ghost" size="sm" onClick={() => onDismiss(article.id)}>Dismiss</Button>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
