import { useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { useBreakpoint } from '@/hooks/useMediaQuery';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { CommandBar } from '@/components/ui/CommandBar';
import { NAV_ITEMS } from '@/lib/constants';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { isMobile, isTablet } = useBreakpoint();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const sidebarCollapsed = isTablet || collapsed;

  const currentNav = NAV_ITEMS.find((item) => location.pathname.startsWith(item.path));
  const pageTitle = currentNav?.label ?? 'FOIA Archive';

  return (
    <div className="min-h-screen bg-surface-primary">
      {/* Command Bar (Cmd+K) */}
      <CommandBar />

      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <TopBar
        title={pageTitle}
        onMenuToggle={() => setMobileOpen((o) => !o)}
        sidebarCollapsed={sidebarCollapsed}
        isMobile={isMobile}
      />

      <main
        className={cn(
          'px-10 py-8 transition-all duration-200 ease-out-expo',
          !isMobile && (sidebarCollapsed ? 'ml-16' : 'ml-64')
        )}
      >
        <div className="max-w-[1800px] mx-auto animate-fade-in-fast">
          {children}
        </div>
      </main>
    </div>
  );
}
