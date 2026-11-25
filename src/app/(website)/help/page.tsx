import type { Metadata } from "next";
import { PageContainer } from "@/components/common/container";
import { Breadcrumbs } from "@/components/ui/navigation-aids";
import { HelpCentreView } from "@/components/website/help-centre-view";

export const metadata: Metadata = {
  title: "Help Centre & Frequently Asked Questions",
  description:
    "Simple step-by-step answers on searching construction materials, requesting quotations, using calculators, and tracking orders.",
  alternates: { canonical: "/help" },
};

export default function HelpPage() {
  return (
    <PageContainer className="py-section-md space-y-gutter-lg">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Help Centre" }]} />
      <HelpCentreView />
    </PageContainer>
  );
}
