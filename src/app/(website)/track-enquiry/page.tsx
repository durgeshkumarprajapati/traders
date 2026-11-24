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
  // Private, per-customer page: never indexed (also enforced by the X-Robots-Tag header in next.config.ts).
  robots: { index: false, follow: false },
};

const trackingFallback = (
  <div className="space-y-gutter-md py-section-sm" aria-busy="true">
    <Skeleton className="h-40 w-full" />
    <Skeleton className="h-64 w-full" />
  </div>
);

/**
 * The only part that reads data (the business phone / WhatsApp number from the cached catalogue). It lives inside <Suspense> so the
 * rest of the page can be prerendered and this streams in, instead of blocking the whole route.
 */
async function TrackingContent() {
  const load = await loadCatalogue();
  return (
    <TrackEnquiryView
      whatsappNumber={(load.ok ? load.settings.whatsappNumber : null) ?? undefined}
      businessPhone={(load.ok ? load.settings.phone : null) ?? undefined}
    />
  );
}

/** The tracking credentials arrive in the URL fragment and are read in the browser, never by the server. */
export default function TrackEnquiryPage() {
  return (
    <PageContainer className="pb-section-lg">
      <div className="pt-gutter-lg">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Track enquiry" }]} />
      </div>
      <PageHeading
        title="Enquiry Status & Tracking"
        description="View real-time progress, review prepared quotations, and communicate directly with the Sagar Traders sales desk."
      />
      <Suspense fallback={trackingFallback}>
        <TrackingContent />
      </Suspense>
    </PageContainer>
  );
}
