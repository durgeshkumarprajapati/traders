import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageContainer } from "@/components/common/container";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/feedback";
import { Breadcrumbs } from "@/components/ui/navigation-aids";
import { OrderTrackingView } from "@/components/website/order-tracking-view";
import { getTrackedOrder } from "@/features/orders/server/orders";
import { guardTokenAccess } from "@/features/quotations/server/access";

export const metadata: Metadata = {
  title: "Track Order",
  robots: { index: false, follow: false, nocache: true },
};

async function OrderContent({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  if (!token || token.length < 32 || token.length > 128) notFound();

  const gate = await guardTokenAccess();
  if (!gate.allowed) {
    return (
      <PageContainer className="py-section-lg">
        <Card className="mx-auto max-w-lg p-gutter-lg text-center">
          <h1 className="text-title-lg font-bold text-primary">Please try again shortly</h1>
          <p className="mt-2 text-body-md text-on-surface-variant">
            Too many attempts were made from your connection. Wait a few minutes and try again.
          </p>
        </Card>
      </PageContainer>
    );
  }

  const order = await getTrackedOrder(token);
  if (!order) notFound();

  return (
    <PageContainer className="pb-section-lg">
      <div className="pb-gutter-md pt-gutter-lg">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Track enquiry", href: "/track-enquiry" },
            { label: `Order ${order.reference}` },
          ]}
        />
      </div>
      <OrderTrackingView order={order} />
    </PageContainer>
  );
}

export default function CustomerOrderPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense
      fallback={
        <PageContainer className="space-y-gutter-md py-section-md" aria-busy="true">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-64 w-full" />
        </PageContainer>
      }
    >
      <OrderContent params={params} />
    </Suspense>
  );
}
