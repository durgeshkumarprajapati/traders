import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer, PageHeading } from "@/components/common/container";
import { Skeleton } from "@/components/ui/feedback";
import { Breadcrumbs } from "@/components/ui/navigation-aids";
import { TrackEnquiryView } from "@/components/website/track-enquiry-view";
import { loadCatalogue } from "@/features/catalogue/server";

export const metadata: Metadata = {
  title: "Track Enquiry Status",
  description:
    "Check live updates, quotations, and processing timeline for your building material enquiry without logging in.",
  alternates: {
    canonical: "/track-enquiry",
  },
};

interface TrackEnquiryPageProps {
  searchParams: Promise<{ ref?: string; token?: string }>;
}

export default async function TrackEnquiryPage({ searchParams }: TrackEnquiryPageProps) {
  const params = await searchParams;
  const load = await loadCatalogue();
  const whatsappNumber = load.ok ? load.settings.whatsappNumber : undefined;
  const businessPhone = load.ok ? load.settings.phone : undefined;

  return (
    <PageContainer className="pb-section-lg">
      <div className="pt-gutter-lg">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Track enquiry" }]} />
      </div>
      <PageHeading
        title="Enquiry Status & Tracking"
        description="View real-time progress, review prepared quotations, and communicate directly with the Sagar Traders sales desk."
      />
      <Suspense
        fallback={
          <div className="space-y-gutter-md py-section-sm" aria-busy="true">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        }
      >
        <TrackEnquiryView
          initialReference={params.ref ?? ""}
          initialToken={params.token ?? ""}
          whatsappNumber={whatsappNumber ?? undefined}
          businessPhone={businessPhone ?? undefined}
        />
      </Suspense>
    </PageContainer>
  );
}
