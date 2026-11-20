import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer, PageHeading } from "@/components/common/container";
import { Breadcrumbs } from "@/components/ui/navigation-aids";
import { ProductListing, ProductListingSkeleton } from "@/components/website/product-listing";

export const metadata: Metadata = {
  title: "Products",
  description: "Browse building and construction materials with indicative rates.",
};

export default function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <PageContainer className="pb-section-lg">
      <div className="pt-gutter-lg">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Products" }]} />
      </div>
      <PageHeading
        title="Products"
        description="Browse materials, compare indicative rates and send an enquiry."
      />
      <Suspense fallback={<ProductListingSkeleton />}>
        <ProductListing searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}
