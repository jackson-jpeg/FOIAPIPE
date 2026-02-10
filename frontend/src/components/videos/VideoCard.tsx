import { StatusOrb } from '@/components/ui/StatusOrb';
import { formatDuration } from '@/lib/formatters';
import { Film, GripVertical } from 'lucide-react';

interface VideoCardProps {
  video: {
    id: string;
    title: string | null;
    thumbnail_storage_key: string | null;
    duration_seconds: number | null;
    foia_case_number: string | null;
    priority: number;
    status: string;
  };
  onClick: () => void;
  dragHandleProps?: any;
}

export function VideoCard({ video, onClick, dragHandleProps }: VideoCardProps) {
  return (
    <div
      className="bg-surface-secondary border border-surface-border rounded-lg p-2.5 cursor-grab active:cursor-grabbing transition-all duration-150 hover:border-surface-border-light hover:shadow-card-hover group"
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        {dragHandleProps && (
          <div {...dragHandleProps} className="mt-1 cursor-grab active:cursor-grabbing" onClick={e => e.stopPropagation()}>
            <GripVertical className="h-3.5 w-3.5 text-text-quaternary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          {/* Thumbnail */}
          <div className="relative aspect-video bg-surface-tertiary rounded-md overflow-hidden mb-2">
            {video.thumbnail_storage_key ? (
              <img src={`/api/videos/${video.id}/thumbnail`} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Film className="h-6 w-6 text-text-quaternary" />
              </div>
            )}
            {video.duration_seconds && (
              <span className="absolute bottom-1 right-1 bg-black/75 text-white text-2xs font-mono px-1 py-0.5 rounded">
                {formatDuration(video.duration_seconds)}
              </span>
            )}
          </div>
          {/* Title */}
          <p className="text-xs text-text-primary truncate font-medium">
            {video.title || 'Untitled Video'}
          </p>
          {/* Meta */}
          <div className="flex items-center gap-2 mt-1.5">
            {video.foia_case_number && (
              <span className="text-xs font-mono text-text-quaternary">{video.foia_case_number}</span>
            )}
            {video.priority > 0 && (
              <StatusOrb color="warning" size="sm" label={`P${video.priority}`} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
