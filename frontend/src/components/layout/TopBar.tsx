import { useState, useEffect, useRef, useCallback } from 'react';
import { Menu, Bell, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { StatusOrb } from '@/components/ui/StatusOrb';
import { formatRelativeTime } from '@/lib/formatters';
import {
  getNotifications,
  markAllRead,
  type Notification,
} from '@/api/notifications';

interface TopBarProps {
  title: string;
  onMenuToggle: () => void;
  sidebarCollapsed: boolean;
  isMobile: boolean;
}

const notificationTypeBadge: Record<string, { variant: 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'default'; label: string }> = {
  foia_filed: { variant: 'info', label: 'FOIA' },
  foia_response: { variant: 'success', label: 'Response' },
  scan_complete: { variant: 'purple', label: 'Scan' },
  error: { variant: 'danger', label: 'Error' },
  warning: { variant: 'warning', label: 'Warning' },
  info: { variant: 'info', label: 'Info' },
};

export function TopBar({ title, onMenuToggle, sidebarCollapsed, isMobile }: TopBarProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getNotifications({ page_size: 10 });
      setNotifications(data.items ?? []);
      setUnreadCount(data.unread_count ?? 0);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleToggle = () => {
    if (!open) {
      fetchNotifications();
    }
    setOpen(!open);
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true }))
      );
      setUnreadCount(0);
    } catch {
      // silently fail
    }
  };

  function getTypeBadge(type: string) {
    return notificationTypeBadge[type] ?? { variant: 'default' as const, label: type };
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-20 flex h-14 items-center justify-between bg-white shadow-sm px-6',
        !isMobile && (sidebarCollapsed ? 'ml-16' : 'ml-64')
      )}
    >
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary md:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>
        <h1 className="text-sm font-medium text-text-secondary">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Scanner status with StatusOrb */}
        <div className="mr-1 hidden items-center sm:flex">
          <StatusOrb color="success" label="Scanner active" size="sm" />
        </div>

        {/* Notification Bell */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={handleToggle}
            className="relative rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            <Bell className="h-3.5 w-3.5" />
            {unreadCount > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-accent-primary text-[8px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification Dropdown */}
          {open && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-xl bg-white shadow-overlay animate-slide-down">
              <div className="flex items-center justify-between border-b border-surface-border/30 px-6 py-4">
                <h3 className="text-sm font-semibold text-text-primary">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="text-xs text-text-tertiary">
                    {unreadCount} unread
                  </span>
                )}
              </div>

              <div className="max-h-64 overflow-y-auto">
                {loading && notifications.length === 0 ? (
                  <div className="space-y-3 p-3.5">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <div className="h-3.5 w-10 rounded shimmer bg-surface-tertiary/60" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3 w-full rounded shimmer bg-surface-tertiary/60" />
                          <div className="h-2.5 w-14 rounded shimmer bg-surface-tertiary/60" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Bell className="mb-1.5 h-4 w-4 text-text-quaternary" />
                    <p className="text-2xs text-text-quaternary">No notifications</p>
                  </div>
                ) : (
                  <div>
                    {notifications.map((notification) => {
                      const typeBadge = getTypeBadge(notification.type);
                      return (
                        <div
                          key={notification.id}
                          className={cn(
                            'flex items-start gap-2 px-3.5 py-2.5 transition-colors hover:bg-surface-hover',
                            !notification.is_read && 'bg-accent-primary-subtle'
                          )}
                        >
                          <Badge variant={typeBadge.variant} size="sm">
                            {typeBadge.label}
                          </Badge>
                          <div className="min-w-0 flex-1">
                            <p
                              className={cn(
                                'text-2xs leading-relaxed',
                                notification.is_read
                                  ? 'text-text-secondary'
                                  : 'font-medium text-text-primary'
                              )}
                            >
                              {notification.message}
                            </p>
                            <p className="mt-0.5 text-2xs text-text-quaternary">
                              {formatRelativeTime(notification.created_at)}
                            </p>
                          </div>
                          {!notification.is_read && (
                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-primary" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {notifications.length > 0 && (
                <div className="border-t border-surface-border/30 px-3 py-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMarkAllRead}
                    icon={<CheckCheck className="h-3.5 w-3.5" />}
                    className="w-full"
                    disabled={unreadCount === 0}
                  >
                    Mark all read
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
