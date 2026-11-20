"use client";

import { PageContainer, PageHeading } from "@/components/common/container";
import { Button } from "@/components/ui/button";
import { useLogBoundaryError } from "@/lib/use-log-error";

export default function AdminError({ error, retry }: { error: unknown; retry: () => void }) {
  useLogBoundaryError("admin", error);
  return (
    <PageContainer>
      <PageHeading
        title="Something went wrong"
        description="This admin page could not be loaded."
      />
      <Button onClick={() => retry()}>Try again</Button>
    </PageContainer>
  );
}
