import type { Metadata } from "next";
import { Suspense } from "react";
import { PageBodySkeleton } from "@/components/common/page-skeleton";
import { PageContainer, PageHeading } from "@/components/common/container";
import { Notification } from "@/components/ui/notification";
import { Breadcrumbs } from "@/components/ui/navigation-aids";
import { RateAlertForm } from "@/components/rate-alerts/rate-alert-form";
import { rateAlertsAvailable } from "@/features/rate-alerts/actions";
import { RATE_ALERT_MESSAGES } from "@/features/rate-alerts/types";
import { loadCatalogue } from "@/features/catalogue/server";

export const metadata: Metadata = {
  title: "Rate Alerts",
  description: "Get an email when the listed rate of a Sagar Traders product changes.",
  alternates: { canonical: "/rate-alerts" },
};

async function RateAlertsBody() {
  const available = await rateAlertsAvailable();
  const load = available ? await loadCatalogue() : null;
  const products =
    load?.ok && load.source === "LIVE"
      ? load.catalogue.products
          .filter((p) => typeof p.price === "number" && p.price > 0)
          .map((p) => ({ id: p.id, name: p.name }))
      : [];
  return !available || products.length === 0 ? (
    <Notification tone="info" title="Rate alerts are not available yet">
      {RATE_ALERT_MESSAGES.unavailable}
    </Notification>
  ) : (
    <RateAlertForm products={products} />
  );
}

export default function RateAlertsPage() {
  return (
    <PageContainer className="max-w-2xl pb-section-lg">
      <div className="pt-gutter-lg">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Rate alerts" }]} />
      </div>
      <PageHeading
        title="Rate alerts"
        description="Follow the listed rate of a product. Listed rates are indicative; Sagar Traders confirms rates and availability when you enquire."
      />
      <Suspense fallback={<PageBodySkeleton />}>
        <RateAlertsBody />
      </Suspense>
    </PageContainer>
  );
}
