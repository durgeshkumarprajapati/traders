"use client";

import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { buildAnalyticsCsv } from "@/features/analytics/calculations";
import type { AnalyticsDashboardData, DateRangePreset } from "@/features/analytics/types";

const PRESETS: { key: DateRangePreset; label: string }[] = [
  { key: "TODAY", label: "Today" },
  { key: "7D", label: "Last 7 days" },
  { key: "30D", label: "Last 30 days" },
  { key: "90D", label: "Last 90 days" },
  { key: "THIS_MONTH", label: "This month" },
  { key: "PREV_MONTH", label: "Previous month" },
];

export function AnalyticsView({ data }: { data: AnalyticsDashboardData }) {
  const router = useRouter();
  const { overview, conversion, topProducts, topBrands, monthlyTrends, attribution } = data;

  function selectPreset(preset: DateRangePreset) {
    router.push(`/admin/analytics?preset=${preset}`);
  }

  function downloadCsv() {
    const csv = buildAnalyticsCsv(
      monthlyTrends.map((m) => ({
        month: m.month,
        enquiries: m.enquiries,
        quotations: m.quotations,
        confirmed_enquiries: m.confirmedEnquiries,
        completed_orders: m.completedOrders,
        new_customers: m.newCustomers,
      })),
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sagar-traders-analytics-${data.preset.toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const maxTrend = Math.max(1, ...monthlyTrends.map((m) => m.enquiries));

  return (
    <div className="space-y-gutter-lg">
      <div className="flex flex-wrap items-center justify-between gap-gutter-md">
        <div>
          <h1 className="text-headline-lg text-primary">Business Analytics</h1>
          <p className="text-body-md text-on-surface-variant">
            Real database metrics ({new Date(data.fromIso).toLocaleDateString("en-IN")} –{" "}
            {new Date(data.toIso).toLocaleDateString("en-IN")}).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadCsv}>
          <Download aria-hidden className="size-4" />
          Export Monthly CSV
        </Button>
      </div>

      <div className="flex flex-wrap gap-gutter-xs">
        {PRESETS.map((p) => (
          <Button
            key={p.key}
            size="sm"
            variant={data.preset === p.key ? "primary" : "outline"}
            onClick={() => selectPreset(p.key)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {/* Overview KPIs */}
      <div className="grid grid-cols-2 gap-gutter-sm sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: "Total Enquiries", value: overview.totalEnquiries },
          { label: "New", value: overview.newEnquiries },
          { label: "Contacted", value: overview.contactedEnquiries },
          { label: "Quotation Sent", value: overview.quotationsIssuedEnquiries },
          { label: "Confirmed", value: overview.confirmedEnquiries },
          { label: "Completed", value: overview.completedEnquiries },
          { label: "Cancelled", value: overview.cancelledEnquiries },
          { label: "Total Customers", value: overview.totalCustomers },
          { label: "New Customers", value: overview.newCustomers },
          { label: "Repeat Customers", value: overview.repeatCustomers },
          { label: "Total Quotations", value: overview.totalQuotations },
          { label: "Accepted Quotations", value: overview.acceptedQuotations },
          { label: "Pending Responses", value: overview.pendingQuotationResponses },
          { label: "Total Orders", value: overview.totalOrders },
          { label: "Delivered Orders", value: overview.completedOrders },
        ].map((k) => (
          <Card key={k.label} className="p-gutter-md">
            <p className="text-body-sm text-on-surface-variant">{k.label}</p>
            <p className="mt-1 text-headline-md font-bold text-primary tabular-nums">{k.value}</p>
          </Card>
        ))}
      </div>

      {/* Conversion Funnel */}
      <Card className="p-gutter-md">
        <h2 className="text-headline-sm text-primary">Enquiry Conversion Funnel</h2>
        <p className="text-body-sm text-on-surface-variant">
          Distinct non-cancelled enquiries ({conversion.activeEnquiriesDenominator}) — revisions are
          never double-counted.
        </p>
        <div className="mt-gutter-md grid grid-cols-1 gap-gutter-sm sm:grid-cols-4">
          <div className="rounded bg-surface-muted p-3">
            <p className="text-body-sm text-on-surface-variant">Enquiry → Quotation</p>
            <p className="text-headline-md font-bold text-primary tabular-nums">
              {conversion.enquiryToQuotationRate}%
            </p>
          </div>
          <div className="rounded bg-surface-muted p-3">
            <p className="text-body-sm text-on-surface-variant">Quotation → Confirmation</p>
            <p className="text-headline-md font-bold text-primary tabular-nums">
              {conversion.quotationToConfirmationRate}%
            </p>
          </div>
          <div className="rounded bg-surface-muted p-3">
            <p className="text-body-sm text-on-surface-variant">Confirmation → Completion</p>
            <p className="text-headline-md font-bold text-primary tabular-nums">
              {conversion.confirmationToCompletionRate}%
            </p>
          </div>
          <div className="rounded bg-surface-muted p-3">
            <p className="text-body-sm text-on-surface-variant">Overall Conversion</p>
            <p className="text-headline-md font-bold text-success tabular-nums">
              {conversion.overallConversionRate}%
            </p>
          </div>
        </div>
      </Card>

      {/* Monthly Trends (Responsive bar visualization) */}
      <Card className="p-gutter-md">
        <h2 className="text-headline-sm text-primary">6-Month Activity Trends</h2>
        <div className="mt-gutter-md space-y-3">
          {monthlyTrends.map((m) => {
            const pct = Math.round((m.enquiries / maxTrend) * 100);
            return (
              <div key={m.month} className="space-y-1">
                <div className="flex flex-wrap justify-between text-body-sm">
                  <span className="font-semibold text-on-surface tabular-nums">{m.month}</span>
                  <span className="text-on-surface-variant tabular-nums">
                    {m.enquiries} enquiries • {m.quotations} quotes • {m.confirmedEnquiries}{" "}
                    confirmed • {m.completedOrders} delivered
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-gutter-lg lg:grid-cols-2">
        {/* Product Enquiry Interest */}
        <Card className="p-gutter-md">
          <h2 className="text-headline-sm text-primary">Most-Enquired Products</h2>
          <p className="text-body-sm text-on-surface-variant">
            Enquiry demand only (not confirmed sales volume).
          </p>
          {topProducts.length === 0 ? (
            <p className="mt-3 text-body-md text-on-surface-variant">No product enquiries in range.</p>
          ) : (
            <ul className="mt-gutter-sm divide-y divide-border text-body-sm">
              {topProducts.map((p) => (
                <li key={p.productId} className="flex items-center justify-between gap-2 py-2">
                  <span className="truncate font-medium text-on-surface">
                    {p.productName}
                    {p.brandName ? ` (${p.brandName})` : ""}
                  </span>
                  <span className="shrink-0 text-on-surface-variant tabular-nums">
                    {p.enquiryCount} enq • Qty {p.totalQuantity}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Brands & Attribution Sources */}
        <div className="space-y-gutter-lg">
          <Card className="p-gutter-md">
            <h2 className="text-headline-sm text-primary">Most-Requested Brands</h2>
            {topBrands.length === 0 ? (
              <p className="mt-3 text-body-md text-on-surface-variant">No brand data in range.</p>
            ) : (
              <div className="mt-gutter-sm flex flex-wrap gap-2">
                {topBrands.map((b) => (
                  <Badge key={b.brandName} tone="neutral">
                    {b.brandName}: {b.enquiryCount}
                  </Badge>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-gutter-md">
            <h2 className="text-headline-sm text-primary">Acquisition Sources</h2>
            {attribution.length === 0 ? (
              <p className="mt-3 text-body-md text-on-surface-variant">
                No attribution records in this period.
              </p>
            ) : (
              <ul className="mt-gutter-sm divide-y divide-border text-body-sm">
                {attribution.map((a) => (
                  <li key={a.source} className="flex justify-between py-2">
                    <span className="font-medium text-on-surface">{a.source.replace(/_/g, " ")}</span>
                    <span className="font-semibold text-primary tabular-nums">{a.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
