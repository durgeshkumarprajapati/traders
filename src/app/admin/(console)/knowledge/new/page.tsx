import Link from "next/link";
import { KnowledgeForm } from "@/components/admin/knowledge-form";

export const metadata = {
  title: "New Article | Admin | Sagar Traders",
  robots: { index: false, follow: false },
};

export default function AdminNewKnowledgePage() {
  return (
    <div className="space-y-gutter-md">
      <Link href="/admin/knowledge" className="text-label-md text-primary hover:underline">
        ← Back to Knowledge Centre
      </Link>
      <h1 className="text-headline-lg text-primary">New Knowledge Article</h1>
      <KnowledgeForm />
    </div>
  );
}
