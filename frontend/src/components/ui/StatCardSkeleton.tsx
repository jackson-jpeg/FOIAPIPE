import { Skeleton } from './Skeleton';

export function StatCardSkeleton() {
  return (
    <div className="glass-2 rounded-lg px-3 py-2.5 space-y-2">
      <Skeleton className="h-2.5 w-16" />
      <Skeleton className="h-6 w-20" />
    </div>
  );
}
