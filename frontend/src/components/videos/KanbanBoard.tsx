import { useState, useCallback } from 'react';
import { DndContext, DragEndEvent, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { KanbanColumn } from './KanbanColumn';
import { VideoCard } from './VideoCard';
import { useBreakpoint } from '@/hooks/useMediaQuery';
import { VIDEO_STATUSES } from '@/lib/constants';
import { ChevronDown, ChevronRight, Film } from 'lucide-react';
import { formatDuration } from '@/lib/formatters';

interface Video {
  id: string;
  title: string | null;
  thumbnail_storage_key: string | null;
  duration_seconds: number | null;
  foia_case_number: string | null;
  priority: number;
  status: string;
}

interface KanbanBoardProps {
  videos: Video[];
  onStatusChange: (videoId: string, newStatus: string) => void;
  onVideoClick: (videoId: string) => void;
}

const COLUMN_ORDER = ['raw_received', 'editing', 'ai_processing', 'review', 'ready', 'uploading', 'published'];

function MobileKanbanList({ videos, onStatusChange, onVideoClick }: KanbanBoardProps) {
  const [expandedStatus, setExpandedStatus] = useState<string | null>(
    COLUMN_ORDER.find(s => videos.some(v => v.status === s)) || null
  );

  const videosByStatus = COLUMN_ORDER.reduce<Record<string, Video[]>>((acc, status) => {
    acc[status] = videos.filter(v => v.status === status);
    return acc;
  }, {});

  return (
    <div className="space-y-2">
      {COLUMN_ORDER.map(status => {
        const statusVideos = videosByStatus[status] || [];
        const statusInfo = VIDEO_STATUSES[status as keyof typeof VIDEO_STATUSES];
        const isExpanded = expandedStatus === status;

        return (
          <div key={status} className="rounded-lg glass-1 overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-glass-highlight transition-colors"
              onClick={() => setExpandedStatus(isExpanded ? null : status)}
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: statusInfo?.color || '#64748b' }}
                />
                <span className="text-sm font-medium text-text-primary">
                  {statusInfo?.label || status}
                </span>
                <span className="text-3xs tabular-nums font-mono text-text-quaternary bg-glass-highlight px-1.5 py-0.5 rounded-md">
                  {statusVideos.length}
                </span>
              </div>
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-text-quaternary" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-text-quaternary" />
              )}
            </button>

            {isExpanded && statusVideos.length > 0 && (
              <div className="border-t border-glass-border divide-y divide-glass-border">
                {statusVideos.map(video => (
                  <div
                    key={video.id}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-glass-highlight transition-colors cursor-pointer"
                    onClick={() => onVideoClick(video.id)}
                  >
                    <div className="h-10 w-16 rounded bg-surface-tertiary overflow-hidden shrink-0 flex items-center justify-center">
                      {video.thumbnail_storage_key ? (
                        <img src={`/api/videos/${video.id}/thumbnail`} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Film className="h-4 w-4 text-text-quaternary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {video.title || 'Untitled Video'}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {video.foia_case_number && (
                          <span className="text-2xs font-mono text-text-quaternary">{video.foia_case_number}</span>
                        )}
                        {video.duration_seconds && (
                          <span className="text-2xs text-text-quaternary">{formatDuration(video.duration_seconds)}</span>
                        )}
                      </div>
                    </div>
                    <select
                      value={video.status}
                      onChange={(e) => {
                        e.stopPropagation();
                        onStatusChange(video.id, e.target.value);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="text-3xs bg-transparent border glass-border rounded px-1.5 py-1 text-text-secondary shrink-0"
                    >
                      {COLUMN_ORDER.map(s => {
                        const info = VIDEO_STATUSES[s as keyof typeof VIDEO_STATUSES];
                        return <option key={s} value={s}>{info?.label || s}</option>;
                      })}
                    </select>
                  </div>
                ))}
              </div>
            )}

            {isExpanded && statusVideos.length === 0 && (
              <div className="border-t border-glass-border px-3 py-4 text-center">
                <p className="text-2xs text-text-quaternary">No videos in this stage</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function KanbanBoard({ videos, onStatusChange, onVideoClick }: KanbanBoardProps) {
  const { isMobile } = useBreakpoint();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
        delay: 100,
        tolerance: 5,
      },
    })
  );

  const videosByStatus = COLUMN_ORDER.reduce<Record<string, Video[]>>((acc, status) => {
    acc[status] = videos.filter(v => v.status === status);
    return acc;
  }, {});

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const videoId = active.id as string;
    const targetStatus = over.id as string;

    if (COLUMN_ORDER.includes(targetStatus)) {
      const video = videos.find(v => v.id === videoId);
      if (video && video.status !== targetStatus) {
        onStatusChange(videoId, targetStatus);
      }
    }
  }, [videos, onStatusChange]);

  const activeVideo = activeId ? videos.find(v => v.id === activeId) : null;

  if (isMobile) {
    return <MobileKanbanList videos={videos} onStatusChange={onStatusChange} onVideoClick={onVideoClick} />;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={({ active }) => setActiveId(active.id as string)}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMN_ORDER.map(status => (
          <KanbanColumn
            key={status}
            status={status}
            videoIds={videosByStatus[status]?.map(v => v.id) || []}
            count={videosByStatus[status]?.length || 0}
          >
            {videosByStatus[status]?.map(video => (
              <VideoCard
                key={video.id}
                video={video}
                onClick={() => onVideoClick(video.id)}
              />
            ))}
          </KanbanColumn>
        ))}
      </div>
      <DragOverlay>
        {activeVideo && (
          <div className="rotate-2 scale-105 transition-transform duration-300 ease-spring ring-2 ring-accent-primary/30">
            <VideoCard video={activeVideo} onClick={() => {}} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
