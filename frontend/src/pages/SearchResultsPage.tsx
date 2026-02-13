import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, FileText, Newspaper, Video, Building2, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/cn';
import { globalSearch, type SearchResults } from '@/api/search';

type Category = 'all' | 'articles' | 'foia' | 'videos' | 'agencies';

export function SearchResultsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';
  const [inputValue, setInputValue] = useState(query);
  const [results, setResults] = useState<SearchResults['results'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Category>('all');

  useEffect(() => {
    setInputValue(query);
    if (query.length >= 2) {
      setLoading(true);
      globalSearch(query)
        .then((data) => setResults(data.results))
        .catch(() => setResults(null))
        .finally(() => setLoading(false));
    } else {
      setResults(null);
    }
  }, [query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      setSearchParams({ q: inputValue.trim() });
    }
  };

  const totalCount = results
    ? results.articles.length + results.foia.length + results.videos.length + results.agencies.length
    : 0;

  const tabs: { key: Category; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: totalCount },
    { key: 'articles', label: 'Articles', count: results?.articles.length || 0 },
    { key: 'foia', label: 'FOIAs', count: results?.foia.length || 0 },
    { key: 'videos', label: 'Videos', count: results?.videos.length || 0 },
    { key: 'agencies', label: 'Agencies', count: results?.agencies.length || 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="heading-3 mb-2">Search</h1>
        <form onSubmit={handleSearch} className="max-w-xl">
          <Input
            icon={<Search className="h-4 w-4" />}
            placeholder="Search articles, FOIAs, videos, agencies..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
        </form>
      </div>

      {query && (
        <>
          {/* Category Tabs */}
          <div className="flex items-center gap-1 border-b border-surface-border">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                  activeTab === tab.key
                    ? 'border-accent-primary text-accent-primary'
                    : 'border-transparent text-text-tertiary hover:text-text-secondary hover:border-surface-border-light'
                )}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className="ml-1.5 text-2xs tabular-nums text-text-quaternary">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 text-text-tertiary animate-spin" />
            </div>
          ) : totalCount === 0 ? (
            <EmptyState
              icon={Search}
              title="No results found"
              message={`No matches for "${query}". Try a different search term.`}
            />
          ) : (
            <div className="space-y-4">
              {/* Articles */}
              {(activeTab === 'all' || activeTab === 'articles') && results?.articles && results.articles.length > 0 && (
                <Card title={`Articles (${results.articles.length})`}>
                  <div className="space-y-1">
                    {results.articles.map((article) => (
                      <button
                        key={article.id}
                        onClick={() => navigate('/news')}
                        className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 -mx-3 hover:bg-surface-hover transition-colors text-left"
                      >
                        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-blue-500/10 text-blue-400 flex-shrink-0">
                          <Newspaper className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-text-primary truncate">{article.headline}</p>
                          <p className="text-2xs text-text-quaternary">{article.source}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </Card>
              )}

              {/* FOIA Requests */}
              {(activeTab === 'all' || activeTab === 'foia') && results?.foia && results.foia.length > 0 && (
                <Card title={`FOIA Requests (${results.foia.length})`}>
                  <div className="space-y-1">
                    {results.foia.map((foia) => (
                      <button
                        key={foia.id}
                        onClick={() => navigate('/foia')}
                        className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 -mx-3 hover:bg-surface-hover transition-colors text-left"
                      >
                        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-purple-500/10 text-purple-400 flex-shrink-0">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-text-primary">{foia.case_number}</p>
                        </div>
                        <Badge variant={foia.status === 'fulfilled' ? 'success' : foia.status === 'denied' ? 'danger' : 'default'} size="sm">
                          {foia.status}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </Card>
              )}

              {/* Videos */}
              {(activeTab === 'all' || activeTab === 'videos') && results?.videos && results.videos.length > 0 && (
                <Card title={`Videos (${results.videos.length})`}>
                  <div className="space-y-1">
                    {results.videos.map((video) => (
                      <button
                        key={video.id}
                        onClick={() => navigate('/videos')}
                        className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 -mx-3 hover:bg-surface-hover transition-colors text-left"
                      >
                        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-red-500/10 text-red-400 flex-shrink-0">
                          <Video className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-text-primary truncate">{video.title || 'Untitled Video'}</p>
                        </div>
                        <Badge variant="default" size="sm">{video.status}</Badge>
                      </button>
                    ))}
                  </div>
                </Card>
              )}

              {/* Agencies */}
              {(activeTab === 'all' || activeTab === 'agencies') && results?.agencies && results.agencies.length > 0 && (
                <Card title={`Agencies (${results.agencies.length})`}>
                  <div className="space-y-1">
                    {results.agencies.map((agency) => (
                      <button
                        key={agency.id}
                        onClick={() => navigate('/agencies')}
                        className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 -mx-3 hover:bg-surface-hover transition-colors text-left"
                      >
                        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex-shrink-0">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-text-primary">{agency.name}</p>
                          {agency.email && (
                            <p className="text-2xs text-text-quaternary">{agency.email}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
