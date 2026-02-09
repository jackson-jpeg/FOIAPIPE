import { useEffect, useState, useCallback } from 'react';
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
  Command
} from 'lucide-react';
import { cn } from '@/lib/cn';

interface CommandItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
  category: 'Navigation' | 'Actions' | 'Settings';
}

export function CommandBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();

  const commands: CommandItem[] = [
    // Navigation
    {
      id: 'nav-dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="h-4 w-4" />,
      category: 'Navigation',
      onSelect: () => {
        navigate('/');
        setIsOpen(false);
      },
    },
    {
      id: 'nav-news',
      label: 'News Scanner',
      icon: <Newspaper className="h-4 w-4" />,
      category: 'Navigation',
      onSelect: () => {
        navigate('/news');
        setIsOpen(false);
      },
    },
    {
      id: 'nav-foia',
      label: 'FOIA Requests',
      icon: <FileText className="h-4 w-4" />,
      category: 'Navigation',
      onSelect: () => {
        navigate('/foia');
        setIsOpen(false);
      },
    },
    {
      id: 'nav-videos',
      label: 'Videos',
      icon: <Video className="h-4 w-4" />,
      category: 'Navigation',
      onSelect: () => {
        navigate('/videos');
        setIsOpen(false);
      },
    },
    {
      id: 'nav-analytics',
      label: 'Analytics',
      icon: <BarChart3 className="h-4 w-4" />,
      category: 'Navigation',
      onSelect: () => {
        navigate('/analytics');
        setIsOpen(false);
      },
    },
    // Actions
    {
      id: 'action-new-foia',
      label: 'New FOIA Request',
      icon: <Plus className="h-4 w-4" />,
      category: 'Actions',
      onSelect: () => {
        navigate('/foia/editor');
        setIsOpen(false);
      },
    },
    {
      id: 'action-scan-news',
      label: 'Scan News Now',
      icon: <RefreshCw className="h-4 w-4" />,
      category: 'Actions',
      onSelect: async () => {
        // This would trigger the news scan
        setIsOpen(false);
      },
    },
    // Settings
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="h-4 w-4" />,
      category: 'Settings',
      onSelect: () => {
        navigate('/settings');
        setIsOpen(false);
      },
    },
  ];

  // Fuzzy search filter
  const filteredCommands = commands.filter(cmd =>
    cmd.label.toLowerCase().includes(search.toLowerCase()) ||
    cmd.category.toLowerCase().includes(search.toLowerCase())
  );

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Open with Cmd+K or Ctrl+K
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setIsOpen(prev => !prev);
      setSearch('');
      setSelectedIndex(0);
    }

    // Close with Escape
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearch('');
      setSelectedIndex(0);
    }

    // Navigate with arrow keys
    if (isOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < filteredCommands.length - 1 ? prev + 1 : prev
        );
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
      }
      if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
        e.preventDefault();
        filteredCommands[selectedIndex].onSelect();
      }
    }
  }, [isOpen, filteredCommands, selectedIndex]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  if (!isOpen) return null;

  // Group commands by category
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 animate-fade-in"
        onClick={() => setIsOpen(false)}
      />

      {/* Command Bar */}
      <div className="fixed inset-x-0 top-0 pt-[20vh] px-4 z-50 pointer-events-none">
        <div className="max-w-xl mx-auto pointer-events-auto animate-slide-down">
          <div className="bg-white rounded-xl shadow-overlay border border-surface-border overflow-hidden">
            {/* Search Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border">
              <Search className="h-4 w-4 text-text-tertiary" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search commands..."
                className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-quaternary outline-none"
                autoFocus
              />
              <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded bg-surface-tertiary text-2xs text-text-tertiary font-mono">
                ESC
              </kbd>
            </div>

            {/* Command List */}
            <div className="max-h-[400px] overflow-y-auto">
              {filteredCommands.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-text-tertiary">
                  No commands found
                </div>
              ) : (
                Object.entries(groupedCommands).map(([category, items]) => (
                  <div key={category}>
                    <div className="px-4 py-2 text-2xs font-medium text-text-tertiary uppercase tracking-wider">
                      {category}
                    </div>
                    {items.map((cmd) => {
                      const globalIndex = filteredCommands.findIndex(c => c.id === cmd.id);
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
                            'flex items-center justify-center w-8 h-8 rounded-lg transition-colors',
                            globalIndex === selectedIndex
                              ? 'bg-accent-primary text-white'
                              : 'bg-surface-tertiary text-text-tertiary'
                          )}>
                            {cmd.icon}
                          </span>
                          <span className="text-sm font-medium">{cmd.label}</span>
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
                  <kbd className="px-1.5 py-0.5 rounded bg-white border border-surface-border font-mono">↑↓</kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-white border border-surface-border font-mono">↵</kbd>
                  Select
                </span>
              </div>
              <div className="flex items-center gap-1 text-2xs text-text-tertiary">
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
