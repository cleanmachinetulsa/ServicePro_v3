import { Skeleton } from '@/components/ui/skeleton';

export function CallHistorySkeleton() {
  return (
    <div className="divide-y dark:divide-gray-800">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="p-4 animate-pulse">
          <div className="flex items-center gap-4">
            <Skeleton className="h-5 w-5 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-3 w-16" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-9 rounded" />
              <Skeleton className="h-9 w-9 rounded" />
              <Skeleton className="h-9 w-9 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CustomersSkeleton() {
  return (
    <div className="divide-y dark:divide-gray-800">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="p-4 animate-pulse">
          <div className="flex items-start gap-4">
            <Skeleton className="h-5 w-5 rounded-full mt-1" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-full max-w-xs" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-9 w-9 rounded" />
              <Skeleton className="h-9 w-9 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function VoicemailSkeleton() {
  return (
    <div className="divide-y dark:divide-gray-800">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="p-4 animate-pulse">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-8 w-24 rounded" />
              <Skeleton className="h-8 w-24 rounded" />
              <Skeleton className="h-8 w-10 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
