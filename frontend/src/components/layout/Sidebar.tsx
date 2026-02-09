import { NavLink } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { NAV_ITEMS } from '@/lib/constants';
import { useBreakpoint } from '@/hooks/useMediaQuery';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const { isMobile } = useBreakpoint();

  const sidebarContent = (
    <div
      className={cn(
        'flex h-full flex-col bg-white shadow-sm transition-[width] duration-200 ease-out-expo',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          'flex h-14 items-center shrink-0',
          collapsed ? 'justify-center px-2' : 'px-5'
        )}
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-1">
            <span className="text-base font-bold text-accent-primary">F</span>
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-pulse-subtle rounded-full bg-accent-primary opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-primary" />
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-pulse-subtle rounded-full bg-accent-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-primary" />
            </span>
            <span className="text-sm font-semibold text-text-primary tracking-widest">
              FOIAPIPE
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => isMobile && onMobileClose()}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-150',
                collapsed && 'justify-center px-2',
                isActive
                  ? 'bg-accent-primary-subtle text-accent-primary font-medium'
                  : 'text-text-tertiary hover:bg-surface-hover hover:text-text-primary'
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className="shrink-0" size={18} strokeWidth={1.75} />
                {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle */}
      {!isMobile && (
        <div className="p-2">
          <button
            onClick={onToggleCollapse}
            className="flex w-full items-center justify-center rounded-lg p-2 text-text-quaternary transition-colors hover:bg-surface-hover hover:text-text-primary"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <>
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm animate-fade-in"
            onClick={onMobileClose}
          />
        )}
        <aside
          className={cn(
            'fixed left-0 top-0 z-50 h-full transition-transform duration-200 ease-out-expo',
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {sidebarContent}
        </aside>
      </>
    );
  }

  return (
    <aside className="fixed left-0 top-0 z-30 h-full">
      {sidebarContent}
    </aside>
  );
}
