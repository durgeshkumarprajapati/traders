import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer } from "@/components/common/container";
import { Skeleton } from "@/components/ui/feedback";
import { BulkEnquiryContent } from "@/components/website/bulk-enquiry-content";

export const metadata: Metadata = {
  title: "Bulk Quotation Enquiry",
  description:
    "Request a competitive quotation for commercial construction materials and hardware supplies in one streamlined enquiry.",
  alternates: {
    canonical: "/bulk-enquiry",
  },
};

export default function BulkEnquiryPage() {
  return (
    <Suspense
      fallback={
        <PageContainer className="space-y-gutter-md py-section-md" aria-busy="true">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-96 w-full" />
        </PageContainer>
      }
    >
      <BulkEnquiryContent />
    </Suspense>
  );
}
