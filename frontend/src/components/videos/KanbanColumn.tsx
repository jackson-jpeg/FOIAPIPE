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
        'flex flex-col min-w-[240px] max-w-[280px] rounded-lg glass-1 transition-all duration-200',
        isOver
          ? 'border-accent-primary/40 shadow-glass-hover'
          : 'border-dashed'
      )}
    >
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-glass-border">
        <div className="flex items-center gap-1.5">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: statusInfo?.color || '#64748b' }}
          />
          <span className="text-2xs font-medium text-text-primary">
            {statusInfo?.label || status}
          </span>
        </div>
        <span className="text-3xs font-mono tabular-nums text-text-quaternary bg-glass-highlight px-1 py-px rounded">
          {count}
        </span>
      </div>
      <SortableContext items={videoIds} strategy={verticalListSortingStrategy}>
        <div className="flex-1 p-1.5 space-y-1 overflow-y-auto max-h-[calc(100vh-240px)]">
          {children}
        </div>
      </SortableContext>
    </div>
  );
}
