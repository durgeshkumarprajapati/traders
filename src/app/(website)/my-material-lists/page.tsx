import type { Metadata } from "next";
import { PageContainer, PageHeading } from "@/components/common/container";
import { Breadcrumbs } from "@/components/ui/navigation-aids";
import { MaterialCollection } from "@/components/tools/material-collection";
import { loadCatalogue } from "@/features/catalogue/server";
import { toEnquiryItems } from "@/features/catalogue/view";

// The page itself holds no personal data (lists live in the visitor's browser), but it is a personal workspace: never indexed.
export const metadata: Metadata = {
  title: "My Material Lists",
  description: "Your saved material lists on this device. Re-send a list as an enquiry any time.",
  robots: { index: false, follow: false },
};

export default async function MyMaterialListsPage() {
  const load = await loadCatalogue();
  return (
    <PageContainer className="pb-section-lg">
      <div className="pt-gutter-lg">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Tools", href: "/tools" },
            { label: "My material lists" },
          ]}
        />
      </div>
      <PageHeading
        title="My material lists"
        description="Keep lists such as a monthly requirement or a site's materials, and send one as an enquiry whenever you need it. No account needed."
      />
      <MaterialCollection kind="list" catalogue={load.ok ? toEnquiryItems(load.catalogue) : []} />
    </PageContainer>
  );
}
