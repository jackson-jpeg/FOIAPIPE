import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  FileText,
  Newspaper,
  Video,
  Plus,
  Play,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/cn';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
  category: 'create' | 'navigate' | 'action';
}

export function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Quick actions for common tasks
  const quickActions: QuickAction[] = [
    {
      id: 'new-foia',
      label: 'Create new FOIA request',
      icon: <Plus className="h-4 w-4" />,
      action: () => {
        navigate('/foia/editor/new');
        onClose();
      },
      category: 'create',
    },
    {
      id: 'scan-news',
      label: 'Scan news articles',
      icon: <Play className="h-4 w-4" />,
      action: () => {
        navigate('/news-scanner');
        onClose();
        // Trigger scan action
      },
      category: 'action',
    },
    {
      id: 'go-dashboard',
      label: 'Go to Dashboard',
      icon: <ArrowRight className="h-4 w-4" />,
      action: () => {
        navigate('/');
        onClose();
      },
      category: 'navigate',
    },
    {
      id: 'go-news',
      label: 'Go to News Scanner',
      icon: <Newspaper className="h-4 w-4" />,
      action: () => {
        navigate('/news-scanner');
        onClose();
      },
      category: 'navigate',
    },
    {
      id: 'go-foia',
      label: 'Go to FOIA Tracker',
      icon: <FileText className="h-4 w-4" />,
      action: () => {
        navigate('/foia-tracker');
        onClose();
      },
      category: 'navigate',
    },
    {
      id: 'go-videos',
      label: 'Go to Video Pipeline',
      icon: <Video className="h-4 w-4" />,
      action: () => {
        navigate('/video-pipeline');
        onClose();
      },
      category: 'navigate',
    },
  ];

  const filteredActions = query
    ? quickActions.filter((action) =>
        action.label.toLowerCase().includes(query.toLowerCase())
      )
    : quickActions;

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => inputRef.current?.focus(), 0);
      setQuery('');
      setSelectedIndex(0);
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredActions.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredActions[selectedIndex]) {
          filteredActions[selectedIndex].action();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, filteredActions, selectedIndex]);

  // Reset selected index when filtered actions change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  const categoryLabels = {
    create: 'Create',
    navigate: 'Navigate',
    action: 'Actions',
  };

  // Group actions by category
  const groupedActions = filteredActions.reduce((acc, action) => {
    if (!acc[action.category]) {
      acc[action.category] = [];
    }
    acc[action.category].push(action);
    return acc;
  }, {} as Record<string, QuickAction[]>);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh] px-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px]" />
      <div className="relative w-full max-w-2xl rounded-xl border border-surface-border bg-surface-secondary shadow-overlay animate-scale-in">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-border">
          <Search className="h-4 w-4 shrink-0 text-text-tertiary" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or type a command..."
            className="w-full bg-transparent text-base text-text-primary placeholder:text-text-quaternary outline-none"
          />
          <kbd className="shrink-0 rounded border border-surface-border bg-surface-tertiary px-2 py-1 text-xs text-text-quaternary font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {filteredActions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Search className="h-8 w-8 text-text-quaternary mb-3" />
              <p className="text-sm text-text-secondary">No results found</p>
              <p className="text-xs text-text-tertiary mt-1">
                Try a different search term
              </p>
            </div>
          ) : (
            <div className="py-2">
              {Object.entries(groupedActions).map(([category, actions]) => (
                <div key={category} className="mb-2 last:mb-0">
                  <div className="px-5 py-2">
                    <h3 className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
                      {categoryLabels[category as keyof typeof categoryLabels]}
                    </h3>
                  </div>
                  <div className="px-2">
                    {actions.map((action) => {
                      const globalIndex = filteredActions.indexOf(action);
                      const isSelected = globalIndex === selectedIndex;

                      return (
                        <button
                          key={action.id}
                          onClick={action.action}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left',
                            isSelected
                              ? 'bg-surface-tertiary text-text-primary'
                              : 'text-text-secondary hover:bg-surface-tertiary/50'
                          )}
                        >
                          <div
                            className={cn(
                              'shrink-0 transition-colors',
                              isSelected ? 'text-accent-primary' : 'text-text-tertiary'
                            )}
                          >
                            {action.icon}
                          </div>
                          <span className="flex-1 text-sm font-medium">
                            {action.label}
                          </span>
                          {action.shortcut && (
                            <kbd className="shrink-0 rounded border border-surface-border bg-surface-tertiary px-1.5 py-0.5 text-xs text-text-quaternary font-mono">
                              {action.shortcut}
                            </kbd>
                          )}
                          {isSelected && (
                            <ArrowRight className="h-4 w-4 text-text-tertiary" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer with keyboard hints */}
        <div className="flex items-center justify-between gap-4 px-5 py-3 border-t border-surface-border bg-surface-tertiary/30">
          <div className="flex items-center gap-3 text-xs text-text-tertiary">
            <div className="flex items-center gap-1">
              <kbd className="rounded border border-surface-border bg-surface-tertiary px-1.5 py-0.5 font-mono">
                ↑↓
              </kbd>
              <span>Navigate</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="rounded border border-surface-border bg-surface-tertiary px-1.5 py-0.5 font-mono">
                ↵
              </kbd>
              <span>Open</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="rounded border border-surface-border bg-surface-tertiary px-1.5 py-0.5 font-mono">
                ESC
              </kbd>
              <span>Close</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
