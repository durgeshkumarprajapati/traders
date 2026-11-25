import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  CustomerFollowup,
  CustomerInteraction,
  CustomerListFilter,
  CustomerNote,
  CustomerRecord,
  CustomerSummary,
  CustomerTimelineEvent,
  FollowupPriority,
  FollowupStatus,
} from "../types";

function mapCustomerRow(r: Record<string, unknown>): CustomerRecord {
  return {
    id: String(r.id),
    name: String(r.name),
    mobile: String(r.mobile),
    rawMobile: (r.raw_mobile as string) || null,
    email: (r.email as string) || null,
    companyName: (r.company_name as string) || null,
    address: (r.address as string) || null,
    customerType: String(r.customer_type) as CustomerRecord["customerType"],
    relationshipTier: String(r.relationship_tier) as CustomerRecord["relationshipTier"],
    isContractor: Boolean(r.is_contractor),
    contractorClassification: (r.contractor_classification as string) || null,
    serviceArea: (r.service_area as string) || null,
    preferredCategories: Array.isArray(r.preferred_categories)
      ? r.preferred_categories.map(String)
      : [],
    preferredBrands: Array.isArray(r.preferred_brands) ? r.preferred_brands.map(String) : [],
    relationshipManagerId: (r.relationship_manager_id as string) || null,
    programmeStatus: String(r.programme_status) as CustomerRecord["programmeStatus"],
    lifecycleStatus: String(r.lifecycle_status) as CustomerRecord["lifecycleStatus"],
    whatsappOptIn: Boolean(r.whatsapp_opt_in),
    firstInteractionAt: String(r.first_interaction_at),
    lastInteractionAt: String(r.last_interaction_at),
    mergedIntoId: (r.merged_into_id as string) || null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export async function listCustomers(
  filter: CustomerListFilter = {},
  clientOverride?: SupabaseClient,
): Promise<{ items: CustomerSummary[]; total: number; page: number; pageSize: number }> {
  const supabase = clientOverride ?? (await createSupabaseServerClient());
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(50, Math.max(5, filter.pageSize ?? 20));

  let query = supabase
    .from("customers")
    .select("*", { count: "exact" })
    .is("merged_into_id", null)
    .order("last_interaction_at", { ascending: false });

  if (filter.customerType && filter.customerType !== "ALL") {
    query = query.eq("customer_type", filter.customerType);
  }
  if (filter.search?.trim()) {
    const q = filter.search.trim().replace(/[,%()]/g, "");
    if (q) {
      query = query.or(
        `name.ilike.%${q}%,mobile.ilike.%${q}%,email.ilike.%${q}%,company_name.ilike.%${q}%`,
      );
    }
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data: rows, count, error } = await query.range(from, to);

  if (error || !rows) {
    logger.error("crm_list_customers_failed", { error: error?.message });
    return { items: [], total: 0, page, pageSize };
  }

  const customerIds = rows.map((r: { id: string }) => r.id);
  const enqCounts: Record<string, number> = {};
  const quoCounts: Record<string, number> = {};
  const ordCounts: Record<string, number> = {};
  const confirmedOrdCounts: Record<string, number> = {};

  if (customerIds.length > 0) {
    const [{ data: enqs }, { data: quos }, { data: ords }] = await Promise.all([
      supabase.from("enquiries").select("customer_id").in("customer_id", customerIds),
      supabase.from("quotations").select("customer_id").in("customer_id", customerIds),
      supabase.from("orders").select("customer_id, status").in("customer_id", customerIds),
    ]);
    for (const e of enqs ?? []) {
      if (e.customer_id) enqCounts[e.customer_id] = (enqCounts[e.customer_id] ?? 0) + 1;
    }
    for (const q of quos ?? []) {
      if (q.customer_id) quoCounts[q.customer_id] = (quoCounts[q.customer_id] ?? 0) + 1;
    }
    for (const o of ords ?? []) {
      if (o.customer_id) {
        ordCounts[o.customer_id] = (ordCounts[o.customer_id] ?? 0) + 1;
        if (o.status !== "DRAFT" && o.status !== "CANCELLED") {
          confirmedOrdCounts[o.customer_id] = (confirmedOrdCounts[o.customer_id] ?? 0) + 1;
        }
      }
    }
  }

  let items: CustomerSummary[] = rows.map((r: Record<string, unknown>) => {
    const base = mapCustomerRow(r);
    const enquiryCount = enqCounts[base.id] ?? 0;
    const quotationCount = quoCounts[base.id] ?? 0;
    const orderCount = ordCounts[base.id] ?? 0;
    const confirmedOrderCount = confirmedOrdCounts[base.id] ?? 0;
    return {
      ...base,
      enquiryCount,
      quotationCount,
      orderCount,
      confirmedOrderCount,
      isRepeatEnquiry: enquiryCount > 1,
      isRepeatBuyer: confirmedOrderCount > 1,
    };
  });

  if (filter.repeatFilter === "NEW") {
    items = items.filter((c) => !c.isRepeatEnquiry && !c.isRepeatBuyer);
  } else if (filter.repeatFilter === "REPEAT_ENQUIRY") {
    items = items.filter((c) => c.isRepeatEnquiry);
  } else if (filter.repeatFilter === "REPEAT_BUYER") {
    items = items.filter((c) => c.isRepeatBuyer);
  }

  return { items, total: count ?? items.length, page, pageSize };
}

export async function getCustomerDetail(
  customerId: string,
  clientOverride?: SupabaseClient,
): Promise<{
  customer: CustomerSummary;
  notes: CustomerNote[];
  interactions: CustomerInteraction[];
  followups: CustomerFollowup[];
  timeline: CustomerTimelineEvent[];
  enquiries: { id: string; reference: string; type: string; status: string; createdAt: string }[];
  quotations: {
    id: string;
    reference: string;
    version: number;
    status: string;
    totalAmount: number;
    createdAt: string;
  }[];
  orders: {
    id: string;
    reference: string;
    status: string;
    totalAmount: number;
    createdAt: string;
  }[];
} | null> {
  const supabase = clientOverride ?? (await createSupabaseServerClient());

  const { data: row, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .maybeSingle();

  if (error || !row) return null;

  const [
    { data: enqRows },
    { data: quoRows },
    { data: ordRows },
    { data: noteRows },
    { data: intRows },
    { data: fuRows },
  ] = await Promise.all([
    supabase
      .from("enquiries")
      .select("id, reference, type, status, message, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false }),
    supabase
      .from("quotations")
      .select("id, reference, version, status, total_amount, issued_at, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false }),
    supabase
      .from("orders")
      .select("id, reference, status, total_amount, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false }),
    supabase
      .from("customer_notes")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false }),
    supabase
      .from("customer_interactions")
      .select("*")
      .eq("customer_id", customerId)
      .order("occurred_at", { ascending: false }),
    supabase
      .from("customer_followups")
      .select("*")
      .eq("customer_id", customerId)
      .order("due_at", { ascending: true }),
  ]);

  const enquiries = (enqRows ?? []).map((e) => ({
    id: String(e.id),
    reference: String(e.reference),
    type: String(e.type),
    status: String(e.status),
    message: (e.message as string) || null,
    createdAt: String(e.created_at),
  }));

  const quotations = (quoRows ?? []).map((q) => ({
    id: String(q.id),
    reference: String(q.reference),
    version: Number(q.version),
    status: String(q.status),
    totalAmount: Number(q.total_amount),
    issuedAt: (q.issued_at as string) || null,
    createdAt: String(q.created_at),
  }));

  const orders = (ordRows ?? []).map((o) => ({
    id: String(o.id),
    reference: String(o.reference),
    status: String(o.status),
    totalAmount: Number(o.total_amount),
    createdAt: String(o.created_at),
  }));

  const notes: CustomerNote[] = (noteRows ?? []).map((n) => ({
    id: String(n.id),
    customerId: String(n.customer_id),
    authorId: String(n.author_id),
    body: String(n.body),
    createdAt: String(n.created_at),
    updatedAt: String(n.updated_at),
  }));

  const interactions: CustomerInteraction[] = (intRows ?? []).map((i) => ({
    id: String(i.id),
    customerId: String(i.customer_id),
    enquiryId: (i.enquiry_id as string) || null,
    interactionType: String(i.interaction_type) as CustomerInteraction["interactionType"],
    occurredAt: String(i.occurred_at),
    summary: String(i.summary),
    nextAction: (i.next_action as string) || null,
    authorId: String(i.author_id),
    createdAt: String(i.created_at),
  }));

  const followups: CustomerFollowup[] = (fuRows ?? []).map((f) => ({
    id: String(f.id),
    customerId: String(f.customer_id),
    enquiryId: (f.enquiry_id as string) || null,
    quotationId: (f.quotation_id as string) || null,
    title: String(f.title),
    description: (f.description as string) || null,
    dueAt: String(f.due_at),
    priority: String(f.priority) as FollowupPriority,
    status: String(f.status) as FollowupStatus,
    assignedTo: (f.assigned_to as string) || null,
    completedAt: (f.completed_at as string) || null,
    cancelledAt: (f.cancelled_at as string) || null,
    createdAt: String(f.created_at),
    updatedAt: String(f.updated_at),
  }));

  const timeline: CustomerTimelineEvent[] = [
    ...enquiries.map((e) => ({
      id: `enq-${e.id}`,
      kind: "ENQUIRY" as const,
      title: `Enquiry ${e.reference} (${e.type})`,
      description: e.message ?? `Status: ${e.status}`,
      occurredAt: e.createdAt,
      href: `/admin/enquiries/${e.id}`,
    })),
    ...quotations.map((q) => ({
      id: `quo-${q.id}`,
      kind: "QUOTATION" as const,
      title: `Quotation ${q.reference} v${q.version} (${q.status})`,
      description: `Total ₹${q.totalAmount.toLocaleString("en-IN")}`,
      occurredAt: q.issuedAt ?? q.createdAt,
    })),
    ...orders.map((o) => ({
      id: `ord-${o.id}`,
      kind: "ORDER" as const,
      title: `Order ${o.reference} (${o.status})`,
      description: `Total ₹${o.totalAmount.toLocaleString("en-IN")}`,
      occurredAt: o.createdAt,
      href: `/admin/orders/${o.id}`,
    })),
    ...interactions.map((i) => ({
      id: `int-${i.id}`,
      kind: "INTERACTION" as const,
      title: `${i.interactionType.replace("_", " ")} Interaction`,
      description: i.summary,
      occurredAt: i.occurredAt,
    })),
    ...followups.map((f) => ({
      id: `fu-${f.id}`,
      kind: "FOLLOWUP" as const,
      title: `Follow-up: ${f.title} (${f.status})`,
      description: f.description,
      occurredAt: f.completedAt ?? f.cancelledAt ?? f.dueAt,
    })),
  ].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  const confirmedOrderCount = orders.filter(
    (o) => o.status !== "DRAFT" && o.status !== "CANCELLED",
  ).length;
  const base = mapCustomerRow(row);

  return {
    customer: {
      ...base,
      enquiryCount: enquiries.length,
      quotationCount: quotations.length,
      orderCount: orders.length,
      confirmedOrderCount,
      isRepeatEnquiry: enquiries.length > 1,
      isRepeatBuyer: confirmedOrderCount > 1,
    },
    notes,
    interactions,
    followups,
    timeline,
    enquiries: enquiries.map(({ id, reference, type, status, createdAt }) => ({
      id,
      reference,
      type,
      status,
      createdAt,
    })),
    quotations: quotations.map(({ id, reference, version, status, totalAmount, createdAt }) => ({
      id,
      reference,
      version,
      status,
      totalAmount,
      createdAt,
    })),
    orders,
  };
}

export async function listFollowups(
  filter: {
    bucket?: "ALL" | "TODAY" | "OVERDUE" | "UPCOMING" | "COMPLETED";
    priority?: FollowupPriority | "ALL";
    search?: string;
  } = {},
  clientOverride?: SupabaseClient,
): Promise<CustomerFollowup[]> {
  const supabase = clientOverride ?? (await createSupabaseServerClient());
  let query = supabase
    .from("customer_followups")
    .select("*, customer:customer_id(name, mobile)")
    .order("due_at", { ascending: true })
    .limit(200);

  if (filter.priority && filter.priority !== "ALL") {
    query = query.eq("priority", filter.priority);
  }
  if (filter.bucket === "COMPLETED") {
    query = query.eq("status", "COMPLETED");
  } else if (filter.bucket && filter.bucket !== "ALL") {
    query = query.eq("status", "PENDING");
  }

  const { data: rows, error } = await query;
  if (error || !rows) {
    logger.error("crm_list_followups_failed", { error: error?.message });
    return [];
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfToday = startOfToday + 86_400_000;

  let items: CustomerFollowup[] = rows.map((f: Record<string, unknown>) => {
    const cust = f.customer as { name?: string; mobile?: string } | null;
    return {
      id: String(f.id),
      customerId: String(f.customer_id),
      customerName: cust?.name,
      customerMobile: cust?.mobile,
      enquiryId: (f.enquiry_id as string) || null,
      quotationId: (f.quotation_id as string) || null,
      title: String(f.title),
      description: (f.description as string) || null,
      dueAt: String(f.due_at),
      priority: String(f.priority) as FollowupPriority,
      status: String(f.status) as FollowupStatus,
      assignedTo: (f.assigned_to as string) || null,
      completedAt: (f.completed_at as string) || null,
      cancelledAt: (f.cancelled_at as string) || null,
      createdAt: String(f.created_at),
      updatedAt: String(f.updated_at),
    };
  });

  if (filter.search?.trim()) {
    const s = filter.search.trim().toLowerCase();
    items = items.filter(
      (f) =>
        f.title.toLowerCase().includes(s) ||
        (f.customerName ?? "").toLowerCase().includes(s) ||
        (f.customerMobile ?? "").includes(s),
    );
  }

  if (filter.bucket === "OVERDUE") {
    items = items.filter((f) => new Date(f.dueAt).getTime() < now.getTime());
  } else if (filter.bucket === "TODAY") {
    items = items.filter((f) => {
      const t = new Date(f.dueAt).getTime();
      return t >= startOfToday && t < endOfToday;
    });
  } else if (filter.bucket === "UPCOMING") {
    items = items.filter((f) => new Date(f.dueAt).getTime() >= endOfToday);
  }

  return items;
}

export async function getDashboardFollowupReminders(
  clientOverride?: SupabaseClient,
): Promise<{ overdueCount: number; todayCount: number; items: CustomerFollowup[] }> {
  const pending = await listFollowups({ bucket: "ALL" }, clientOverride);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfToday = startOfToday + 86_400_000;

  const active = pending.filter((f) => f.status === "PENDING");
  const overdue = active.filter((f) => new Date(f.dueAt).getTime() < now.getTime());
  const today = active.filter((f) => {
    const t = new Date(f.dueAt).getTime();
    return t >= now.getTime() && t < endOfToday;
  });

  return {
    overdueCount: overdue.length,
    todayCount: today.length,
    items: [...overdue, ...today].slice(0, 6),
  };
}

export async function mergeCustomersRpc(
  sourceId: string,
  targetId: string,
  clientOverride?: SupabaseClient,
): Promise<{ merged: boolean }> {
  const supabase = clientOverride ?? (await createSupabaseServerClient());
  const { data, error } = await supabase.rpc("merge_customers", {
    p_source_id: sourceId,
    p_target_id: targetId,
  });
  if (error) {
    throw new AppError("VALIDATION", error.message.replace(/^crm:\s*/, ""));
  }
  return { merged: Boolean((data as { merged?: boolean } | null)?.merged) };
}
