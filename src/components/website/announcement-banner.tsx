import { PageContainer } from "@/components/common/container";

/** Optional site-wide announcement (from business settings). White surface with an amber accent rule. */
export function AnnouncementBanner({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div role="region" aria-label="Announcement" className="border-b-2 border-secondary bg-surface">
      <PageContainer className="py-gutter-sm text-center text-label-lg">{text}</PageContainer>
    </div>
  );
}
