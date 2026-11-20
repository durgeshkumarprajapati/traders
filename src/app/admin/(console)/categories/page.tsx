import { PageContainer, PageHeading } from "@/components/common/container";
import { placeholderMetadata } from "@/components/common/placeholder-page";
import { Notification } from "@/components/ui/notification";
import { Tabs } from "@/components/ui/tabs";

export const metadata = placeholderMetadata("Categories & Brands");

function Panel({ what }: { what: string }) {
  return (
    <Notification tone="warning" title="Placeholder">
      {what} management is not final content. It is implemented in Phase 9.
    </Notification>
  );
}

export default function Page() {
  return (
    <PageContainer>
      <PageHeading title="Categories & Brands" description="Catalogue taxonomy." />
      <Tabs
        label="Categories and Brands"
        items={[
          { id: "categories", label: "Categories", content: <Panel what="Category" /> },
          { id: "brands", label: "Brands", content: <Panel what="Brand" /> },
        ]}
      />
    </PageContainer>
  );
}
