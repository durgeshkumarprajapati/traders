import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listAdminProjects } from "@/features/projects/server/projects";

export const metadata = {
  title: "Project Showcase | Admin | Sagar Traders",
  robots: { index: false, follow: false },
};

export default async function AdminProjectsPage() {
  const projects = await listAdminProjects();

  return (
    <div className="space-y-gutter-lg">
      <div className="flex flex-wrap items-center justify-between gap-gutter-md">
        <div>
          <h1 className="text-headline-lg text-primary">Project Showcase</h1>
          <p className="text-body-md text-on-surface-variant">
            Publish verified construction projects and consented customer stories.
          </p>
        </div>
        <ButtonLink href="/admin/projects/new" size="md">
          <Plus aria-hidden className="size-4" />
          New Project
        </ButtonLink>
      </div>

      {projects.length === 0 ? (
        <Card className="p-gutter-xl text-center">
          <p className="text-title-md text-on-surface">No projects added yet</p>
        </Card>
      ) : (
        <div className="space-y-gutter-sm">
          {projects.map((p) => (
            <Card key={p.id} className="p-gutter-md">
              <div className="flex flex-wrap items-center justify-between gap-gutter-md">
                <div>
                  <div className="flex flex-wrap items-center gap-gutter-xs">
                    <Link
                      href={`/admin/projects/${p.id}/edit`}
                      className="text-title-lg font-semibold text-primary hover:underline"
                    >
                      {p.title}
                    </Link>
                    <Badge tone={p.status === "PUBLISHED" ? "success" : "neutral"}>
                      {p.status}
                    </Badge>
                  </div>
                  <p className="text-body-sm text-on-surface-variant">
                    /{p.slug} • {p.category}
                    {p.location ? ` • ${p.location}` : ""}
                  </p>
                </div>
                <ButtonLink href={`/admin/projects/${p.id}/edit`} variant="outline" size="sm">
                  Edit
                </ButtonLink>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
