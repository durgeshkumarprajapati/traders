import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Building2 } from "lucide-react";
import { PageContainer } from "@/components/common/container";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/feedback";
import { Breadcrumbs } from "@/components/ui/navigation-aids";
import { listPublicProjects } from "@/features/projects/server/projects";

export const metadata: Metadata = {
  title: "Project Showcase & Customer Stories",
  description:
    "Explore real construction projects supplied by Sagar Traders and verified customer stories.",
  alternates: { canonical: "/projects" },
};

async function ProjectsListContent() {
  const projects = await listPublicProjects();

  return (
    <PageContainer className="py-section-md space-y-gutter-lg">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Projects" }]} />

      <div className="flex flex-wrap items-end justify-between gap-gutter-md">
        <div>
          <h1 className="text-headline-xl text-primary">Project Showcase &amp; Customer Stories</h1>
          <p className="mt-1 text-body-lg text-on-surface-variant">
            Verified construction projects supplied with materials from Sagar Traders.
          </p>
        </div>
        <ButtonLink href="/bulk-enquiry" size="md">
          Request Project Quote
        </ButtonLink>
      </div>

      {projects.length === 0 ? (
        <Card className="p-gutter-xl text-center">
          <Building2 aria-hidden className="mx-auto size-10 text-on-surface-variant" />
          <h2 className="mt-3 text-headline-sm text-primary">Projects Coming Soon</h2>
          <p className="mt-1 text-body-md text-on-surface-variant">
            We only publish real, verified customer projects with permission. Contact us to discuss
            your upcoming construction supply requirements.
          </p>
          <div className="mt-gutter-md">
            <ButtonLink href="/products" variant="outline">
              Browse Products
            </ButtonLink>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-gutter-md md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Card key={p.id} className="flex flex-col overflow-hidden">
              {p.images[0] && (
                <Image
                  src={p.images[0].imageUrl}
                  alt={p.images[0].altText}
                  width={800}
                  height={480}
                  className="h-48 w-full object-cover"
                />
              )}
              <div className="flex flex-1 flex-col justify-between p-gutter-md space-y-gutter-sm">
                <div>
                  <div className="flex flex-wrap items-center gap-gutter-xs">
                    <Badge tone="neutral">{p.category}</Badge>
                    {p.location && (
                      <span className="text-body-sm text-on-surface-variant">{p.location}</span>
                    )}
                  </div>
                  <h2 className="mt-2 text-title-lg font-bold text-primary">
                    <Link href={`/projects/${p.slug}`} className="hover:underline">
                      {p.title}
                    </Link>
                  </h2>
                  <p className="mt-1 line-clamp-3 text-body-md text-on-surface-variant">
                    {p.description}
                  </p>
                </div>
                <ButtonLink href={`/projects/${p.slug}`} variant="outline" size="sm">
                  View Project Details
                </ButtonLink>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense
      fallback={
        <PageContainer className="space-y-gutter-md py-section-md" aria-busy="true">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-64 w-full" />
        </PageContainer>
      }
    >
      <ProjectsListContent />
    </Suspense>
  );
}
