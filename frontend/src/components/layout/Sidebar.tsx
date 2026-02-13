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
        'flex h-full flex-col glass-1 border-r border-glass-border transition-[width] duration-150 ease-out-expo',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          'flex h-11 items-center shrink-0',
          collapsed ? 'justify-center px-2' : 'px-5'
        )}
      >
        {collapsed ? (
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xs font-bold text-accent-primary tracking-[0.25em]">FA</span>
            <span className="h-1.5 w-1.5 rounded-full bg-accent-primary" />
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-primary" />
            <span className="text-3xs font-semibold text-text-primary tracking-[0.25em]">
              FOIA ARCHIVE
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => isMobile && onMobileClose()}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 rounded-md px-2.5 py-1.5 transition-colors duration-150',
                collapsed && 'justify-center px-2',
                isActive
                  ? 'text-text-primary border-l-2 border-accent-primary pl-2'
                  : 'text-text-quaternary hover:text-text-secondary'
              )
            }
          >
            <>
              <item.icon className="shrink-0" size={16} strokeWidth={1.75} />
              {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
            </>
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle */}
      {!isMobile && (
        <div className="p-2">
          <button
            onClick={onToggleCollapse}
            className="flex w-full items-center justify-center rounded-md p-1.5 text-text-quaternary transition-colors hover:text-text-secondary"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronLeft className="h-3.5 w-3.5" />
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
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[6px] animate-fade-in"
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
