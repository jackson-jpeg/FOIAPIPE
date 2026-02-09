import { useState, useCallback } from 'react';
import { DndContext, DragEndEvent, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { KanbanColumn } from './KanbanColumn';
import { VideoCard } from './VideoCard';

interface Video {
  id: string;
  title: string | null;
  thumbnail_storage_key: string | null;
  duration_seconds: number | null;
  foia_case_number?: string;
  priority: number;
  status: string;
}

interface KanbanBoardProps {
  videos: Video[];
  onStatusChange: (videoId: string, newStatus: string) => void;
  onVideoClick: (videoId: string) => void;
}

const COLUMN_ORDER = ['raw_received', 'editing', 'ai_processing', 'review', 'ready', 'uploading', 'published'];

export function KanbanBoard({ videos, onStatusChange, onVideoClick }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10, // 10px distance to activate drag
        delay: 100, // 100ms delay to prevent accidental drags
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

    // Check if dropped on a column
    if (COLUMN_ORDER.includes(targetStatus)) {
      const video = videos.find(v => v.id === videoId);
      if (video && video.status !== targetStatus) {
        onStatusChange(videoId, targetStatus);
      }
    }
  }, [videos, onStatusChange]);

  const activeVideo = activeId ? videos.find(v => v.id === activeId) : null;

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
