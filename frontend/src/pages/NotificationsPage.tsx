import { useEffect, useState, useCallback } from 'react';
import {
  Bell,
  CheckCheck,
  FileText,
  Video,
  DollarSign,
  AlertCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import { formatRelativeTime } from '@/lib/formatters';
import {
  getNotifications,
  markRead,
  markAllRead,
  type Notification,
  type NotificationListParams,
} from '@/api/notifications';

type FilterTab = 'all' | 'foia' | 'video' | 'revenue' | 'system';

const FILTER_TABS: { key: FilterTab; label: string; icon: typeof Bell }[] = [
  { key: 'all', label: 'All', icon: Bell },
  { key: 'foia', label: 'FOIA', icon: FileText },
  { key: 'video', label: 'Video', icon: Video },
  { key: 'revenue', label: 'Revenue', icon: DollarSign },
  { key: 'system', label: 'System', icon: AlertCircle },
];

const TYPE_ICONS: Record<string, typeof Bell> = {
  foia_submitted: FileText,
  foia_acknowledged: FileText,
  foia_fulfilled: FileText,
  foia_denied: FileText,
  foia_overdue: FileText,
  video_uploaded: Video,
  video_published: Video,
  revenue_milestone: DollarSign,
  scan_complete: Bell,
  system_error: AlertCircle,
};

const TYPE_COLORS: Record<string, string> = {
  foia_submitted: 'text-blue-400',
  foia_acknowledged: 'text-sky-400',
  foia_fulfilled: 'text-emerald-400',
  foia_denied: 'text-red-400',
  foia_overdue: 'text-orange-400',
  video_uploaded: 'text-purple-400',
  video_published: 'text-green-400',
  revenue_milestone: 'text-amber-400',
  scan_complete: 'text-cyan-400',
  system_error: 'text-red-400',
};

export function NotificationsPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const pageSize = 20;

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params: NotificationListParams = {
        page,
        page_size: pageSize,
        unread_only: unreadOnly,
      };
      if (filter !== 'all') {
        params.notification_type = filter;
      }
      const data = await getNotifications(params);
      setNotifications(data.items);
      setTotal(data.total);
      setUnreadCount(data.unread_count);
    } catch {
      addToast({ type: 'error', title: 'Failed to load notifications' });
    } finally {
      setLoading(false);
    }
  }, [page, filter, unreadOnly, addToast]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkRead = async (id: string) => {
    try {
      await markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      addToast({ type: 'error', title: 'Failed to mark as read' });
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      addToast({ type: 'success', title: 'All notifications marked as read' });
    } catch {
      addToast({ type: 'error', title: 'Failed to mark all as read' });
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      handleMarkRead(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="heading-3 mb-2">Notifications</h1>
          <p className="text-sm text-text-secondary">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'All caught up'}
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={handleMarkAllRead}
          icon={<CheckCheck className="h-4 w-4" />}
          disabled={unreadCount === 0}
        >
          Mark All Read
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTER_TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => { setFilter(tab.key); setPage(1); }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors',
                filter === tab.key
                  ? 'bg-accent-primary/10 text-accent-primary font-medium'
                  : 'text-text-tertiary hover:bg-surface-hover hover:text-text-secondary'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
        <div className="ml-auto">
          <button
            onClick={() => { setUnreadOnly(!unreadOnly); setPage(1); }}
            className={cn(
              'text-xs px-2.5 py-1 rounded-md transition-colors',
              unreadOnly
                ? 'bg-accent-primary/10 text-accent-primary font-medium'
                : 'text-text-tertiary hover:bg-surface-hover'
            )}
          >
            Unread only
          </button>
        </div>
      </div>

      {/* Notification List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-7 w-7" />}
          title="No notifications"
          message={unreadOnly ? 'No unread notifications. Try removing the filter.' : 'You\'re all caught up.'}
        />
      ) : (
        <div className="rounded-xl border border-surface-border/50 bg-surface-secondary divide-y divide-surface-border/30">
          {notifications.map(notification => {
            const Icon = TYPE_ICONS[notification.type] || Bell;
            const iconColor = TYPE_COLORS[notification.type] || 'text-text-quaternary';

            return (
              <div
                key={notification.id}
                className={cn(
                  'flex items-start gap-3 px-5 py-4 transition-colors cursor-pointer',
                  !notification.is_read && 'bg-accent-primary/[0.03]',
                  'hover:bg-surface-hover'
                )}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className={cn('mt-0.5 shrink-0', iconColor)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className={cn(
                      'text-sm truncate',
                      notification.is_read ? 'text-text-secondary' : 'text-text-primary font-medium'
                    )}>
                      {notification.title}
                    </p>
                    {!notification.is_read && (
                      <span className="h-2 w-2 rounded-full bg-accent-primary shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-text-tertiary line-clamp-2">{notification.message}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-2xs text-text-quaternary tabular-nums">
                      {formatRelativeTime(notification.created_at)}
                    </span>
                    <Badge variant="default" size="sm">
                      {notification.type.replace(/_/g, ' ')}
                    </Badge>
                    {notification.link && (
                      <ExternalLink className="h-3 w-3 text-text-quaternary" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-text-tertiary tabular-nums">
            Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              icon={<ChevronLeft className="h-4 w-4" />}
            />
            <span className="text-xs text-text-secondary tabular-nums px-2">
              {page} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              icon={<ChevronRight className="h-4 w-4" />}
            />
          </div>
        </div>
      )}
    </div>
  );
}
