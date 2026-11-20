import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer } from "@/components/common/container";
import { Skeleton } from "@/components/ui/feedback";
import { ProductDetail, productMetadata } from "@/components/website/product-detail";

type Props = { params: Promise<{ slug: string }> };

export function generateMetadata({ params }: Props): Promise<Metadata> {
  return productMetadata(params);
}

export default function ProductPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <PageContainer className="space-y-gutter-md py-section-md" aria-busy="true">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-96 w-full" />
        </PageContainer>
      }
    >
      <ProductDetail params={params} />
    </Suspense>
  );
}
