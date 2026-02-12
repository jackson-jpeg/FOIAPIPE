import { useEffect, useState, useMemo } from 'react';
import { KanbanBoard } from '@/components/videos/KanbanBoard';
import { VideoDetail } from '@/components/videos/VideoDetail';
import { PublishQueue } from '@/components/videos/PublishQueue';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { useToast } from '@/components/ui/Toast';
import { useVideoStore } from '@/stores/videoStore';
import { useSSE } from '@/hooks/useSSE';
import { Skeleton } from '@/components/ui/Skeleton';
import { Plus, Film, Upload, CheckCircle, Eye, Download } from 'lucide-react';
import * as videosApi from '@/api/videos';
import { exportVideos } from '@/api/exports';
import type { VideoStatus } from '@/types';
import { VIDEO_STATUSES } from '@/lib/constants';

export function VideoPipelinePage() {
  const { videos, loading, fetchVideos } = useVideoStore();
  const { addToast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { fetchVideos(); }, [fetchVideos]);

  // SSE: refetch videos on relevant events
  const sseHandlers = useMemo(() => ({
    video_status_changed: () => fetchVideos(),
    video_published: () => fetchVideos(),
    video_scheduled_publish: () => fetchVideos(),
  }), [fetchVideos]);
  useSSE(sseHandlers);

  // ── Computed stats ────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = videos.length;
    const published = videos.filter((v: any) => v.status === 'published').length;
    const inProgress = videos.filter((v: any) =>
      ['editing', 'ai_processing', 'review', 'ready'].includes(v.status)
    ).length;
    const uploading = videos.filter((v: any) => v.status === 'uploading').length;
    const totalViews = videos.reduce((acc: number, v: any) => acc + (v.views || 0), 0);

    return { total, published, inProgress, uploading, totalViews };
  }, [videos]);

  // ── Status distribution for mini bar ──────────────────────────────────

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    videos.forEach((v: any) => {
      counts[v.status] = (counts[v.status] || 0) + 1;
    });
    return counts;
  }, [videos]);

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleStatusChange = async (videoId: string, newStatus: string) => {
    try {
      await videosApi.updateVideo(videoId, { status: newStatus as VideoStatus });
      fetchVideos();
    } catch {
      addToast({ type: 'error', title: 'Failed to update status' });
    }
  };

  const handleUpdate = async (id: string, data: Record<string, any>) => {
    try {
      await videosApi.updateVideo(id, data);
      addToast({ type: 'success', title: 'Video updated' });
      fetchVideos();
    } catch {
      addToast({ type: 'error', title: 'Failed to update' });
    }
  };

  const handleUploadRaw = async (id: string, file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      await videosApi.uploadRaw(id, formData);
      addToast({ type: 'success', title: 'File uploaded' });
      fetchVideos();
    } catch {
      addToast({ type: 'error', title: 'Upload failed' });
    }
  };

  const handleGenerateThumbnail = async (id: string) => {
    try {
      await videosApi.generateThumbnail(id);
      addToast({ type: 'success', title: 'Thumbnail generated' });
      fetchVideos();
    } catch {
      addToast({ type: 'error', title: 'Thumbnail generation failed' });
    }
  };

  const handleUploadToYoutube = async (id: string) => {
    try {
      await videosApi.uploadToYoutube(id);
      addToast({ type: 'success', title: 'Video queued for YouTube upload' });
      fetchVideos();
    } catch {
      addToast({ type: 'error', title: 'Failed to queue YouTube upload' });
    }
  };

  const handleCreate = async () => {
    try {
      const video = await videosApi.createVideo({});
      addToast({ type: 'success', title: 'Video created' });
      fetchVideos();
      setSelectedId(video.id);
    } catch {
      addToast({ type: 'error', title: 'Failed to create video' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await videosApi.deleteVideo(id);
      addToast({ type: 'success', title: 'Video deleted' });
      setSelectedId(null);
      fetchVideos();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to delete video';
      addToast({ type: 'error', title: msg });
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      const clone = await videosApi.duplicateVideo(id);
      addToast({ type: 'success', title: 'Video duplicated' });
      fetchVideos();
      setSelectedId(clone.id);
    } catch {
      addToast({ type: 'error', title: 'Failed to duplicate video' });
    }
  };

  const selectedVideo = selectedId ? videos.find((v: any) => v.id === selectedId) || null : null;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="heading-3 mb-2">Video Pipeline</h1>
          <p className="text-sm text-text-secondary">
            Manage bodycam video processing from raw footage to YouTube publication
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              setExporting(true);
              try {
                await exportVideos();
                addToast({ type: 'success', title: 'Videos exported' });
              } catch {
                addToast({ type: 'error', title: 'Export failed' });
              } finally {
                setExporting(false);
              }
            }}
            loading={exporting}
            icon={<Download className="h-4 w-4" />}
          >
            Export CSV
          </Button>
          <Button variant="primary" onClick={handleCreate} icon={<Plus className="h-4 w-4" />}>
            New Video
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-surface-secondary border border-surface-border/50 p-6 space-y-3">
              <Skeleton variant="text" className="h-3 w-16" />
              <Skeleton variant="text" className="h-5 w-12" />
            </div>
          ))
        ) : (
          <>
            <StatCard
              label="Total Videos"
              value={String(stats.total)}
              icon={<Film className="h-5 w-5" />}
              gradient="blue"
            />
            <StatCard
              label="In Progress"
              value={String(stats.inProgress)}
              icon={<Upload className="h-5 w-5" />}
              gradient="amber"
            />
            <StatCard
              label="Published"
              value={String(stats.published)}
              icon={<CheckCircle className="h-5 w-5" />}
              gradient="emerald"
            />
            <StatCard
              label="Total Views"
              value={stats.totalViews > 0 ? stats.totalViews.toLocaleString() : '--'}
              icon={<Eye className="h-5 w-5" />}
              gradient="purple"
            />
          </>
        )}
      </div>

      {/* Status Distribution Bar */}
      {!loading && videos.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">Distribution</span>
            <span className="text-xs text-text-quaternary tabular-nums">{videos.length} videos</span>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden bg-surface-tertiary/50">
            {Object.entries(statusCounts).map(([status, count]) => {
              const info = VIDEO_STATUSES[status as keyof typeof VIDEO_STATUSES];
              const pct = (count / videos.length) * 100;
              if (pct === 0) return null;
              return (
                <div
                  key={status}
                  className="h-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: info?.color || '#64748b' }}
                  title={`${info?.label || status}: ${count}`}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3">
            {Object.entries(statusCounts).map(([status, count]) => {
              const info = VIDEO_STATUSES[status as keyof typeof VIDEO_STATUSES];
              return (
                <span key={status} className="inline-flex items-center gap-1.5 text-xs text-text-tertiary">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: info?.color || '#64748b' }}
                  />
                  {info?.label || status} ({count})
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Publish Queue */}
      <PublishQueue onRefresh={fetchVideos} />

      {/* Kanban Board */}
      {loading ? (
        <div className="flex gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-80 w-64 rounded-lg" />
          ))}
        </div>
      ) : (
        <KanbanBoard
          videos={videos}
          onStatusChange={handleStatusChange}
          onVideoClick={setSelectedId}
        />
      )}

      <VideoDetail
        video={selectedVideo}
        isOpen={!!selectedId}
        onClose={() => setSelectedId(null)}
        onUpdate={handleUpdate}
        onUploadRaw={handleUploadRaw}
        onGenerateThumbnail={handleGenerateThumbnail}
        onUploadToYoutube={handleUploadToYoutube}
        onRefresh={fetchVideos}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
      />
    </div>
  );
}
