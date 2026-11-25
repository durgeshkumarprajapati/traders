import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer } from "@/components/common/container";
import { ProjectCostEstimator } from "@/components/tools/cost-estimator";
import { ContextualHelp } from "@/components/website/contextual-help";
import { Skeleton } from "@/components/ui/feedback";
import { Breadcrumbs } from "@/components/ui/navigation-aids";
import { loadCatalogue } from "@/features/catalogue/server";
import { unitLabel } from "@/features/products/units";

export const metadata: Metadata = {
  title: "Project Cost & Material Estimator",
  description:
    "Enter your room, wall, or floor measurements in feet to calculate approximate construction material quantities and indicative costs.",
  alternates: { canonical: "/tools/cost-estimator" },
};

async function CostEstimatorContent() {
  const load = await loadCatalogue();
  const products = load.ok
    ? load.catalogue.products.map((p) => ({
        id: p.id,
        name: p.name,
        unitLabel: unitLabel(p.unit),
        price: typeof p.price === "number" && p.price > 0 ? p.price : null,
      }))
    : [];
  const whatsappNumber = load.ok ? load.settings.whatsappNumber : null;

  return (
    <PageContainer className="py-section-md space-y-gutter-lg">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Tools", href: "/tools" },
          { label: "Project Cost Estimator" },
        ]}
      />
      <div data-tour="tools-entry" className="space-y-2">
        <h1 className="text-headline-xl text-primary">Project Cost &amp; Material Estimator</h1>
        <p className="mt-1 text-body-lg text-on-surface-variant">
          Enter simple measurements in feet to estimate approximate cement, bricks, sand, and steel
          needed for your project.
        </p>
        <ContextualHelp topic="calculator" />
      </div>
      <ProjectCostEstimator products={products} whatsappNumber={whatsappNumber} />
    </PageContainer>
  );
}

export default function CostEstimatorPage() {
  return (
    <Suspense
      fallback={
        <PageContainer className="space-y-gutter-md py-section-md" aria-busy="true">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-64 w-full" />
        </PageContainer>
      }
    >
      <CostEstimatorContent />
    </Suspense>
  );
}
