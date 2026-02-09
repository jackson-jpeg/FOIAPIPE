import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '@/lib/cn';
import { VIDEO_STATUSES } from '@/lib/constants';

interface KanbanColumnProps {
  status: string;
  videoIds: string[];
  count: number;
  children: React.ReactNode;
}

export function KanbanColumn({ status, videoIds, count, children }: KanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id: status });
  const statusInfo = VIDEO_STATUSES[status as keyof typeof VIDEO_STATUSES];

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col min-w-[260px] max-w-[300px] rounded-xl border bg-surface-primary shadow-card transition-all duration-150',
        isOver ? 'border-accent-primary/40 shadow-glow-sm' : 'border-surface-border'
      )}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: statusInfo?.color || '#64748b' }}
          />
          <span className="text-xs font-medium text-text-primary">
            {statusInfo?.label || status}
          </span>
        </div>
        <span className="text-2xs tabular-nums text-text-quaternary bg-surface-tertiary/60 px-1.5 py-0.5 rounded-md">
          {count}
        </span>
      </div>
      <SortableContext items={videoIds} strategy={verticalListSortingStrategy}>
        <div className="flex-1 p-1.5 space-y-1.5 overflow-y-auto max-h-[calc(100vh-240px)]">
          {children}
        </div>
      </SortableContext>
    </div>
  );
}
