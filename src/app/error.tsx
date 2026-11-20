"use client";

import { PageContainer, PageHeading } from "@/components/common/container";
import { Button } from "@/components/ui/button";
import { useLogBoundaryError } from "@/lib/use-log-error";

/** Next 16 error boundary: `retry` re-fetches and re-renders (preferred over `reset`). */
export default function RouteError({ error, retry }: { error: unknown; retry: () => void }) {
  useLogBoundaryError("app", error);
  return (
    <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
      <PageContainer>
        <PageHeading title="Something went wrong" description="Please try again." />
        <Button onClick={() => retry()}>Try again</Button>
      </PageContainer>
    </main>
  );
}
