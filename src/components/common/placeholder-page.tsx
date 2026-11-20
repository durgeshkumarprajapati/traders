import type { Metadata } from "next";
import { Notification } from "@/components/ui/notification";
import { PageContainer, PageHeading } from "./container";

/** Metadata for placeholder routes: never indexed, so a stub cannot appear in search results. */
export function placeholderMetadata(title: string): Metadata {
  return { title, robots: { index: false, follow: false } };
}

/**
 * Visible placeholder used by routes whose real implementation is a later phase.
 * It states plainly that the page is not final so it cannot be mistaken for production content.
 */
export function PlaceholderPage({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <PageContainer>
      <PageHeading title={title} description={description} />
      <Notification tone="warning" title="Placeholder page">
        This page is not final content. It is implemented in {phase}.
      </Notification>
    </PageContainer>
  );
}
