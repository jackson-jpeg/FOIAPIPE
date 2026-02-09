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
        'flex flex-col min-w-[280px] max-w-[320px] rounded-lg border bg-surface-primary',
        isOver ? 'border-accent-cyan/50 bg-accent-cyan/5' : 'border-surface-border'
      )}
    >
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: statusInfo?.color || '#64748b' }}
          />
          <span className="text-sm font-medium text-text-primary">
            {statusInfo?.label || status}
          </span>
        </div>
        <span className="text-xs font-mono text-text-tertiary bg-surface-tertiary px-2 py-0.5 rounded-full">
          {count}
        </span>
      </div>
      <SortableContext items={videoIds} strategy={verticalListSortingStrategy}>
        <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-240px)]">
          {children}
        </div>
      </SortableContext>
    </div>
  );
}
