import { useState, useEffect, useRef, useCallback } from 'react';
import { Menu, Bell, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
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

  // Fetch notifications on mount and periodically
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close dropdown on click outside
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
        'sticky top-0 z-20 flex h-16 items-center justify-between border-b border-surface-border bg-surface-primary/80 backdrop-blur-md px-6',
        !isMobile && (sidebarCollapsed ? 'ml-16' : 'ml-60')
      )}
    >
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="rounded-lg p-2 text-text-tertiary transition-colors hover:bg-surface-tertiary hover:text-text-primary md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold text-text-primary">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <div className="mr-3 hidden items-center gap-2 sm:flex">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-green opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-green" />
          </span>
          <span className="text-xs text-text-tertiary">Scanner Active</span>
        </div>

        {/* Notification Bell */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={handleToggle}
            className="relative rounded-lg p-2 text-text-tertiary transition-colors hover:bg-surface-tertiary hover:text-text-primary"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent-cyan text-[10px] font-bold text-surface-primary">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification Dropdown */}
          {open && (
            <div className="absolute right-0 top-full mt-2 w-96 rounded-xl border border-surface-border bg-surface-secondary shadow-xl">
              <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
                <h3 className="text-sm font-semibold text-text-primary">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-accent-cyan/10 px-2 py-0.5 text-xs font-medium text-accent-cyan">
                    {unreadCount} unread
                  </span>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto">
                {loading && notifications.length === 0 ? (
                  <div className="space-y-3 p-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="h-5 w-12 animate-pulse rounded-full bg-surface-tertiary" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3 w-full animate-pulse rounded bg-surface-tertiary" />
                          <div className="h-2.5 w-16 animate-pulse rounded bg-surface-tertiary" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10">
                    <Bell className="mb-2 h-8 w-8 text-text-tertiary" />
                    <p className="text-sm text-text-tertiary">No notifications</p>
                  </div>
                ) : (
                  <div>
                    {notifications.map((notification) => {
                      const typeBadge = getTypeBadge(notification.type);
                      return (
                        <div
                          key={notification.id}
                          className={cn(
                            'flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-tertiary',
                            !notification.is_read && 'bg-accent-cyan/5'
                          )}
                        >
                          <Badge variant={typeBadge.variant} size="sm">
                            {typeBadge.label}
                          </Badge>
                          <div className="min-w-0 flex-1">
                            <p
                              className={cn(
                                'text-sm',
                                notification.is_read
                                  ? 'text-text-secondary'
                                  : 'font-medium text-text-primary'
                              )}
                            >
                              {notification.message}
                            </p>
                            <p className="mt-0.5 text-xs text-text-tertiary">
                              {formatRelativeTime(notification.created_at)}
                            </p>
                          </div>
                          {!notification.is_read && (
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent-cyan" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {notifications.length > 0 && (
                <div className="border-t border-surface-border px-4 py-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMarkAllRead}
                    icon={<CheckCheck className="h-3.5 w-3.5" />}
                    className="w-full"
                    disabled={unreadCount === 0}
                  >
                    Mark all as read
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
