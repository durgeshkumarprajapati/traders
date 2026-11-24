import type { Metadata } from "next";
import { PageContainer, PageHeading } from "@/components/common/container";
import { Breadcrumbs } from "@/components/ui/navigation-aids";
import { MaterialCalculator } from "@/components/tools/calculator";
import { loadCatalogue } from "@/features/catalogue/server";
import { toEnquiryItems } from "@/features/catalogue/view";

export const metadata: Metadata = {
  title: "Construction Material Calculator",
  description:
    "Estimate concrete volume, cement, sand and aggregate, bricks and blocks, and preliminary steel weight. Every formula and assumption is shown. Approximate planning estimates only.",
  alternates: { canonical: "/tools/material-calculator" },
};

export default async function MaterialCalculatorPage() {
  const load = await loadCatalogue();
  const catalogue = load.ok ? toEnquiryItems(load.catalogue) : [];
  return (
    <PageContainer className="pb-section-lg">
      <div className="pt-gutter-lg">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Tools", href: "/tools" },
            { label: "Material calculator" },
          ]}
        />
      </div>
      <PageHeading
        title="Construction material calculator"
        description="Approximate quantities for planning. Choose a calculator, enter your measurements and see exactly how the result was worked out."
      />
      <MaterialCalculator
        catalogue={catalogue}
        catalogueNote={
          load.ok
            ? load.source === "STATIC"
              ? "Product prices are not live right now, so product matching shows the built-in catalogue. Quantities you calculate are unaffected."
              : undefined
            : "The product list is unavailable right now. You can still calculate, and add the materials as custom requirements."
        }
      />
    </PageContainer>
  );
}
