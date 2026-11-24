import type { Metadata } from "next";
import { PageContainer, PageHeading } from "@/components/common/container";
import { Breadcrumbs } from "@/components/ui/navigation-aids";
import { DeliveryCheck } from "@/components/website/delivery-check";

export const metadata: Metadata = {
  title: "Delivery Area Check",
  description:
    "Check whether your PIN code is in the delivery area Sagar Traders has listed, and ask about freight to your site. Delivery is never guaranteed online.",
  alternates: { canonical: "/delivery-check" },
};

export default function DeliveryCheckPage() {
  return (
    <PageContainer className="max-w-2xl pb-section-lg">
      <div className="pt-gutter-lg">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Delivery check" }]} />
      </div>
      <PageHeading
        title="Delivery area check"
        description="Enter your PIN code to see whether it is in the area we have listed. This is guidance only — delivery, charges and timing are confirmed by Sagar Traders."
      />
      <DeliveryCheck />
    </PageContainer>
  );
}
