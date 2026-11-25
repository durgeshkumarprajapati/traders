import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BookOpen } from "lucide-react";
import { PageContainer } from "@/components/common/container";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/feedback";
import { Breadcrumbs } from "@/components/ui/navigation-aids";
import { KNOWLEDGE_DISCLAIMER } from "@/features/knowledge/default-guides";
import { listPublicKnowledgeArticles } from "@/features/knowledge/server/knowledge";

export const metadata: Metadata = {
  title: "Construction Materials Knowledge Centre",
  description:
    "Simple guides on cement types, TMT steel, bricks vs AAC blocks, material quantities, and safe site storage.",
  alternates: { canonical: "/knowledge" },
};

async function KnowledgeListContent() {
  const articles = await listPublicKnowledgeArticles();

  return (
    <PageContainer className="py-section-md space-y-gutter-lg">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Knowledge Centre" }]} />

      <div className="flex flex-wrap items-end justify-between gap-gutter-md">
        <div>
          <h1 className="text-headline-xl text-primary">Construction Materials Knowledge Centre</h1>
          <p className="mt-1 text-body-lg text-on-surface-variant">
            Plain-language guides to help homeowners, renovators, and builders understand materials
            before ordering.
          </p>
        </div>
        <ButtonLink href="/ask-expert" variant="outline" size="md">
          Ask a Materials Expert
        </ButtonLink>
      </div>

      <p className="rounded bg-surface-muted p-gutter-md text-body-sm text-on-surface-variant">
        {KNOWLEDGE_DISCLAIMER}
      </p>

      <div className="grid grid-cols-1 gap-gutter-md md:grid-cols-2">
        {articles.map((a) => (
          <Card key={a.id} className="flex flex-col justify-between p-gutter-lg space-y-gutter-sm">
            <div>
              <div className="flex flex-wrap items-center gap-gutter-xs">
                <Badge tone="neutral">{a.category}</Badge>
                {a.tags.slice(0, 3).map((t) => (
                  <Badge key={t} tone="info" appearance="outline">
                    {t}
                  </Badge>
                ))}
              </div>
              <h2 className="mt-2 text-title-lg font-bold text-primary">
                <Link href={`/knowledge/${a.slug}`} className="hover:underline">
                  {a.title}
                </Link>
              </h2>
              <p className="mt-1 text-body-md text-on-surface-variant">{a.summary}</p>
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-body-sm text-on-surface-variant">
                Updated {new Date(a.updatedAt).toLocaleDateString("en-IN")}
              </span>
              <ButtonLink href={`/knowledge/${a.slug}`} variant="outline" size="sm">
                <BookOpen aria-hidden className="size-4" />
                Read Guide
              </ButtonLink>
            </div>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}

export default function KnowledgePage() {
  return (
    <Suspense
      fallback={
        <PageContainer className="space-y-gutter-md py-section-md" aria-busy="true">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-64 w-full" />
        </PageContainer>
      }
    >
      <KnowledgeListContent />
    </Suspense>
  );
}
