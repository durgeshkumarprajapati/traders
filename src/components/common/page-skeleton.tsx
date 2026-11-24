import { Skeleton } from "@/components/ui/feedback";

/** Placeholder shown while a page's data-dependent part streams in (the rest of the page is prerendered). */
export function PageBodySkeleton() {
  return (
    <div className="space-y-gutter-md py-section-sm" aria-busy="true">
      <Skeleton className="h-12 w-2/3" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
