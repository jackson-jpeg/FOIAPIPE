import { Skeleton } from './Skeleton';

export function StatCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-surface-secondary p-5 shadow-card">
      {/* Icon */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-10 rounded-lg" />
      </div>

      {/* Label */}
      <Skeleton className="h-3.5 w-20" />

      {/* Value */}
      <Skeleton className="h-8 w-24" />

      {/* Trend indicator */}
      <Skeleton className="h-3 w-16" />
    </div>
  );
}
