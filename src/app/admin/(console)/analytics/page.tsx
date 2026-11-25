import { AnalyticsView } from "@/components/admin/analytics-view";
import { loadAnalyticsDashboard } from "@/features/analytics/server/analytics";
import type { DateRangePreset } from "@/features/analytics/types";

export const metadata = {
  title: "Business Analytics | Admin | Sagar Traders",
  robots: { index: false, follow: false },
};

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const preset = (sp.preset as DateRangePreset) ?? "30D";
  const data = await loadAnalyticsDashboard({
    preset,
    from: sp.from,
    to: sp.to,
  });

  return <AnalyticsView data={data} />;
}
