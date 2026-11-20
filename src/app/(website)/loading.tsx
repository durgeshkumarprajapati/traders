import { PageContainer } from "@/components/common/container";
import { Skeleton, Spinner } from "@/components/ui/feedback";

export default function WebsiteLoading() {
  return (
    <PageContainer className="space-y-gutter-md py-section-md" aria-busy="true">
      <Spinner />
      <Skeleton className="h-10 w-1/2" />
      <Skeleton className="h-64 w-full" />
    </PageContainer>
  );
}
