import "server-only";

import { connection } from "next/server";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ENQUIRY_STATUSES,
  type AdminEnquiryDetail,
  type AdminEnquiryItem,
  type AdminEnquiryListItem,
  type AdminEnquiryListResult,
  type AdminEnquiryNote,
  type AdminNotificationOutboxStatus,
  type EnquiryStatus,
  type StockStatus,
} from "../types";

interface EnquiryDbRow {
  id: string;
  reference: string;
  type: string;
  status: string;
  customer_name: string;
  mobile: string;
  email: string | null;
  delivery_location: string | null;
  message: string | null;
  created_at: string;
  updated_at: string;
}

interface EnquiryItemDbRow {
  id: string;
  position: number;
  product_id: string;
  sku: string | null;
  product_name: string;
  brand_name: string | null;
  unit_code: string;
  unit_label: string;
  quantity: number | string;
  listed_price: number | string | null;
  stock_status: string;
}

interface EnquiryNoteDbRow {
  id: string;
  enquiry_id: string;
  author_id: string;
  body: string;
  created_at: string;
  admin_profiles?:
    | { email?: string | null; full_name?: string | null }
    | { email?: string | null; full_name?: string | null }[]
    | null;
}

export interface LoadAdminEnquiriesParams {
  search?: string;
  status?: string;
  type?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "created_at" | "customer_name" | "status";
  sortOrder?: "asc" | "desc";
}

export async function loadAdminEnquiries(
  params: LoadAdminEnquiriesParams = {},
): Promise<AdminEnquiryListResult> {
  await connection();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 15));
  const offset = (page - 1) * pageSize;
  const sortBy = params.sortBy ?? "created_at";
  const sortOrder = params.sortOrder ?? "desc";

  try {
    const supabase = await createSupabaseServerClient();
    let query = supabase
      .from("enquiries")
      .select(
        "id, reference, type, status, customer_name, mobile, email, delivery_location, message, created_at, updated_at",
        { count: "exact" },
      );

    if (params.status && (ENQUIRY_STATUSES as readonly string[]).includes(params.status)) {
      query = query.eq("status", params.status);
    }

    if (params.type === "BULK" || params.type === "GENERAL") {
      query = query.eq("type", params.type);
    }

    const search = params.search?.trim();
    if (search) {
      query = query.or(
        `reference.ilike.%${search}%,customer_name.ilike.%${search}%,mobile.ilike.%${search}%`,
      );
    }

    query = query
      .order(sortBy, { ascending: sortOrder === "asc" })
      .range(offset, offset + pageSize - 1);

    const { data: rows, count, error } = await query;
    if (error) {
      logger.warn("admin_enquiries_list_error", { error: error.message });
      return { enquiries: [], totalCount: 0, page, pageSize, totalPages: 0 };
    }

    const totalCount = count ?? 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    if (!rows || rows.length === 0) {
      return { enquiries: [], totalCount, page, pageSize, totalPages };
    }

    // Query item counts and callback statuses for these enquiries in batch
    const enquiryIds = rows.map((r: { id: string }) => r.id);
    const [itemRowsRes, callbackRowsRes, metaRowsRes] = await Promise.all([
      supabase.from("enquiry_items").select("enquiry_id").in("enquiry_id", enquiryIds),
      supabase.from("enquiry_callbacks").select("enquiry_id").in("enquiry_id", enquiryIds),
      supabase.from("enquiry_metadata").select("enquiry_id, kind").in("enquiry_id", enquiryIds),
    ]);

    const countMap: Record<string, number> = {};
    if (itemRowsRes.data) {
      for (const item of itemRowsRes.data) {
        countMap[item.enquiry_id] = (countMap[item.enquiry_id] ?? 0) + 1;
      }
    }

    const callbackSet = new Set(
      (callbackRowsRes.data ?? []).map((c: { enquiry_id: string }) => c.enquiry_id),
    );

    const metaKinds = new Map<string, "DELIVERY" | "EXPERT">();
    for (const m of (metaRowsRes.data ?? []) as Array<{ enquiry_id: string; kind: string }>)
      if (m.kind === "DELIVERY" || m.kind === "EXPERT") metaKinds.set(m.enquiry_id, m.kind);

    const enquiries: AdminEnquiryListItem[] = (rows as unknown as EnquiryDbRow[]).map((r) => ({
      id: r.id,
      reference: r.reference,
      type: r.type as "BULK" | "GENERAL",
      status: r.status as EnquiryStatus,
      customerName: r.customer_name,
      mobile: r.mobile,
      email: r.email ?? null,
      deliveryLocation: r.delivery_location ?? null,
      message: r.message ?? null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      itemCount: countMap[r.id] ?? 0,
      isCallback: callbackSet.has(r.id),
      metadataKind: metaKinds.get(r.id) ?? null,
    }));

    return { enquiries, totalCount, page, pageSize, totalPages };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.warn("admin_enquiries_load_exception", { error: errorMsg });
    return { enquiries: [], totalCount: 0, page, pageSize, totalPages: 0 };
  }
}

export async function loadAdminEnquiryDetail(id: string): Promise<AdminEnquiryDetail | null> {
  await connection();
  try {
    const supabase = await createSupabaseServerClient();

    const { data: enquiry, error: enquiryError } = await supabase
      .from("enquiries")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (enquiryError || !enquiry) {
      if (enquiryError)
        logger.warn("admin_enquiry_detail_error", { id, error: enquiryError.message });
      return null;
    }

    const [itemsRes, notesRes, outboxRes, historyRes, callbackRes, metaRes] = await Promise.all([
      supabase
        .from("enquiry_items")
        .select("*")
        .eq("enquiry_id", id)
        .order("position", { ascending: true }),
      supabase
        .from("enquiry_notes")
        .select(
          "id, enquiry_id, author_id, body, created_at, admin_profiles:author_id(email, full_name)",
        )
        .eq("enquiry_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("notification_outbox")
        .select("id, status, attempt_count, max_attempts, last_error, sent_at, next_attempt_at")
        .eq("enquiry_id", id)
        .maybeSingle(),
      supabase
        .from("enquiry_status_history")
        .select("id, previous_status, new_status, description, created_at")
        .eq("enquiry_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("enquiry_callbacks")
        .select("preferred_date, preferred_time_window, reason")
        .eq("enquiry_id", id)
        .maybeSingle(),
      supabase.from("enquiry_metadata").select("kind, data").eq("enquiry_id", id).maybeSingle(),
    ]);

    const itemRows = (itemsRes.data ?? []) as unknown as EnquiryItemDbRow[];
    const items: AdminEnquiryItem[] = itemRows.map((item) => ({
      id: item.id,
      position: item.position,
      productId: item.product_id,
      sku: item.sku ?? null,
      productName: item.product_name,
      brandName: item.brand_name ?? null,
      unitCode: item.unit_code,
      unitLabel: item.unit_label,
      quantity: Number(item.quantity),
      listedPrice:
        item.listed_price !== null && item.listed_price !== undefined
          ? Number(item.listed_price)
          : null,
      stockStatus: item.stock_status as StockStatus,
    }));

    const noteRows = (notesRes.data ?? []) as unknown as EnquiryNoteDbRow[];
    const notes: AdminEnquiryNote[] = noteRows.map((note) => {
      const profile = Array.isArray(note.admin_profiles)
        ? note.admin_profiles[0]
        : note.admin_profiles;
      return {
        id: note.id,
        enquiryId: note.enquiry_id,
        authorId: note.author_id,
        authorEmail: profile?.email ?? null,
        authorName: profile?.full_name ?? null,
        body: note.body,
        createdAt: note.created_at,
      };
    });

    const outbox: AdminNotificationOutboxStatus | null = outboxRes.data
      ? {
          id: outboxRes.data.id,
          status: outboxRes.data.status,
          attemptCount: outboxRes.data.attempt_count,
          maxAttempts: outboxRes.data.max_attempts,
          lastError: outboxRes.data.last_error ?? null,
          sentAt: outboxRes.data.sent_at ?? null,
          nextAttemptAt: outboxRes.data.next_attempt_at,
        }
      : null;

    const statusHistory = (historyRes.data ?? []).map(
      (h: {
        id: string;
        previous_status: string | null;
        new_status: string;
        description: string | null;
        created_at: string;
      }) => ({
        id: h.id,
        previousStatus: h.previous_status,
        newStatus: h.new_status,
        description: h.description,
        createdAt: h.created_at,
      }),
    );

    const callbackDetails = callbackRes.data
      ? {
          preferredDate: callbackRes.data.preferred_date ?? null,
          preferredTimeWindow: callbackRes.data.preferred_time_window ?? null,
          reason: callbackRes.data.reason ?? null,
        }
      : null;

    const metaRow = metaRes.data as { kind?: string; data?: unknown } | null;
    const metaKind: "DELIVERY" | "EXPERT" | null =
      metaRow?.kind === "DELIVERY" ? "DELIVERY" : metaRow?.kind === "EXPERT" ? "EXPERT" : null;
    const metadata =
      metaKind && metaRow?.data && typeof metaRow.data === "object"
        ? { kind: metaKind, data: metaRow.data as Record<string, unknown> }
        : null;

    return {
      id: enquiry.id,
      reference: enquiry.reference,
      type: enquiry.type as "BULK" | "GENERAL",
      status: enquiry.status as EnquiryStatus,
      customerName: enquiry.customer_name,
      mobile: enquiry.mobile,
      email: enquiry.email ?? null,
      deliveryLocation: enquiry.delivery_location ?? null,
      message: enquiry.message ?? null,
      createdAt: enquiry.created_at,
      updatedAt: enquiry.updated_at,
      items,
      notes,
      outbox,
      hasTrackingToken: Boolean(enquiry.tracking_token_hash),
      trackingViewCount: Number(enquiry.tracking_view_count ?? 0),
      trackingLastViewedAt: enquiry.tracking_last_viewed_at ?? null,
      trackingTokenExpiresAt: enquiry.tracking_token_expires_at ?? null,
      trackingTokenRevokedAt: enquiry.tracking_token_revoked_at ?? null,
      callbackDetails,
      metadata,
      statusHistory,
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.warn("admin_enquiry_detail_exception", { id, error: errorMsg });
    return null;
  }
}
