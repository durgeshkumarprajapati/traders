import type { Metadata } from "next";
import { Suspense } from "react";
import { PageBodySkeleton } from "@/components/common/page-skeleton";
import { PageContainer, PageHeading } from "@/components/common/container";
import { Breadcrumbs } from "@/components/ui/navigation-aids";
import { MaterialCollection } from "@/components/tools/material-collection";
import { loadCatalogue } from "@/features/catalogue/server";
import { toEnquiryItems } from "@/features/catalogue/view";

export const metadata: Metadata = {
  title: "Project Material Planner",
  description:
    "Plan a construction project's material checklist, keep several projects on your device, and send the list to Sagar Traders as an enquiry. No account needed.",
  alternates: { canonical: "/tools/project-planner" },
};

async function PlannerBody() {
  const load = await loadCatalogue();
  return (
    <MaterialCollection kind="project" catalogue={load.ok ? toEnquiryItems(load.catalogue) : []} />
  );
}

export default function ProjectPlannerPage() {
  return (
    <PageContainer className="pb-section-lg">
      <div className="pt-gutter-lg">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Tools", href: "/tools" },
            { label: "Project planner" },
          ]}
        />
      </div>
      <PageHeading
        title="Project material planner"
        description="Build a material checklist for a house, room, boundary wall or renovation. It is a planning checklist, not a complete bill of quantities."
      />
      <Suspense fallback={<PageBodySkeleton />}>
        <PlannerBody />
      </Suspense>
    </PageContainer>
  );
}
