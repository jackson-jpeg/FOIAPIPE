import { ArticleRow } from './ArticleRow';
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
  detected_officers: string[] | null;
  detected_location: string | null;
  is_reviewed: boolean;
  is_dismissed: boolean;
  auto_foia_eligible: boolean;
  auto_foia_filed: boolean;
  predicted_revenue?: number | null;
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
  onPrioritize?: (id: string) => void;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  onSort: (key: string) => void;
}

export function ArticleTable({
  articles, loading, selectedIds, onToggleSelect, onToggleSelectAll,
  onFileFoia, onDismiss, onMarkReviewed, onPrioritize, sortBy, sortDir, onSort
}: ArticleTableProps) {
  if (loading) {
    return (
      <div className="overflow-x-auto rounded-lg glass-2">
        <table className="w-full">
          <thead>
            <tr>
              <th className="px-3 py-1.5 w-10"></th>
              <th className="px-3 py-1.5 text-left text-3xs font-medium uppercase tracking-widest text-text-quaternary">Sev</th>
              <th className="px-3 py-1.5 text-left text-3xs font-medium uppercase tracking-widest text-text-quaternary">Headline</th>
              <th className="px-3 py-1.5 text-left text-3xs font-medium uppercase tracking-widest text-text-quaternary hidden sm:table-cell">Source</th>
              <th className="px-3 py-1.5 text-left text-3xs font-medium uppercase tracking-widest text-text-quaternary hidden md:table-cell">Agency</th>
              <th className="px-3 py-1.5 text-left text-3xs font-medium uppercase tracking-widest text-text-quaternary hidden lg:table-cell">Type</th>
              <th className="px-3 py-1.5 text-left text-3xs font-medium uppercase tracking-widest text-text-quaternary">Published</th>
              <th className="px-3 py-1.5 text-left text-3xs font-medium uppercase tracking-widest text-text-quaternary hidden sm:table-cell">Status</th>
              <th className="px-3 py-1.5 text-left text-3xs font-medium uppercase tracking-widest text-text-quaternary w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-t border-glass-border">
                <td className="px-3 py-1.5"><div className="shimmer h-3 w-3 rounded" /></td>
                <td className="px-3 py-1.5"><div className="shimmer h-2 w-2 rounded-full" /></td>
                <td className="px-3 py-1.5"><div className="shimmer h-3 w-3/4 rounded" /></td>
                <td className="px-3 py-1.5 hidden sm:table-cell"><div className="shimmer h-3 w-20 rounded" /></td>
                <td className="px-3 py-1.5 hidden md:table-cell"><div className="shimmer h-3 w-24 rounded" /></td>
                <td className="px-3 py-1.5 hidden lg:table-cell"><div className="shimmer h-4 w-16 rounded-full" /></td>
                <td className="px-3 py-1.5"><div className="shimmer h-3 w-28 rounded" /></td>
                <td className="px-3 py-1.5 hidden sm:table-cell"><div className="shimmer h-4 w-20 rounded-full" /></td>
                <td className="px-3 py-1.5"><div className="flex gap-1"><div className="shimmer h-7 w-7 rounded" /><div className="shimmer h-7 w-7 rounded" /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <EmptyState
        icon={<Newspaper className="h-10 w-10" />}
        title="No articles found"
        message="Scanner is searching for news articles. Try adjusting your filters."
      />
    );
  }

  const SortHeader = ({ label, field }: { label: string; field: string }) => (
    <th
      className="px-3 py-1.5 text-left text-3xs font-medium uppercase tracking-widest text-text-quaternary cursor-pointer transition-colors hover:text-text-secondary"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortBy === field && (
          <span className="text-accent-primary">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>
        )}
      </div>
    </th>
  );

  const allSelected = articles.length > 0 && articles.every(a => selectedIds.has(a.id));

  return (
    <div className="overflow-x-auto rounded-lg glass-2">
      <table className="w-full">
        <thead>
          <tr>
            <th className="px-3 py-1.5 w-10">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleSelectAll}
              />
            </th>
            <SortHeader label="Sev" field="severity_score" />
            <SortHeader label="Headline" field="headline" />
            <th className="px-3 py-1.5 text-left text-3xs font-medium uppercase tracking-widest text-text-quaternary hidden sm:table-cell">Source</th>
            <th className="px-3 py-1.5 text-left text-3xs font-medium uppercase tracking-widest text-text-quaternary hidden md:table-cell">Agency</th>
            <th className="px-3 py-1.5 text-left text-3xs font-medium uppercase tracking-widest text-text-quaternary hidden lg:table-cell">Type</th>
            <SortHeader label="Published" field="published_at" />
            <th className="px-3 py-1.5 text-left text-3xs font-medium uppercase tracking-widest text-text-quaternary hidden sm:table-cell">Status</th>
            <th className="px-3 py-1.5 text-left text-3xs font-medium uppercase tracking-widest text-text-quaternary w-20">Actions</th>
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
              onPrioritize={onPrioritize}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
