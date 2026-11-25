import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { computeConversionMetrics, resolveDateRange } from "../calculations";
import {
  ATTRIBUTION_SOURCES,
  type AnalyticsDashboardData,
  type AttributionSource,
  type DateRangePreset,
  type MonthlyTrendPoint,
} from "../types";

export async function loadAnalyticsDashboard(
  input: { preset?: DateRangePreset; from?: string; to?: string } = {},
  clientOverride?: SupabaseClient,
): Promise<AnalyticsDashboardData> {
  const supabase = clientOverride ?? (await createSupabaseServerClient());
  const preset: DateRangePreset = input.preset ?? "30D";
  const { from, to } = resolveDateRange(preset, input.from, input.to);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  // Trend window: last 6 calendar months
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();

  const [
    { data: enqRows },
    { data: quoRows },
    { data: ordRows },
    { data: custRows },
    { data: itemRows },
    { data: attrRows },
    { data: trendEnqs },
    { data: trendQuos },
    { data: trendOrds },
  ] = await Promise.all([
    supabase
      .from("enquiries")
      .select("id, status, customer_id, created_at")
      .gte("created_at", fromIso)
      .lte("created_at", toIso),
    supabase
      .from("quotations")
      .select("id, enquiry_id, status, created_at")
      .gte("created_at", fromIso)
      .lte("created_at", toIso),
    supabase
      .from("orders")
      .select("id, status, created_at")
      .gte("created_at", fromIso)
      .lte("created_at", toIso),
    supabase.from("customers").select("id, created_at").is("merged_into_id", null),
    supabase
      .from("enquiry_items")
      .select("product_id, product_name, brand_name, quantity, enquiry_id, created_at")
      .gte("created_at", fromIso)
      .lte("created_at", toIso),
    supabase
      .from("acquisition_attributions")
      .select("source, created_at")
      .gte("created_at", fromIso)
      .lte("created_at", toIso),
    supabase
      .from("enquiries")
      .select("id, status, customer_id, created_at")
      .gte("created_at", sixMonthsAgo),
    supabase.from("quotations").select("id, enquiry_id, status, created_at").gte("created_at", sixMonthsAgo),
    supabase.from("orders").select("id, status, created_at").gte("created_at", sixMonthsAgo),
  ]);

  const enquiries = enqRows ?? [];
  const quotations = quoRows ?? [];
  const orders = ordRows ?? [];
  const customers = custRows ?? [];

  const newCustomers = customers.filter(
    (c) => c.created_at >= fromIso && c.created_at <= toIso,
  ).length;

  // Repeat customers = customers with >1 enquiry in the system or >1 confirmed order
  const enqsByCust: Record<string, number> = {};
  for (const e of trendEnqs ?? enquiries) {
    if (e.customer_id) enqsByCust[e.customer_id] = (enqsByCust[e.customer_id] ?? 0) + 1;
  }
  const repeatCustomers = Object.values(enqsByCust).filter((n) => n > 1).length;

  const nonCancelled = enquiries.filter((e) => e.status !== "CANCELLED");
  const quotedEnqIds = quotations
    .filter((q) => q.status !== "DRAFT")
    .map((q) => String(q.enquiry_id));
  const confirmedEnqIds = nonCancelled
    .filter((e) => e.status === "CONFIRMED")
    .map((e) => String(e.id));
  const completedEnqIds = nonCancelled
    .filter((e) => e.status === "COMPLETED")
    .map((e) => String(e.id));

  const conversion = computeConversionMetrics({
    nonCancelledEnquiryIds: nonCancelled.map((e) => String(e.id)),
    quotedEnquiryIds: quotedEnqIds,
    confirmedEnquiryIds: confirmedEnqIds,
    completedEnquiryIds: completedEnqIds,
  });

  // Product & Brand enquiry aggregation
  const prodMap = new Map<
    string,
    { productId: string; productName: string; brandName: string | null; enqIds: Set<string>; totalQty: number }
  >();
  const brandMap = new Map<string, Set<string>>();

  for (const it of itemRows ?? []) {
    const pid = String(it.product_id);
    const entry = prodMap.get(pid) ?? {
      productId: pid,
      productName: String(it.product_name),
      brandName: (it.brand_name as string) || null,
      enqIds: new Set<string>(),
      totalQty: 0,
    };
    entry.enqIds.add(String(it.enquiry_id));
    entry.totalQty += Number(it.quantity ?? 0);
    prodMap.set(pid, entry);

    if (it.brand_name) {
      const bName = String(it.brand_name);
      const bSet = brandMap.get(bName) ?? new Set<string>();
      bSet.add(String(it.enquiry_id));
      brandMap.set(bName, bSet);
    }
  }

  const topProducts = [...prodMap.values()]
    .map((p) => ({
      productId: p.productId,
      productName: p.productName,
      brandName: p.brandName,
      enquiryCount: p.enqIds.size,
      totalQuantity: Math.round(p.totalQty * 100) / 100,
    }))
    .sort((a, b) => b.enquiryCount - a.enquiryCount)
    .slice(0, 10);

  const topBrands = [...brandMap.entries()]
    .map(([brandName, set]) => ({ brandName, enquiryCount: set.size }))
    .sort((a, b) => b.enquiryCount - a.enquiryCount)
    .slice(0, 8);

  // Attribution summary
  const attrCounts = new Map<AttributionSource, number>();
  for (const s of ATTRIBUTION_SOURCES) attrCounts.set(s, 0);
  for (const a of attrRows ?? []) {
    const src = String(a.source) as AttributionSource;
    attrCounts.set(src, (attrCounts.get(src) ?? 0) + 1);
  }
  const attribution = ATTRIBUTION_SOURCES.map((source) => ({
    source,
    count: attrCounts.get(source) ?? 0,
  })).filter((r) => r.count > 0);

  // Monthly trends (6 months)
  const monthBuckets = new Map<string, MonthlyTrendPoint>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthBuckets.set(key, {
      month: key,
      enquiries: 0,
      quotations: 0,
      confirmedEnquiries: 0,
      completedOrders: 0,
      newCustomers: 0,
      repeatCustomers: 0,
    });
  }
  for (const e of trendEnqs ?? []) {
    const key = String(e.created_at).slice(0, 7);
    const b = monthBuckets.get(key);
    if (b) {
      b.enquiries += 1;
      if (e.status === "CONFIRMED" || e.status === "COMPLETED") b.confirmedEnquiries += 1;
    }
  }
  for (const q of trendQuos ?? []) {
    const key = String(q.created_at).slice(0, 7);
    const b = monthBuckets.get(key);
    if (b && q.status !== "DRAFT") b.quotations += 1;
  }
  for (const o of trendOrds ?? []) {
    const key = String(o.created_at).slice(0, 7);
    const b = monthBuckets.get(key);
    if (b && o.status === "DELIVERED") b.completedOrders += 1;
  }
  for (const c of customers) {
    const key = String(c.created_at).slice(0, 7);
    const b = monthBuckets.get(key);
    if (b) b.newCustomers += 1;
  }

  return {
    preset,
    fromIso,
    toIso,
    overview: {
      totalEnquiries: enquiries.length,
      newEnquiries: enquiries.filter((e) => e.status === "NEW").length,
      contactedEnquiries: enquiries.filter((e) => e.status === "CONTACTED").length,
      quotationsIssuedEnquiries: enquiries.filter((e) => e.status === "QUOTATION_SENT").length,
      confirmedEnquiries: enquiries.filter((e) => e.status === "CONFIRMED").length,
      completedEnquiries: enquiries.filter((e) => e.status === "COMPLETED").length,
      cancelledEnquiries: enquiries.filter((e) => e.status === "CANCELLED").length,
      totalCustomers: customers.length,
      newCustomers,
      repeatCustomers,
      totalQuotations: quotations.length,
      acceptedQuotations: quotations.filter((q) => q.status === "ACCEPTED").length,
      pendingQuotationResponses: quotations.filter((q) => q.status === "ISSUED").length,
      totalOrders: orders.length,
      completedOrders: orders.filter((o) => o.status === "DELIVERED").length,
    },
    conversion,
    topProducts,
    topBrands,
    monthlyTrends: [...monthBuckets.values()],
    attribution,
  };
}
