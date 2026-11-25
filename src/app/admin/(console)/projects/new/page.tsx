import Link from "next/link";
import { ProjectForm } from "@/components/admin/project-form";

export const metadata = {
  title: "New Project | Admin | Sagar Traders",
  robots: { index: false, follow: false },
};

export default function AdminNewProjectPage() {
  return (
    <div className="space-y-gutter-md">
      <Link href="/admin/projects" className="text-label-md text-primary hover:underline">
        ← Back to Projects
      </Link>
      <h1 className="text-headline-lg text-primary">New Showcase Project</h1>
      <ProjectForm />
    </div>
  );
}
