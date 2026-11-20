import { PageContainer, PageHeading } from "@/components/common/container";
import { ButtonLink } from "@/components/ui/button";

export default function WebsiteNotFound() {
  return (
    <PageContainer>
      <PageHeading
        title="Page not found"
        description="The page or product you requested does not exist or is no longer available."
      />
      <div className="flex flex-wrap gap-gutter-sm pb-section-md">
        <ButtonLink href="/products">Browse products</ButtonLink>
        <ButtonLink href="/" variant="outline">
          Back to home
        </ButtonLink>
      </div>
    </PageContainer>
  );
}
