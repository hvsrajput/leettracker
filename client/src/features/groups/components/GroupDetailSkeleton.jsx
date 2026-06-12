import { Skeleton } from '@/shared/ui/skeleton';

const GroupDetailSkeleton = () => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
    <div className="space-y-3">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-4 w-80" />
    </div>
    <Skeleton className="h-10 w-full max-w-md" />
    <Skeleton className="h-96 rounded-2xl" />
  </div>
);

export default GroupDetailSkeleton;
