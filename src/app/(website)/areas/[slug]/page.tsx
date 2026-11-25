import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageContainer } from "@/components/common/container";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/feedback";
import { Breadcrumbs } from "@/components/ui/navigation-aids";
import { loadSettings } from "@/features/catalogue/server";
import { getPublicServiceAreaBySlug } from "@/features/seo/service-areas";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const area = await getPublicServiceAreaBySlug(slug);
  if (!area) return { title: "Service Area Not Found" };

  return {
    title: area.seoTitle || `Building Materials Supply in ${area.areaName}`,
    description: area.seoDescription || area.description.slice(0, 160),
    alternates: { canonical: `/areas/${area.slug}` },
  };
}

async function ServiceAreaContent({ params }: Props) {
  const { slug } = await params;
  const [area, settings] = await Promise.all([getPublicServiceAreaBySlug(slug), loadSettings()]);
  if (!area) notFound();

  return (
    <PageContainer className="py-section-md space-y-gutter-lg">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: area.areaName },
        ]}
      />

      <h1 className="text-headline-xl text-primary">
        {area.seoTitle || `Building Materials Supply in ${area.areaName}`}
      </h1>

      <Card className="p-gutter-lg space-y-gutter-md">
        <p className="whitespace-pre-line text-body-lg text-on-surface">{area.description}</p>
        {(area.deliveryCoverage || settings.deliveryCoverage) && (
          <div className="rounded bg-surface-muted p-gutter-md text-body-md">
            <strong className="text-primary">Confirmed Delivery Coverage: </strong>
            <span>{area.deliveryCoverage || settings.deliveryCoverage}</span>
          </div>
        )}
      </Card>

      <div className="flex flex-wrap gap-gutter-sm">
        <ButtonLink href="/products" size="md">
          Browse Product Catalogue
        </ButtonLink>
        <ButtonLink href="/bulk-enquiry" variant="outline" size="md">
          Request Bulk Quotation
        </ButtonLink>
      </div>
    </PageContainer>
  );
}

export default function ServiceAreaPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <PageContainer className="space-y-gutter-md py-section-md" aria-busy="true">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-64 w-full" />
        </PageContainer>
      }
    >
      <ServiceAreaContent params={params} />
    </Suspense>
  );
}
