import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageContainer } from "@/components/common/container";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/feedback";
import { Breadcrumbs } from "@/components/ui/navigation-aids";
import { loadSettings } from "@/features/catalogue/server";
import { KNOWLEDGE_DISCLAIMER } from "@/features/knowledge/default-guides";
import {
  getPublicKnowledgeArticleBySlug,
  listPublicKnowledgeArticles,
} from "@/features/knowledge/server/knowledge";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublicKnowledgeArticleBySlug(slug);
  if (!article) return { title: "Guide Not Found" };

  return {
    title: article.title,
    description: article.summary,
    alternates: { canonical: `/knowledge/${article.slug}` },
    openGraph: {
      title: article.title,
      description: article.summary,
      type: "article",
      url: `/knowledge/${article.slug}`,
    },
  };
}

async function KnowledgeDetailContent({ params }: Props) {
  const { slug } = await params;
  const [article, allArticles, settings] = await Promise.all([
    getPublicKnowledgeArticleBySlug(slug),
    listPublicKnowledgeArticles(),
    loadSettings(),
  ]);
  if (!article) notFound();

  const related = allArticles.filter((a) => a.slug !== article.slug).slice(0, 3);
  const waHref = buildWhatsAppUrl(
    settings.whatsappNumber,
    `Hello ${settings.name}, I read your guide "${article.title}" and would like help choosing materials.`,
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.summary,
    datePublished: article.publishedAt ?? article.createdAt,
    dateModified: article.updatedAt,
    publisher: { "@type": "Organization", name: settings.name },
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
          { label: "Knowledge Centre", href: "/knowledge" },
          { label: article.title },
        ]}
      />

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{article.category}</Badge>
          <span className="text-body-sm text-on-surface-variant">
            Last updated: {new Date(article.updatedAt).toLocaleDateString("en-IN")}
          </span>
        </div>
        <h1 className="text-headline-xl text-primary">{article.title}</h1>
        <p className="text-body-lg text-on-surface-variant">{article.summary}</p>
      </div>

      <Card className="p-gutter-lg space-y-gutter-md">
        <div className="whitespace-pre-line text-body-lg text-on-surface">{article.body}</div>
        <p className="rounded bg-surface-muted p-gutter-md text-body-sm text-on-surface-variant">
          {KNOWLEDGE_DISCLAIMER}
        </p>
      </Card>

      <div className="flex flex-wrap gap-gutter-sm">
        <ButtonLink href="/products" size="md">
          Browse Materials
        </ButtonLink>
        <ButtonLink href="/tools/cost-estimator" variant="outline" size="md">
          Estimate Quantities
        </ButtonLink>
        {waHref && (
          <ButtonLink href={waHref} target="_blank" rel="noopener noreferrer" variant="outline" size="md">
            Ask on WhatsApp
          </ButtonLink>
        )}
      </div>

      {related.length > 0 && (
        <section className="space-y-gutter-sm border-t border-border pt-gutter-lg">
          <h2 className="text-headline-sm text-primary">Related Guides</h2>
          <div className="grid grid-cols-1 gap-gutter-sm sm:grid-cols-3">
            {related.map((r) => (
              <Card key={r.id} className="p-gutter-md">
                <Link href={`/knowledge/${r.slug}`} className="text-title-md font-semibold text-primary hover:underline">
                  {r.title}
                </Link>
                <p className="mt-1 text-body-sm text-on-surface-variant">{r.category}</p>
              </Card>
            ))}
          </div>
        </section>
      )}
    </PageContainer>
  );
}

export default function KnowledgeArticlePage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <PageContainer className="space-y-gutter-md py-section-md" aria-busy="true">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-64 w-full" />
        </PageContainer>
      }
    >
      <KnowledgeDetailContent params={params} />
    </Suspense>
  );
}
