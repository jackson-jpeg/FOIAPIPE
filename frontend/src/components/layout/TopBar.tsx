import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Bell, CheckCheck, Search, Command } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { StatusOrb } from '@/components/ui/StatusOrb';
import { formatRelativeTime } from '@/lib/formatters';
import { useSSE } from '@/hooks/useSSE';
import {
  getNotifications,
  markAllRead,
  markRead,
  type Notification,
} from '@/api/notifications';

interface TopBarProps {
  title: string;
  onMenuToggle: () => void;
  sidebarCollapsed: boolean;
  isMobile: boolean;
}

const notificationTypeBadge: Record<string, { variant: 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'default'; label: string }> = {
  foia_submitted: { variant: 'info', label: 'FOIA' },
  foia_acknowledged: { variant: 'info', label: 'Acknowledged' },
  foia_fulfilled: { variant: 'success', label: 'Fulfilled' },
  foia_denied: { variant: 'danger', label: 'Denied' },
  foia_overdue: { variant: 'warning', label: 'Overdue' },
  scan_complete: { variant: 'purple', label: 'Scan' },
  video_uploaded: { variant: 'info', label: 'Video' },
  video_published: { variant: 'success', label: 'Published' },
  system_error: { variant: 'danger', label: 'Error' },
  revenue_milestone: { variant: 'success', label: 'Revenue' },
};

export function TopBar({ title, onMenuToggle, sidebarCollapsed, isMobile }: TopBarProps) {
  const navigate = useNavigate();
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

  const sseHandlers = useMemo(() => ({
    scan_complete: () => fetchNotifications(),
    foia_response: () => fetchNotifications(),
    foia_submitted: () => fetchNotifications(),
    video_published: () => fetchNotifications(),
    video_status_changed: () => fetchNotifications(),
    video_scheduled_publish: () => fetchNotifications(),
  }), [fetchNotifications]);
  useSSE(sseHandlers);

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

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      try {
        await markRead(notification.id);
        setNotifications((prev) =>
          prev.map((n) => n.id === notification.id ? { ...n, is_read: true } : n)
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // silently fail
      }
    }
    if (notification.link) {
      setOpen(false);
      navigate(notification.link);
    }
  };

  function getTypeBadge(type: string) {
    return notificationTypeBadge[type] ?? { variant: 'default' as const, label: type };
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-20 flex h-11 items-center justify-between glass-1 border-b border-glass-border px-6',
        !isMobile && (sidebarCollapsed ? 'ml-16' : 'ml-64')
      )}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="rounded-md p-1 text-text-quaternary transition-colors hover:text-text-secondary md:hidden"
        >
          <Menu className="h-3.5 w-3.5" />
        </button>
        <h1 className="text-2xs font-medium uppercase tracking-wider text-text-quaternary">{title}</h1>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Global Search Trigger */}
        <button
          onClick={() => {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
          }}
          className="hidden sm:flex items-center gap-1.5 rounded-md px-2 py-1 text-text-quaternary hover:text-text-tertiary transition-colors"
        >
          <Search className="h-3 w-3" />
          <kbd className="flex items-center gap-0.5 text-3xs font-mono">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </button>

        {/* Scanner status */}
        <div className="mr-0.5 hidden items-center sm:flex">
          <StatusOrb color="success" label="Scanner active" size="sm" />
        </div>

        {/* Notification Bell */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={handleToggle}
            className="relative rounded-md p-1 text-text-quaternary transition-colors hover:text-text-secondary"
          >
            <Bell className="h-3.5 w-3.5" />
            {unreadCount > 0 && (
              <span className="absolute right-0 top-0 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-accent-primary text-[7px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification Dropdown */}
          {open && (
            <div className="absolute right-0 top-full mt-1.5 w-72 rounded-lg glass-3 shadow-overlay animate-slide-down">
              <div className="flex items-center justify-between border-b glass-border px-3 py-2">
                <h3 className="text-2xs font-medium uppercase tracking-wider text-text-tertiary">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="text-3xs text-text-quaternary">
                    {unreadCount} unread
                  </span>
                )}
              </div>

              <div className="max-h-56 overflow-y-auto">
                {loading && notifications.length === 0 ? (
                  <div className="space-y-2 p-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="h-3 w-8 rounded shimmer" />
                        <div className="flex-1 space-y-1">
                          <div className="h-2.5 w-full rounded shimmer" />
                          <div className="h-2 w-12 rounded shimmer" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6">
                    <Bell className="mb-1 h-3.5 w-3.5 text-text-quaternary" />
                    <p className="text-3xs text-text-quaternary">No notifications</p>
                  </div>
                ) : (
                  <div>
                    {notifications.map((notification) => {
                      const typeBadge = getTypeBadge(notification.type);
                      return (
                        <div
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className={cn(
                            'flex items-start gap-2 px-3 py-2 transition-colors hover:bg-glass-highlight',
                            !notification.is_read && 'bg-accent-primary-subtle',
                            notification.link && 'cursor-pointer'
                          )}
                        >
                          <Badge variant={typeBadge.variant} size="sm">
                            {typeBadge.label}
                          </Badge>
                          <div className="min-w-0 flex-1">
                            {notification.title && (
                              <p className="text-2xs font-medium text-text-primary leading-snug">
                                {notification.title}
                              </p>
                            )}
                            <p
                              className={cn(
                                'text-3xs leading-relaxed',
                                notification.is_read
                                  ? 'text-text-tertiary'
                                  : 'text-text-secondary'
                              )}
                            >
                              {notification.message}
                            </p>
                            <p className="mt-0.5 text-3xs text-text-quaternary">
                              {formatRelativeTime(notification.created_at)}
                            </p>
                          </div>
                          {!notification.is_read && (
                            <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-accent-primary" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border-t glass-border px-2 py-1.5 space-y-0.5">
                {notifications.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMarkAllRead}
                    icon={<CheckCheck className="h-3 w-3" />}
                    className="w-full"
                    disabled={unreadCount === 0}
                  >
                    Mark all read
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setOpen(false); navigate('/notifications'); }}
                  className="w-full text-accent-primary"
                >
                  View all notifications
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
