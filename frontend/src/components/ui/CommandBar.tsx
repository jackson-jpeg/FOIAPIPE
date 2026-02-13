import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Newspaper,
  FileText,
  Video,
  BarChart3,
  Settings,
  Plus,
  RefreshCw,
  Search,
  Command,
  Building2,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { globalSearch, type SearchResults } from '@/api/search';

interface CommandItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
  category: string;
}

export function CommandBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResults['results'] | null>(null);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const navigate = useNavigate();

  const close = () => {
    setIsOpen(false);
    setSearch('');
    setSelectedIndex(0);
    setSearchResults(null);
  };

  const commands: CommandItem[] = [
    {
      id: 'nav-dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="h-4 w-4" />,
      category: 'Navigation',
      onSelect: () => { navigate('/'); close(); },
    },
    {
      id: 'nav-news',
      label: 'News Scanner',
      icon: <Newspaper className="h-4 w-4" />,
      category: 'Navigation',
      onSelect: () => { navigate('/news'); close(); },
    },
    {
      id: 'nav-foia',
      label: 'FOIA Requests',
      icon: <FileText className="h-4 w-4" />,
      category: 'Navigation',
      onSelect: () => { navigate('/foia'); close(); },
    },
    {
      id: 'nav-videos',
      label: 'Videos',
      icon: <Video className="h-4 w-4" />,
      category: 'Navigation',
      onSelect: () => { navigate('/videos'); close(); },
    },
    {
      id: 'nav-analytics',
      label: 'Analytics',
      icon: <BarChart3 className="h-4 w-4" />,
      category: 'Navigation',
      onSelect: () => { navigate('/analytics'); close(); },
    },
    {
      id: 'action-new-foia',
      label: 'New FOIA Request',
      icon: <Plus className="h-4 w-4" />,
      category: 'Actions',
      onSelect: () => { navigate('/foia/editor'); close(); },
    },
    {
      id: 'action-scan-news',
      label: 'Scan News Now',
      icon: <RefreshCw className="h-4 w-4" />,
      category: 'Actions',
      onSelect: () => { close(); },
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="h-4 w-4" />,
      category: 'Settings',
      onSelect: () => { navigate('/settings'); close(); },
    },
  ];

  // Build combined items: search results (if query >= 2 chars) + filtered commands
  const buildItems = (): CommandItem[] => {
    const items: CommandItem[] = [];

    if (searchResults && search.length >= 2) {
      // FOIA results
      for (const r of searchResults.foia) {
        items.push({
          id: `search-foia-${r.id}`,
          label: `${r.case_number} (${r.status})`,
          icon: <FileText className="h-4 w-4" />,
          category: 'FOIA Requests',
          onSelect: () => { navigate(`/foia`); close(); },
        });
      }
      // Article results
      for (const r of searchResults.articles) {
        items.push({
          id: `search-article-${r.id}`,
          label: r.headline,
          icon: <Newspaper className="h-4 w-4" />,
          category: 'Articles',
          onSelect: () => { navigate('/news'); close(); },
        });
      }
      // Video results
      for (const r of searchResults.videos) {
        items.push({
          id: `search-video-${r.id}`,
          label: r.title || 'Untitled Video',
          icon: <Video className="h-4 w-4" />,
          category: 'Videos',
          onSelect: () => { navigate('/videos'); close(); },
        });
      }
      // Agency results
      for (const r of searchResults.agencies) {
        items.push({
          id: `search-agency-${r.id}`,
          label: r.name,
          icon: <Building2 className="h-4 w-4" />,
          category: 'Agencies',
          onSelect: () => { navigate('/agencies'); close(); },
        });
      }
    }

    // Always include filtered commands
    const filtered = commands.filter(cmd =>
      !search || cmd.label.toLowerCase().includes(search.toLowerCase()) ||
      cmd.category.toLowerCase().includes(search.toLowerCase())
    );
    items.push(...filtered);

    return items;
  };

  const allItems = buildItems();

  // Debounced search
  useEffect(() => {
    if (search.length < 2) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await globalSearch(search);
        setSearchResults(data.results);
      } catch {
        setSearchResults(null);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setIsOpen(prev => {
        if (prev) {
          close();
          return false;
        }
        return true;
      });
    }

    if (e.key === 'Escape') {
      close();
    }

    if (isOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < allItems.length - 1 ? prev + 1 : prev
        );
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
      }
      if (e.key === 'Enter' && allItems[selectedIndex]) {
        e.preventDefault();
        allItems[selectedIndex].onSelect();
      }
    }
  }, [isOpen, allItems, selectedIndex]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search, searchResults]);

  if (!isOpen) return null;

  // Group items by category
  const grouped = allItems.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-fade-in"
        onClick={close}
      />

      {/* Command Bar */}
      <div className="fixed inset-x-0 top-0 pt-[20vh] px-4 z-50 pointer-events-none">
        <div className="max-w-xl mx-auto pointer-events-auto animate-slide-down">
          <div className="bg-surface-secondary rounded-xl shadow-overlay border border-surface-border overflow-hidden">
            {/* Search Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border">
              {searching ? (
                <Loader2 className="h-4 w-4 text-text-tertiary animate-spin" />
              ) : (
                <Search className="h-4 w-4 text-text-tertiary" />
              )}
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search commands and data..."
                className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-quaternary outline-none"
                autoFocus
              />
              <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded bg-surface-tertiary text-2xs text-text-tertiary font-mono">
                ESC
              </kbd>
            </div>

            {/* Results List */}
            <div className="max-h-[400px] overflow-y-auto">
              {allItems.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-text-tertiary">
                  No results found
                </div>
              ) : (
                Object.entries(grouped).map(([category, items]) => (
                  <div key={category}>
                    <div className="px-4 py-2 text-2xs font-medium text-text-tertiary uppercase tracking-wider">
                      {category}
                    </div>
                    {items.map((cmd) => {
                      const globalIndex = allItems.findIndex(c => c.id === cmd.id);
                      return (
                        <button
                          key={cmd.id}
                          onClick={cmd.onSelect}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                          className={cn(
                            'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                            globalIndex === selectedIndex
                              ? 'bg-accent-primary-subtle text-text-primary'
                              : 'text-text-secondary hover:bg-surface-hover'
                          )}
                        >
                          <span className={cn(
                            'flex items-center justify-center w-8 h-8 rounded-lg transition-colors flex-shrink-0',
                            globalIndex === selectedIndex
                              ? 'bg-accent-primary text-white'
                              : 'bg-surface-tertiary text-text-tertiary'
                          )}>
                            {cmd.icon}
                          </span>
                          <span className="text-sm font-medium truncate">{cmd.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer Hint */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-surface-border bg-surface-tertiary/30">
              <div className="flex items-center gap-4 text-2xs text-text-tertiary">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-surface-primary border border-surface-border font-mono">
                    </kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-surface-primary border border-surface-border font-mono">

                  </kbd>
                  Select
                </span>
              </div>
              <div className="flex items-center gap-2 text-2xs text-text-tertiary">
                {search.length >= 2 && (
                  <button
                    onClick={() => { navigate(`/search?q=${encodeURIComponent(search)}`); close(); }}
                    className="text-accent-primary hover:underline mr-2"
                  >
                    View all results
                  </button>
                )}
                <Command className="h-3 w-3" />
                <span className="font-mono">K</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
