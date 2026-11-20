import { DashboardView } from "@/components/admin/dashboard-view";
import { loadAdminDashboardData } from "@/features/admin/server/dashboard";

export const metadata = {
  title: "Admin Dashboard | Sagar Traders",
  robots: { index: false, follow: false },
};

export default async function AdminDashboardPage() {
  const data = await loadAdminDashboardData();

  return <DashboardView data={data} />;
}
