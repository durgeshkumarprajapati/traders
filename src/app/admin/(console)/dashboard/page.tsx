import Link from "next/link";
import { Bell } from "lucide-react";
import { DashboardView } from "@/components/admin/dashboard-view";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { loadAdminDashboardData } from "@/features/admin/server/dashboard";
import { getDashboardFollowupReminders } from "@/features/crm/server/crm";

export const metadata = {
  title: "Admin Dashboard | Sagar Traders",
  robots: { index: false, follow: false },
};

export default async function AdminDashboardPage() {
  const [data, reminders] = await Promise.all([
    loadAdminDashboardData(),
    getDashboardFollowupReminders().catch(() => ({ overdueCount: 0, todayCount: 0, items: [] })),
  ]);

  return (
    <div className="space-y-gutter-lg">
      {(reminders.overdueCount > 0 || reminders.todayCount > 0) && (
        <Card className="border border-warning/40 bg-warning/10 p-gutter-md">
          <div className="flex flex-wrap items-center justify-between gap-gutter-sm">
            <div className="flex items-center gap-2">
              <Bell aria-hidden className="size-5 text-warning" />
              <span className="text-title-md font-semibold text-on-surface">
                Follow-up Reminders:
              </span>
              {reminders.overdueCount > 0 && (
                <Badge tone="error">{reminders.overdueCount} overdue</Badge>
              )}
              {reminders.todayCount > 0 && (
                <Badge tone="warning">{reminders.todayCount} due today</Badge>
              )}
            </div>
            <ButtonLink href="/admin/follow-ups" size="sm" variant="outline">
              View All Follow-ups
            </ButtonLink>
          </div>
          {reminders.items.length > 0 && (
            <ul className="mt-2 space-y-1 text-body-sm text-on-surface">
              {reminders.items.map((r) => (
                <li key={r.id}>
                  <Link href={`/admin/customers/${r.customerId}`} className="font-medium text-primary hover:underline">
                    {r.customerName ?? "Customer"}
                  </Link>{" "}
                  — {r.title} ({new Date(r.dueAt).toLocaleString("en-IN")})
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
      <DashboardView data={data} />
    </div>
  );
}
