import { PageContainer, PageHeading } from "@/components/common/container";
import { ButtonLink } from "@/components/ui/button";

export default function AdminNotFound() {
  return (
    <PageContainer>
      <PageHeading title="Not found" description="That admin page or record does not exist." />
      <ButtonLink href="/admin/dashboard">Back to dashboard</ButtonLink>
    </PageContainer>
  );
}
