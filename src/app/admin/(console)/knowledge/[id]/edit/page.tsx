import Link from "next/link";
import { notFound } from "next/navigation";
import { KnowledgeForm } from "@/components/admin/knowledge-form";
import { getAdminKnowledgeArticleById } from "@/features/knowledge/server/knowledge";

export const metadata = {
  title: "Edit Article | Admin | Sagar Traders",
  robots: { index: false, follow: false },
};

export default async function AdminEditKnowledgePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const article = await getAdminKnowledgeArticleById(id);
  if (!article) notFound();

  return (
    <div className="space-y-gutter-md">
      <Link href="/admin/knowledge" className="text-label-md text-primary hover:underline">
        ← Back to Knowledge Centre
      </Link>
      <h1 className="text-headline-lg text-primary">Edit: {article.title}</h1>
      <KnowledgeForm article={article} />
    </div>
  );
}
