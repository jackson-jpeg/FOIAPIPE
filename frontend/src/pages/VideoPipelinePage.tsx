import { useEffect, useState } from 'react';
import { KanbanBoard } from '@/components/videos/KanbanBoard';
import { VideoDetail } from '@/components/videos/VideoDetail';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useVideoStore } from '@/stores/videoStore';
import { Skeleton } from '@/components/ui/Skeleton';
import { Plus } from 'lucide-react';
import * as videosApi from '@/api/videos';

export function VideoPipelinePage() {
  const { videos, loading, fetchVideos } = useVideoStore();
  const { addToast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => { fetchVideos(); }, [fetchVideos]);

  const handleStatusChange = async (videoId: string, newStatus: string) => {
    try {
      await videosApi.updateVideo(videoId, { status: newStatus });
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

  const selectedVideo = selectedId ? videos.find((v: any) => v.id === selectedId) : null;

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
        <Button variant="primary" onClick={handleCreate} icon={<Plus className="h-4 w-4" />}>
          New Video
        </Button>
      </div>

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
      />
    </div>
  );
}
