import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectForm } from "@/components/admin/project-form";
import { getAdminProjectById } from "@/features/projects/server/projects";

export const metadata = {
  title: "Edit Project | Admin | Sagar Traders",
  robots: { index: false, follow: false },
};

export default async function AdminEditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getAdminProjectById(id);
  if (!project) notFound();

  return (
    <div className="space-y-gutter-md">
      <Link href="/admin/projects" className="text-label-md text-primary hover:underline">
        ← Back to Projects
      </Link>
      <h1 className="text-headline-lg text-primary">Edit: {project.title}</h1>
      <ProjectForm project={project} />
    </div>
  );
}
