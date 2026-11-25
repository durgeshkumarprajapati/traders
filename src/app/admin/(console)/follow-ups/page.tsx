import { CrmFollowupsView } from "@/components/admin/crm-followups-view";
import { listFollowups } from "@/features/crm/server/crm";
import type { FollowupPriority } from "@/features/crm/types";

export const metadata = {
  title: "Follow-ups | Admin | Sagar Traders",
  robots: { index: false, follow: false },
};

export default async function AdminFollowupsPage({
  searchParams,
}: {
  searchParams: Promise<{ bucket?: string; priority?: string; search?: string }>;
}) {
  const sp = await searchParams;
  const bucket =
    (sp.bucket as "ALL" | "TODAY" | "OVERDUE" | "UPCOMING" | "COMPLETED") ?? "ALL";
  const priority = (sp.priority as FollowupPriority | "ALL") ?? "ALL";
  const search = sp.search ?? "";

  const items = await listFollowups({ bucket, priority, search });

  return (
    <CrmFollowupsView
      items={items}
      bucket={bucket}
      priority={priority}
      search={search}
      nowIso={new Date().toISOString()}
    />
  );
}
