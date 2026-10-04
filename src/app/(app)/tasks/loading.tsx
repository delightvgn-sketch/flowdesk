import { PageHeaderSkeleton } from "@/components/shared/misc";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading tasks">
      <PageHeaderSkeleton />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-xl border bg-muted/40 p-3">
            <Skeleton className="h-4 w-24" />
            {Array.from({ length: 3 - (i % 2) }).map((__, j) => (
              <Skeleton key={j} className="h-24 rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
