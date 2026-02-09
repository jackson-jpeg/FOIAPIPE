import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';
import { formatDuration } from '@/lib/formatters';
import { Film, GripVertical } from 'lucide-react';

interface VideoCardProps {
  video: {
    id: string;
    title: string | null;
    thumbnail_storage_key: string | null;
    duration_seconds: number | null;
    foia_case_number?: string;
    priority: number;
    status: string;
  };
  onClick: () => void;
  dragHandleProps?: any;
}

export function VideoCard({ video, onClick, dragHandleProps }: VideoCardProps) {
  return (
    <div
      className="bg-surface-secondary border border-surface-border rounded-lg p-3 cursor-pointer hover:border-accent-cyan/50 transition-colors group"
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        {dragHandleProps && (
          <div {...dragHandleProps} className="mt-1 cursor-grab active:cursor-grabbing" onClick={e => e.stopPropagation()}>
            <GripVertical className="h-4 w-4 text-text-tertiary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          {/* Thumbnail */}
          <div className="relative aspect-video bg-surface-tertiary rounded-md overflow-hidden mb-2">
            {video.thumbnail_storage_key ? (
              <img src={`/api/videos/${video.id}/thumbnail`} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Film className="h-8 w-8 text-text-tertiary" />
              </div>
            )}
            {video.duration_seconds && (
              <span className="absolute bottom-1 right-1 bg-black/80 text-white text-xs font-mono px-1.5 py-0.5 rounded">
                {formatDuration(video.duration_seconds)}
              </span>
            )}
          </div>
          {/* Title */}
          <p className="text-sm text-text-primary truncate font-medium">
            {video.title || 'Untitled Video'}
          </p>
          {/* Meta */}
          <div className="flex items-center gap-2 mt-1">
            {video.foia_case_number && (
              <span className="text-xs font-mono text-text-tertiary">{video.foia_case_number}</span>
            )}
            {video.priority > 0 && (
              <Badge variant="warning" size="sm">P{video.priority}</Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
