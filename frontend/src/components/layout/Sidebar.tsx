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
        'flex h-full flex-col bg-surface-secondary border-r border-surface-border transition-[width] duration-200 ease-out-expo',
        collapsed ? 'w-[52px]' : 'w-52'
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          'flex h-12 items-center border-b border-surface-border shrink-0',
          collapsed ? 'justify-center px-2' : 'px-4'
        )}
      >
        {collapsed ? (
          <span className="text-sm font-bold text-accent-primary">F</span>
        ) : (
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-primary" />
            <span className="text-xs font-semibold text-text-primary tracking-widest">
              FOIAPIPE
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-1.5 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => isMobile && onMobileClose()}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-sm transition-all duration-100',
                collapsed && 'justify-center px-2',
                isActive
                  ? 'bg-surface-tertiary/80 text-text-primary'
                  : 'text-text-tertiary hover:bg-surface-tertiary/40 hover:text-text-secondary'
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-r-full bg-accent-primary" />
                )}
                <item.icon className="shrink-0" size={15} strokeWidth={1.75} />
                {!collapsed && <span className="text-xs font-medium">{item.label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle */}
      {!isMobile && (
        <div className="border-t border-surface-border p-1.5">
          <button
            onClick={onToggleCollapse}
            className="flex w-full items-center justify-center rounded-lg p-1.5 text-text-quaternary transition-colors hover:bg-surface-tertiary hover:text-text-tertiary"
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
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] animate-fade-in"
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
