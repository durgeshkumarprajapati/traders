import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageContainer } from "@/components/common/container";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/feedback";
import { Breadcrumbs } from "@/components/ui/navigation-aids";
import { loadSettings } from "@/features/catalogue/server";
import { getPublicProjectBySlug } from "@/features/projects/server/projects";
import { buildProjectShareUrl } from "@/features/whatsapp/manual";
import { publicEnv } from "@/lib/env/public";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = await getPublicProjectBySlug(slug);
  if (!project) return { title: "Project Not Found" };

  return {
    title: project.seoTitle || project.title,
    description: project.seoDescription || project.description.slice(0, 160),
    alternates: { canonical: `/projects/${project.slug}` },
    openGraph: {
      title: project.seoTitle || project.title,
      description: project.seoDescription || project.description.slice(0, 160),
      type: "article",
      url: `/projects/${project.slug}`,
      ...(project.images[0] ? { images: [{ url: project.images[0].imageUrl }] } : {}),
    },
  };
}

async function ProjectDetailContent({ params }: Props) {
  const { slug } = await params;
  const [project, settings] = await Promise.all([getPublicProjectBySlug(slug), loadSettings()]);
  if (!project) notFound();

  const baseUrl = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const projectUrl = `${baseUrl}/projects/${project.slug}`;
  const waShareUrl = buildProjectShareUrl({
    businessWhatsAppNumber: settings.whatsappNumber,
    projectTitle: project.title,
    projectUrl,
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: project.title,
    description: project.seoDescription || project.description.slice(0, 200),
    datePublished: project.publishedAt ?? project.createdAt,
    dateModified: project.updatedAt,
    publisher: {
      "@type": "Organization",
      name: settings.name,
    },
  };

  return (
    <PageContainer className="py-section-md space-y-gutter-lg">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Projects", href: "/projects" },
          { label: project.title },
        ]}
      />

      <div className="space-y-gutter-sm">
        <div className="flex flex-wrap items-center gap-gutter-xs">
          <Badge tone="neutral">{project.category}</Badge>
          {project.location && <Badge tone="info">{project.location}</Badge>}
          {project.completionDate && (
            <span className="text-body-sm text-on-surface-variant">
              Completed: {new Date(project.completionDate).toLocaleDateString("en-IN")}
            </span>
          )}
        </div>
        <h1 className="text-headline-xl text-primary">{project.title}</h1>
      </div>

      {project.images.length > 0 && (
        <div className="grid grid-cols-1 gap-gutter-md md:grid-cols-2">
          {project.images.map((img) => (
            <Image
              key={img.id}
              src={img.imageUrl}
              alt={img.altText}
              width={900}
              height={600}
              className="h-64 w-full rounded-md border border-border object-cover"
            />
          ))}
        </div>
      )}

      <Card className="p-gutter-lg space-y-gutter-md">
        <h2 className="text-headline-sm text-primary">Project Overview</h2>
        <p className="whitespace-pre-line text-body-lg text-on-surface">{project.description}</p>

        {project.materialsSupplied.length > 0 && (
          <div>
            <h3 className="text-title-md font-semibold text-primary">Materials Supplied</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {project.materialsSupplied.map((m) => (
                <Badge key={m} tone="neutral" appearance="outline">
                  {m}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {project.brandsSupplied.length > 0 && (
          <div>
            <h3 className="text-title-md font-semibold text-primary">Brands Supplied</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {project.brandsSupplied.map((b) => (
                <Badge key={b} tone="info">
                  {b}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {project.customerTestimonial && (
          <blockquote className="rounded border-l-4 border-secondary bg-surface-muted p-gutter-md">
            <p className="text-body-lg italic text-on-surface">
              &ldquo;{project.customerTestimonial}&rdquo;
            </p>
            <footer className="mt-2 text-label-md font-semibold text-primary">
              —{" "}
              {project.isAnonymized
                ? "Verified Customer"
                : project.customerDisplayName || "Customer"}
            </footer>
          </blockquote>
        )}
      </Card>

      <div className="flex flex-wrap gap-gutter-sm">
        <ButtonLink href="/bulk-enquiry" size="md">
          Request Bulk Quote for Similar Project
        </ButtonLink>
        {waShareUrl && (
          <ButtonLink href={waShareUrl} target="_blank" rel="noopener noreferrer" variant="outline">
            Enquire via WhatsApp
          </ButtonLink>
        )}
      </div>
    </PageContainer>
  );
}

export default function ProjectDetailPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <PageContainer className="space-y-gutter-md py-section-md" aria-busy="true">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-96 w-full" />
        </PageContainer>
      }
    >
      <ProjectDetailContent params={params} />
    </Suspense>
  );
}
