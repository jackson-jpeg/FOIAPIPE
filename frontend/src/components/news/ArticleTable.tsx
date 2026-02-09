import { ArticleRow } from './ArticleRow';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Newspaper } from 'lucide-react';

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

interface ArticleTableProps {
  articles: Article[];
  loading: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onFileFoia: (id: string) => void;
  onDismiss: (id: string) => void;
  onMarkReviewed: (id: string) => void;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  onSort: (key: string) => void;
}

export function ArticleTable({
  articles, loading, selectedIds, onToggleSelect, onToggleSelectAll,
  onFileFoia, onDismiss, onMarkReviewed, sortBy, sortDir, onSort
}: ArticleTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <EmptyState
        icon={<Newspaper className="h-12 w-12" />}
        title="No articles found"
        message="Scanner is searching for news articles. Try adjusting your filters."
      />
    );
  }

  const SortHeader = ({ label, field }: { label: string; field: string }) => (
    <th
      className="px-3 py-3 text-left text-xs font-medium text-text-tertiary uppercase tracking-wider cursor-pointer hover:text-text-secondary"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortBy === field && (
          <span className="text-accent-cyan">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>
        )}
      </div>
    </th>
  );

  const allSelected = articles.length > 0 && articles.every(a => selectedIds.has(a.id));

  return (
    <div className="overflow-x-auto rounded-lg border border-surface-border">
      <table className="w-full">
        <thead className="bg-surface-tertiary">
          <tr>
            <th className="px-3 py-3 w-10">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleSelectAll}
                className="h-4 w-4 rounded border-surface-border bg-surface-tertiary accent-accent-cyan"
              />
            </th>
            <SortHeader label="Sev" field="severity_score" />
            <SortHeader label="Headline" field="headline" />
            <th className="px-3 py-3 text-left text-xs font-medium text-text-tertiary uppercase">Source</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-text-tertiary uppercase">Agency</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-text-tertiary uppercase">Type</th>
            <SortHeader label="Published" field="published_at" />
            <th className="px-3 py-3 text-left text-xs font-medium text-text-tertiary uppercase">Status</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-text-tertiary uppercase w-24">Actions</th>
          </tr>
        </thead>
        <tbody>
          {articles.map((article) => (
            <ArticleRow
              key={article.id}
              article={article}
              selected={selectedIds.has(article.id)}
              onToggleSelect={() => onToggleSelect(article.id)}
              onFileFoia={onFileFoia}
              onDismiss={onDismiss}
              onMarkReviewed={onMarkReviewed}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
