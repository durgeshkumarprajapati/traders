import { PageContainer, PageHeading } from "@/components/common/container";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
      <PageContainer>
        <PageHeading title="Page not found" description="The page you requested does not exist." />
        <div className="flex flex-wrap gap-gutter-sm pb-section-md">
          <ButtonLink href="/products">Browse products</ButtonLink>
          <ButtonLink href="/" variant="outline">
            Back to home
          </ButtonLink>
        </div>
      </PageContainer>
    </main>
  );
}
