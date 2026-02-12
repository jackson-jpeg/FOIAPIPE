import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Calendar, XCircle, Clock } from 'lucide-react';
import * as videosApi from '@/api/videos';
import { useToast } from '@/components/ui/Toast';

interface ScheduledVideo {
  id: string;
  title: string | null;
  scheduled_at: string | null;
  thumbnail_storage_key: string | null;
  foia_case_number: string | null;
}

interface PublishQueueProps {
  onRefresh: () => void;
}

export function PublishQueue({ onRefresh }: PublishQueueProps) {
  const { addToast } = useToast();
  const [queue, setQueue] = useState<ScheduledVideo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQueue = async () => {
    try {
      const data = await videosApi.getScheduledQueue();
      setQueue(data as any);
    } catch {
      setQueue([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchQueue(); }, []);

  const handleUnschedule = async (id: string) => {
    try {
      await videosApi.unscheduleVideo(id);
      addToast({ type: 'success', title: 'Video unscheduled' });
      fetchQueue();
      onRefresh();
    } catch {
      addToast({ type: 'error', title: 'Failed to unschedule' });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Spinner size="sm" />
      </div>
    );
  }

  if (queue.length === 0) return null;

  return (
    <div className="rounded-xl border border-surface-border bg-surface-secondary p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-indigo-400" />
        <h3 className="text-sm font-medium text-text-primary">Publish Queue</h3>
        <Badge variant="info" size="sm">{queue.length}</Badge>
      </div>
      <div className="space-y-2">
        {queue.map((video) => (
          <div
            key={video.id}
            className="flex items-center justify-between rounded-lg bg-surface-tertiary/30 border border-surface-border/50 px-3 py-2.5"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-text-primary truncate">
                  {video.title || 'Untitled'}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Clock className="h-2.5 w-2.5 text-text-quaternary" />
                  <span className="text-2xs text-text-tertiary tabular-nums">
                    {video.scheduled_at ? new Date(video.scheduled_at).toLocaleString() : 'N/A'}
                  </span>
                  {video.foia_case_number && (
                    <span className="text-2xs font-mono text-text-quaternary">{video.foia_case_number}</span>
                  )}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleUnschedule(video.id)}
              icon={<XCircle className="h-3 w-3" />}
            >
              Unschedule
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
