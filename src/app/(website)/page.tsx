import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/feedback";
import { PageContainer } from "@/components/common/container";
import { HomeContent } from "@/components/website/home-content";

export const metadata: Metadata = {
  title: "Home",
  description:
    "Building and construction materials: browse indicative rates and request a quotation.",
};

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <PageContainer className="space-y-gutter-md py-section-lg" aria-busy="true">
          <Skeleton className="h-12 w-2/3" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-64 w-full" />
        </PageContainer>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
