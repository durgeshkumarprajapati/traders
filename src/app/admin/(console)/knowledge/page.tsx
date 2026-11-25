import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listAdminKnowledgeArticles } from "@/features/knowledge/server/knowledge";

export const metadata = {
  title: "Knowledge Centre | Admin | Sagar Traders",
  robots: { index: false, follow: false },
};

export default async function AdminKnowledgePage() {
  const articles = await listAdminKnowledgeArticles();

  return (
    <div className="space-y-gutter-lg">
      <div className="flex flex-wrap items-center justify-between gap-gutter-md">
        <div>
          <h1 className="text-headline-lg text-primary">Knowledge Centre Articles</h1>
          <p className="text-body-md text-on-surface-variant">
            Manage educational guides for homeowners, renovators, and contractors.
          </p>
        </div>
        <ButtonLink href="/admin/knowledge/new" size="md">
          <Plus aria-hidden className="size-4" />
          New Article
        </ButtonLink>
      </div>

      {articles.length === 0 ? (
        <Card className="p-gutter-xl text-center">
          <p className="text-title-md text-on-surface">
            No custom articles yet (built-in verified guides are active on /knowledge).
          </p>
        </Card>
      ) : (
        <div className="space-y-gutter-sm">
          {articles.map((a) => (
            <Card key={a.id} className="p-gutter-md flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/knowledge/${a.id}/edit`}
                    className="text-title-md font-semibold text-primary hover:underline"
                  >
                    {a.title}
                  </Link>
                  <Badge tone={a.status === "PUBLISHED" ? "success" : "neutral"}>{a.status}</Badge>
                </div>
                <p className="text-body-sm text-on-surface-variant">
                  /knowledge/{a.slug} • {a.category}
                </p>
              </div>
              <ButtonLink href={`/admin/knowledge/${a.id}/edit`} variant="outline" size="sm">
                Edit
              </ButtonLink>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
