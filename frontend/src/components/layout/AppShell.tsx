import { useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { useBreakpoint } from '@/hooks/useMediaQuery';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
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
  const pageTitle = currentNav?.label ?? 'FOIAPIPE';

  return (
    <div className="min-h-screen bg-surface-primary">
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
          'px-6 py-5 transition-all duration-200 ease-out-expo',
          !isMobile && (sidebarCollapsed ? 'ml-[52px]' : 'ml-52')
        )}
      >
        <div className="animate-fade-in-fast">
          {children}
        </div>
      </main>
    </div>
  );
}
