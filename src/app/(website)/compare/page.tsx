import type { Metadata } from "next";
import { PageContainer, PageHeading } from "@/components/common/container";
import { CompareView } from "@/components/compare/compare-view";
import { Breadcrumbs } from "@/components/ui/navigation-aids";
import { CatalogueUnavailable } from "@/components/website/catalogue-states";
import { loadCatalogue } from "@/features/catalogue/server";
import { buildComparison, parseCompareIds } from "@/features/compare/compare";
import { unitLabel } from "@/features/products/units";

export const metadata: Metadata = {
  title: "Compare Products",
  description:
    "Compare up to three building-material products side by side: brand, unit, indicative rate, availability and specifications.",
  alternates: { canonical: "/compare" },
  // Result pages differ per selection (?ids=…): index the tool, not each combination.
  robots: { index: true, follow: true },
};

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string | string[] }>;
}) {
  const requested = parseCompareIds((await searchParams).ids);
  const load = await loadCatalogue();
  return (
    <PageContainer className="pb-section-lg">
      <div className="pt-gutter-lg">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Products", href: "/products" },
            { label: "Compare" },
          ]}
        />
      </div>
      <PageHeading
        title="Compare products"
        description="Up to three products side by side. Only listed catalogue information is shown; anything missing is marked “Not specified”."
      />
      {load.ok ? (
        <CompareView
          comparison={buildComparison(load.catalogue, requested)}
          requestedIds={requested}
          picker={load.catalogue.products.map((p) => ({
            id: p.id,
            name: p.name,
            brandName: load.catalogue.brands.find((b) => b.id === p.brandId)?.name ?? null,
            unitLabel: unitLabel(p.unit),
          }))}
          whatsappNumber={load.settings.whatsappNumber}
          source={load.source === "STATIC" ? "STATIC" : "LIVE"}
        />
      ) : (
        <CatalogueUnavailable />
      )}
    </PageContainer>
  );
}
