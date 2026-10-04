import { CardGridSkeleton, PageHeaderSkeleton } from "@/components/shared/misc";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <PageHeaderSkeleton />
      <Skeleton className="mb-6 h-10 w-full max-w-lg" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <CardGridSkeleton />
          <Skeleton className="h-64 rounded-xl" />
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}
