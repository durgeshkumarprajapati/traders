import "server-only";

import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hashTrackingToken } from "@/features/enquiries/server/tracking";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { loadSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseRpc } from "@/lib/supabase/rest";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ALLOWED_ORDER_TRANSITIONS,
  type CustomerTrackedOrder,
  type DeliveryRecord,
  type OrderItem,
  type OrderRecord,
  type OrderStatus,
  type OrderStatusHistoryRow,
} from "../types";

export function isValidOrderTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_ORDER_TRANSITIONS[from].includes(to);
}

function mapOrder(r: Record<string, unknown>): OrderRecord {
  return {
    id: String(r.id),
    reference: String(r.reference),
    customerId: (r.customer_id as string) || null,
    enquiryId: (r.enquiry_id as string) || null,
    quotationId: (r.quotation_id as string) || null,
    quotationVersion: r.quotation_version != null ? Number(r.quotation_version) : null,
    status: String(r.status) as OrderStatus,
    customerName: String(r.customer_name),
    mobile: String(r.mobile),
    email: (r.email as string) || null,
    deliveryAddress: (r.delivery_address as string) || null,
    customerInstructions: (r.customer_instructions as string) || null,
    subtotal: Number(r.subtotal),
    discountAmount: Number(r.discount_amount),
    taxAmount: Number(r.tax_amount),
    totalAmount: Number(r.total_amount),
    expectedDeliveryDate: (r.expected_delivery_date as string) || null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export async function listOrders(
  filter: { status?: OrderStatus | "ALL"; search?: string } = {},
  clientOverride?: SupabaseClient,
): Promise<OrderRecord[]> {
  const supabase = clientOverride ?? (await createSupabaseServerClient());
  let query = supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (filter.status && filter.status !== "ALL") {
    query = query.eq("status", filter.status);
  }
  if (filter.search?.trim()) {
    const q = filter.search.trim().replace(/[,%()]/g, "");
    if (q) {
      query = query.or(`reference.ilike.%${q}%,customer_name.ilike.%${q}%,mobile.ilike.%${q}%`);
    }
  }

  const { data, error } = await query;
  if (error || !data) {
    logger.error("orders_list_failed", { error: error?.message });
    return [];
  }
  return data.map((r: Record<string, unknown>) => mapOrder(r));
}

export async function getOrderDetail(
  orderId: string,
  clientOverride?: SupabaseClient,
): Promise<{
  order: OrderRecord;
  items: OrderItem[];
  history: OrderStatusHistoryRow[];
  delivery: DeliveryRecord | null;
  notes: { id: string; body: string; createdAt: string }[];
} | null> {
  const supabase = clientOverride ?? (await createSupabaseServerClient());
  const { data: row, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !row) return null;

  const [{ data: itemRows }, { data: histRows }, { data: delRow }, { data: noteRows }] =
    await Promise.all([
      supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId)
        .order("position", { ascending: true }),
      supabase
        .from("order_status_history")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true }),
      supabase.from("delivery_records").select("*").eq("order_id", orderId).maybeSingle(),
      supabase
        .from("order_notes")
        .select("id, body, created_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false }),
    ]);

  const items: OrderItem[] = (itemRows ?? []).map((i) => ({
    id: String(i.id),
    orderId: String(i.order_id),
    position: Number(i.position),
    productId: (i.product_id as string) || null,
    sku: (i.sku as string) || null,
    productName: String(i.product_name),
    brandName: (i.brand_name as string) || null,
    unitCode: String(i.unit_code) as OrderItem["unitCode"],
    unitLabel: String(i.unit_label),
    quantity: Number(i.quantity),
    unitPrice: Number(i.unit_price),
    lineTotal: Number(i.line_total),
  }));

  const history: OrderStatusHistoryRow[] = (histRows ?? []).map((h) => ({
    id: String(h.id),
    previousStatus: (h.previous_status as OrderStatus) || null,
    newStatus: String(h.new_status) as OrderStatus,
    description: (h.description as string) || null,
    createdAt: String(h.created_at),
  }));

  const delivery: DeliveryRecord | null = delRow
    ? {
        id: String(delRow.id),
        orderId: String(delRow.order_id),
        deliveryAddress: (delRow.delivery_address as string) || null,
        contactPerson: (delRow.contact_person as string) || null,
        contactNumber: (delRow.contact_number as string) || null,
        vehicleNumber: (delRow.vehicle_number as string) || null,
        driverName: (delRow.driver_name as string) || null,
        dispatchedAt: (delRow.dispatched_at as string) || null,
        expectedDeliveryDate: (delRow.expected_delivery_date as string) || null,
        actualDeliveryDate: (delRow.actual_delivery_date as string) || null,
        deliveryNotes: (delRow.delivery_notes as string) || null,
        proofOfDeliveryUrl: (delRow.proof_of_delivery_url as string) || null,
        updatedAt: String(delRow.updated_at),
      }
    : null;

  const notes = (noteRows ?? []).map((n) => ({
    id: String(n.id),
    body: String(n.body),
    createdAt: String(n.created_at),
  }));

  return { order: mapOrder(row), items, history, delivery, notes };
}

export async function createOrderFromQuotationServer(
  quotationId: string,
  opts: { expectedDeliveryDate?: string; instructions?: string },
  clientOverride?: SupabaseClient,
): Promise<{ orderId: string; reference: string; trackingToken: string; trackingPath: string }> {
  const supabase = clientOverride ?? (await createSupabaseServerClient());
  const rawToken = `ord_${randomBytes(32).toString("hex")}`;
  const tokenHash = hashTrackingToken(rawToken);
  const expiresAt = new Date(Date.now() + 90 * 86_400_000).toISOString();

  const { data, error } = await supabase.rpc("create_order_from_quotation", {
    p_quotation_id: quotationId,
    p_token_hash: tokenHash,
    p_expires: expiresAt,
    p_expected_delivery_date: opts.expectedDeliveryDate || null,
    p_instructions: opts.instructions || null,
  });

  if (error || !data) {
    throw new AppError(
      "VALIDATION",
      error?.message?.replace(/^order:\s*/, "") ?? "Failed to create order.",
    );
  }
  const d = data as { id: string; reference: string };
  return {
    orderId: d.id,
    reference: d.reference,
    trackingToken: rawToken,
    trackingPath: `/order/${rawToken}`,
  };
}

export async function getTrackedOrder(rawToken: string): Promise<CustomerTrackedOrder | null> {
  if (!rawToken || rawToken.length < 32 || rawToken.length > 128) return null;
  try {
    const rpc = createSupabaseRpc(loadSupabaseConfig());
    const raw = await rpc<Record<string, unknown> | null>("get_tracked_order", {
      p_token_hash: hashTrackingToken(rawToken),
    });
    if (!raw) return null;
    return {
      reference: String(raw.reference),
      status: String(raw.status) as OrderStatus,
      customerName: String(raw.customer_name),
      deliveryAddress: (raw.delivery_address as string) || null,
      expectedDeliveryDate: (raw.expected_delivery_date as string) || null,
      dispatchedAt: (raw.dispatched_at as string) || null,
      actualDeliveryDate: (raw.actual_delivery_date as string) || null,
      subtotal: Number(raw.subtotal),
      discountAmount: Number(raw.discount_amount),
      taxAmount: Number(raw.tax_amount),
      totalAmount: Number(raw.total_amount),
      createdAt: String(raw.created_at),
      items: Array.isArray(raw.items)
        ? raw.items.map((it: Record<string, unknown>) => ({
            position: Number(it.position),
            productName: String(it.product_name),
            brandName: (it.brand_name as string) || null,
            unitLabel: String(it.unit_label),
            quantity: Number(it.quantity),
            unitPrice: Number(it.unit_price),
            lineTotal: Number(it.line_total),
          }))
        : [],
      timeline: Array.isArray(raw.timeline)
        ? raw.timeline.map((h: Record<string, unknown>) => ({
            previousStatus: (h.previous_status as OrderStatus) || null,
            newStatus: String(h.new_status) as OrderStatus,
            description: (h.description as string) || null,
            createdAt: String(h.created_at),
          }))
        : [],
    };
  } catch (error) {
    logger.error("get_tracked_order_failed", { error });
    return null;
  }
}
