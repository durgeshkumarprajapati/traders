import "server-only";

import { randomBytes } from "node:crypto";
import { loadCatalogue } from "@/features/catalogue/server";
import { hashTrackingToken } from "@/features/enquiries/server/tracking";
import { buildItemSnapshots } from "@/features/enquiries/server/snapshots";
import { logger } from "@/lib/logger";
import { createSupabaseRpc, type Rpc } from "@/lib/supabase/rest";
import { loadSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calculateQuotationTotals } from "../calculations";
import { quotationInputSchema, type QuotationInput } from "../schemas";
import type {
  CustomerTrackedQuotation,
  QuotationItem,
  QuotationLinkState,
  QuotationRecord,
  QuotationStatus,
} from "../types";

/** Customer access links (quotation and enquiry tracking links) live for 90 days unless revoked or rotated earlier. */
export const ACCESS_LINK_TTL_DAYS = 90;

export type CreateQuotationInput = QuotationInput;

type PgError = { code?: string; message?: string } | null;

/**
 * Database functions raise curated, customer-agnostic messages prefixed "quotation:". Those are shown to the admin;
 * everything else (constraint names, SQL text, internals) is replaced by a generic message and logged server-side.
 */
function adminMessage(error: PgError, fallback: string): string {
  if (error?.code === "42501") return "You are not authorised to manage quotations.";
  const m = error?.message ?? "";
  if (m.startsWith("quotation:"))
    return m.replace(/^quotation:\s*/, "").replace(/^./, (c) => c.toUpperCase());
  return fallback;
}

function newAccessToken(): { raw: string; hash: string; expiresAt: string } {
  const raw = `qt_${randomBytes(32).toString("hex")}`;
  return {
    raw,
    hash: hashTrackingToken(raw),
    expiresAt: new Date(Date.now() + ACCESS_LINK_TTL_DAYS * 86_400_000).toISOString(),
  };
}

function linkState(r: Record<string, unknown>): QuotationLinkState {
  if (!r.tracking_token_hash) return "NONE";
  if (r.tracking_token_revoked_at) return "REVOKED";
  const exp = r.tracking_token_expires_at as string | null;
  if (exp && new Date(exp).getTime() <= Date.now()) return "EXPIRED";
  return "ACTIVE";
}

export async function getAdminQuotationsForEnquiry(enquiryId: string): Promise<QuotationRecord[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: rows, error } = await supabase
      .from("quotations")
      .select("*, enquiry:enquiry_id(reference)")
      .eq("enquiry_id", enquiryId)
      .order("version", { ascending: false });

    if (error || !rows) {
      logger.error("get_admin_quotations_failed", { error: error?.message });
      return [];
    }

    const quotationIds = rows.map((r: { id: string }) => r.id);
    const { data: itemRows } = await supabase
      .from("quotation_items")
      .select("*")
      .in("quotation_id", quotationIds)
      .order("position", { ascending: true });

    const itemsByQuo: Record<string, QuotationItem[]> = {};
    for (const it of itemRows ?? []) {
      (itemsByQuo[it.quotation_id] ??= []).push({
        id: it.id,
        quotationId: it.quotation_id,
        position: it.position,
        productId: it.product_id,
        sku: it.sku,
        productName: it.product_name,
        brandName: it.brand_name,
        unitCode: it.unit_code,
        unitLabel: it.unit_label,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unit_price),
        lineTotal: Number(it.line_total),
        notes: it.notes,
      });
    }

    return rows.map((r: Record<string, unknown>) => {
      const enq = r.enquiry as { reference?: string } | null;
      return {
        id: String(r.id),
        reference: String(r.reference),
        enquiryId: String(r.enquiry_id),
        enquiryReference: enq?.reference,
        version: Number(r.version),
        status: String(r.status) as QuotationStatus,
        customerName: String(r.customer_name),
        mobile: String(r.mobile),
        email: (r.email as string) || null,
        deliveryLocation: (r.delivery_location as string) || null,
        subtotal: Number(r.subtotal),
        discountAmount: Number(r.discount_amount),
        taxAmount: Number(r.tax_amount),
        totalAmount: Number(r.total_amount),
        termsAndConditions: (r.terms_and_conditions as string) || null,
        validUntil: (r.valid_until as string) || null,
        linkState: linkState(r),
        linkExpiresAt: (r.tracking_token_expires_at as string) || null,
        viewCount: Number(r.view_count ?? 0),
        lastViewedAt: (r.last_viewed_at as string) || null,
        createdBy: (r.created_by as string) || null,
        createdAt: String(r.created_at),
        updatedAt: String(r.updated_at),
        issuedAt: (r.issued_at as string) || null,
        items: itemsByQuo[String(r.id)] ?? [],
      };
    });
  } catch (error) {
    logger.error("get_admin_quotations_exception", { error });
    return [];
  }
}

/**
 * Create a DRAFT quotation. Validation is repeated here; catalogue-backed lines take their name, brand, SKU and unit from the
 * server-side catalogue (never from the browser); the rate is the admin's quoted rate. Totals are computed by the database
 * inside the same transaction that stores the draft and its lines.
 */
export async function createQuotationDraft(
  rawInput: unknown,
): Promise<
  | { ok: true; quotationId: string; reference: string; version: number }
  | { ok: false; message: string }
> {
  const parsed = quotationInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the quotation." };
  }
  const input = parsed.data;

  // Cross-check: the preview maths and the database must agree (guards against drift between the two).
  const preview = calculateQuotationTotals(
    input.items.map((i) => ({ quantity: i.quantity, unitPrice: i.unitPrice })),
    input.discountAmount,
    input.taxAmount,
  );
  if (input.discountAmount > preview.subtotal) {
    return { ok: false, message: "Discount cannot exceed the subtotal." };
  }

  // Authoritative product facts for catalogue-backed lines.
  const catalogue = await loadCatalogue();
  const items = input.items.map((line) => {
    if (line.productId && catalogue.ok) {
      const snap = buildItemSnapshots(
        [{ productId: line.productId, quantity: 1 }],
        catalogue.catalogue,
      );
      if (snap.ok) {
        const s = snap.snapshots[0];
        return {
          product_id: s.product_id,
          sku: s.sku,
          product_name: s.product_name,
          brand_name: s.brand_name,
          unit_code: s.unit_code,
          unit_label: s.unit_label,
          quantity: line.quantity,
          unit_price: line.unitPrice,
          notes: line.notes ?? null,
        };
      }
    }
    // Manual line (or a product that is no longer in the catalogue): no catalogue identity is claimed.
    return {
      product_id: null,
      sku: line.sku ?? null,
      product_name: line.productName,
      brand_name: line.brandName ?? null,
      unit_code: line.unitCode,
      unit_label: line.unitLabel,
      quantity: line.quantity,
      unit_price: line.unitPrice,
      notes: line.notes ?? null,
    };
  });

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("create_quotation_draft", {
      p_payload: {
        enquiry_id: input.enquiryId,
        items,
        discount_amount: input.discountAmount,
        tax_amount: input.taxAmount,
        terms: input.termsAndConditions ?? null,
        valid_days: input.validDays,
      },
    });
    if (error || !data) {
      logger.error("create_quotation_draft_failed", { code: error?.code });
      return { ok: false, message: adminMessage(error, "Could not create the quotation draft.") };
    }
    const r = data as {
      id: string;
      reference: string;
      version: number;
      total_amount: number | string;
    };
    if (Math.round(Number(r.total_amount) * 100) !== Math.round(preview.totalAmount * 100)) {
      logger.error("quotation_total_mismatch", { reference: r.reference });
    }
    return { ok: true, quotationId: r.id, reference: r.reference, version: r.version };
  } catch (error) {
    logger.error("create_quotation_draft_exception", { error });
    return { ok: false, message: "An unexpected error occurred while creating the quotation." };
  }
}

/** Issue a draft. Returns the raw access token ONCE; only its hash is stored. */
export async function issueQuotation(quotationId: string): Promise<
  | {
      ok: true;
      rawToken: string;
      trackingUrl: string;
      reference: string;
      enquiryStatusChanged: boolean;
    }
  | { ok: false; message: string }
> {
  const token = newAccessToken();
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("issue_quotation", {
      p_quotation_id: quotationId,
      p_token_hash: token.hash,
      p_expires: token.expiresAt,
    });
    if (error || !data) {
      logger.error("issue_quotation_failed", { code: error?.code });
      return { ok: false, message: adminMessage(error, "Could not issue the quotation.") };
    }
    const r = data as { reference: string; enquiry_status_changed: boolean };
    return {
      ok: true,
      rawToken: token.raw,
      trackingUrl: `/quotation/${token.raw}`,
      reference: r.reference,
      enquiryStatusChanged: r.enquiry_status_changed,
    };
  } catch (error) {
    logger.error("issue_quotation_exception", { error });
    return { ok: false, message: "Failed to issue the quotation." };
  }
}

export async function rotateQuotationLink(
  quotationId: string,
): Promise<{ ok: true; trackingUrl: string } | { ok: false; message: string }> {
  const token = newAccessToken();
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("rotate_quotation_token", {
      p_quotation_id: quotationId,
      p_token_hash: token.hash,
      p_expires: token.expiresAt,
    });
    if (error) return { ok: false, message: adminMessage(error, "Could not create a new link.") };
    return { ok: true, trackingUrl: `/quotation/${token.raw}` };
  } catch (error) {
    logger.error("rotate_quotation_link_exception", { error });
    return { ok: false, message: "Could not create a new link." };
  }
}

export async function revokeQuotationLink(
  quotationId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("revoke_quotation_token", { p_quotation_id: quotationId });
    if (error) return { ok: false, message: adminMessage(error, "Could not revoke the link.") };
    return { ok: true };
  } catch (error) {
    logger.error("revoke_quotation_link_exception", { error });
    return { ok: false, message: "Could not revoke the link." };
  }
}

/** Customer access: by quotation link OR enquiry tracking link (latest issued version). Returns null for anything invalid. */
export async function getTrackedQuotation(
  token: string,
  rpc?: Rpc,
): Promise<CustomerTrackedQuotation | null> {
  const cleanToken = token.trim();
  if (cleanToken.length < 32 || cleanToken.length > 128) return null;
  const tokenHash = hashTrackingToken(cleanToken);

  try {
    const rpcFn = rpc ?? createSupabaseRpc(loadSupabaseConfig());
    const raw = (await rpcFn(
      "get_tracked_quotation",
      { p_token_hash: tokenHash },
      { retries: 1 },
    )) as Record<string, unknown> | null;
    if (!raw) return null;

    const items = (Array.isArray(raw.items) ? raw.items : []).map(
      (it: Record<string, unknown>) => ({
        position: Number(it.position || 0),
        productName: String(it.product_name || ""),
        brandName: (it.brand_name as string) || null,
        unitLabel: String(it.unit_label || ""),
        quantity: Number(it.quantity || 0),
        unitPrice: Number(it.unit_price || 0),
        lineTotal: Number(it.line_total || 0),
        notes: (it.notes as string) || null,
      }),
    );

    return {
      reference: String(raw.reference),
      enquiryReference: String(raw.enquiry_reference),
      version: Number(raw.version || 1),
      status: String(raw.status) as QuotationStatus,
      isLatest: raw.is_latest !== false,
      isExpired: raw.is_expired === true,
      customerName: String(raw.customer_name),
      deliveryLocation: (raw.delivery_location as string) || null,
      subtotal: Number(raw.subtotal || 0),
      discountAmount: Number(raw.discount_amount || 0),
      taxAmount: Number(raw.tax_amount || 0),
      totalAmount: Number(raw.total_amount || 0),
      termsAndConditions: (raw.terms_and_conditions as string) || null,
      validUntil: (raw.valid_until as string) || null,
      issuedAt: (raw.issued_at as string) || null,
      items,
    };
  } catch (error) {
    logger.error("get_tracked_quotation_rpc_failed", { error });
    return null;
  }
}

/** Admin-only: a quotation (any status, including DRAFT) shaped for the PDF/preview. Uses the admin's own session (RLS). */
export async function getAdminQuotationForPdf(
  quotationId: string,
): Promise<{ quotation: CustomerTrackedQuotation; isDraft: boolean } | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: q } = await supabase
      .from("quotations")
      .select("*, enquiry:enquiry_id(reference)")
      .eq("id", quotationId)
      .maybeSingle();
    if (!q) return null;
    const { data: items } = await supabase
      .from("quotation_items")
      .select("*")
      .eq("quotation_id", quotationId)
      .order("position", { ascending: true });
    const { data: newer } = await supabase
      .from("quotations")
      .select("id")
      .eq("enquiry_id", q.enquiry_id)
      .gt("version", q.version)
      .neq("status", "DRAFT")
      .limit(1);
    const enq = q.enquiry as { reference?: string } | null;
    return {
      isDraft: q.status === "DRAFT",
      quotation: {
        reference: q.reference,
        enquiryReference: enq?.reference ?? "",
        version: q.version,
        status: q.status as QuotationStatus,
        isLatest: !newer || newer.length === 0,
        isExpired: q.valid_until ? new Date(q.valid_until).getTime() < Date.now() : false,
        customerName: q.customer_name,
        deliveryLocation: q.delivery_location,
        subtotal: Number(q.subtotal),
        discountAmount: Number(q.discount_amount),
        taxAmount: Number(q.tax_amount),
        totalAmount: Number(q.total_amount),
        termsAndConditions: q.terms_and_conditions,
        validUntil: q.valid_until,
        issuedAt: q.issued_at,
        items: (items ?? []).map((it: Record<string, unknown>) => ({
          position: Number(it.position),
          productName: String(it.product_name),
          brandName: (it.brand_name as string) || null,
          unitLabel: String(it.unit_label),
          quantity: Number(it.quantity),
          unitPrice: Number(it.unit_price),
          lineTotal: Number(it.line_total),
          notes: (it.notes as string) || null,
        })),
      },
    };
  } catch (error) {
    logger.error("get_admin_quotation_for_pdf_failed", { error });
    return null;
  }
}
