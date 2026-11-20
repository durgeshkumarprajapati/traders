"use client";

import { PageContainer, PageHeading } from "@/components/common/container";
import { Button } from "@/components/ui/button";
import { useLogBoundaryError } from "@/lib/use-log-error";

/** Error boundary inside the website layout, so the header and footer stay visible. */
export default function WebsiteError({ error, retry }: { error: unknown; retry: () => void }) {
  useLogBoundaryError("website", error);
  return (
    <PageContainer>
      <PageHeading
        title="Something went wrong"
        description="This page could not be loaded. Please try again."
      />
      <Button onClick={() => retry()}>Try again</Button>
    </PageContainer>
  );
}
