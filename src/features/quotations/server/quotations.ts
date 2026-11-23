import "server-only";

import { logger } from "@/lib/logger";
import { createSupabaseRpc, type Rpc } from "@/lib/supabase/rest";
import { loadSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateTrackingToken, hashTrackingToken } from "@/features/enquiries/server/tracking";
import { calculateLineTotal, calculateQuotationTotals } from "../calculations";
import type {
  CustomerTrackedQuotation,
  QuotationItem,
  QuotationItemInput,
  QuotationRecord,
  QuotationStatus,
} from "../types";

export interface CreateQuotationInput {
  enquiryId: string;
  items: QuotationItemInput[];
  discountAmount?: number;
  taxAmount?: number;
  termsAndConditions?: string | null;
  validDays?: number;
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
      logger.error("get_admin_quotations_failed", { enquiryId, error: error?.message });
      return [];
    }

    const quotationIds = rows.map((r: { id: string }) => r.id);
    const { data: itemRows } = await supabase
      .from("quotation_items")
      .select("*")
      .in("quotation_id", quotationIds)
      .order("position", { ascending: true });

    const itemsByQuo: Record<string, QuotationItem[]> = {};
    if (itemRows) {
      for (const it of itemRows) {
        if (!itemsByQuo[it.quotation_id]) itemsByQuo[it.quotation_id] = [];
        itemsByQuo[it.quotation_id].push({
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
        trackingTokenHash: (r.tracking_token_hash as string) || null,
        trackingTokenExpiresAt: (r.tracking_token_expires_at as string) || null,
        trackingTokenRevokedAt: (r.tracking_token_revoked_at as string) || null,
        createdBy: (r.created_by as string) || null,
        createdAt: String(r.created_at),
        updatedAt: String(r.updated_at),
        issuedAt: (r.issued_at as string) || null,
        items: itemsByQuo[String(r.id)] ?? [],
      };
    });
  } catch (error) {
    logger.error("get_admin_quotations_exception", { enquiryId, error });
    return [];
  }
}

export async function createQuotationDraft(
  input: CreateQuotationInput,
  adminId: string,
): Promise<{ ok: true; quotationId: string; reference: string } | { ok: false; message: string }> {
  try {
    const supabase = await createSupabaseServerClient();

    // 1. Fetch enquiry details
    const { data: enq, error: enqErr } = await supabase
      .from("enquiries")
      .select("id, reference, customer_name, mobile, email, delivery_location")
      .eq("id", input.enquiryId)
      .maybeSingle();

    if (enqErr || !enq) {
      return { ok: false, message: "Enquiry not found." };
    }

    if (input.items.length === 0) {
      return { ok: false, message: "A quotation must have at least one line item." };
    }

    // 2. Determine version number
    const { data: latest } = await supabase
      .from("quotations")
      .select("version")
      .eq("enquiry_id", input.enquiryId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const version = latest ? latest.version + 1 : 1;

    // 3. Generate sequential reference number
    const year = new Date().getFullYear();
    const randomSeq = Math.floor(100000 + Math.random() * 900000);
    const reference = `QUO-${year}-${randomSeq}`;

    // 4. Calculate financial totals
    const totals = calculateQuotationTotals(
      input.items.map((i) => ({ quantity: i.quantity, unitPrice: i.unitPrice })),
      input.discountAmount ?? 0,
      input.taxAmount ?? 0,
    );

    const validDays = input.validDays ?? 7;
    const validUntil = new Date(Date.now() + validDays * 86400 * 1000).toISOString();

    // 5. Insert quotation record
    const { data: newQuo, error: quoErr } = await supabase
      .from("quotations")
      .insert({
        reference,
        enquiry_id: input.enquiryId,
        version,
        status: "DRAFT",
        customer_name: enq.customer_name,
        mobile: enq.mobile,
        email: enq.email,
        delivery_location: enq.delivery_location,
        subtotal: totals.subtotal,
        discount_amount: totals.discountAmount,
        tax_amount: totals.taxAmount,
        total_amount: totals.totalAmount,
        terms_and_conditions:
          input.termsAndConditions ??
          "1. Rates valid for 7 days. 2. Direct site supply terms apply. 3. Advance RTGS/NEFT payment.",
        valid_until: validUntil,
        created_by: adminId,
      })
      .select("id")
      .single();

    if (quoErr || !newQuo) {
      return { ok: false, message: `Failed to create quotation: ${quoErr?.message}` };
    }

    // 6. Insert items
    const itemsToInsert = input.items.map((item, idx) => ({
      quotation_id: newQuo.id,
      position: idx + 1,
      product_id: item.productId || null,
      sku: item.sku || null,
      product_name: item.productName,
      brand_name: item.brandName || null,
      unit_code: item.unitCode,
      unit_label: item.unitLabel,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      line_total: calculateLineTotal(item.quantity, item.unitPrice),
      notes: item.notes || null,
    }));

    const { error: itemsErr } = await supabase.from("quotation_items").insert(itemsToInsert);

    if (itemsErr) {
      return { ok: false, message: `Failed to insert quotation items: ${itemsErr.message}` };
    }

    return { ok: true, quotationId: newQuo.id, reference };
  } catch (error) {
    logger.error("create_quotation_draft_failed", { error });
    return { ok: false, message: "An unexpected error occurred while creating the quotation." };
  }
}

export async function issueQuotation(
  quotationId: string,
  adminId: string,
): Promise<
  | { ok: true; rawToken: string; trackingUrl: string; reference: string }
  | { ok: false; message: string }
> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: quo, error: quoErr } = await supabase
      .from("quotations")
      .select("id, reference, enquiry_id, version, status")
      .eq("id", quotationId)
      .maybeSingle();

    if (quoErr || !quo) {
      return { ok: false, message: "Quotation not found." };
    }

    // Generate secure customer tracking token
    const rawToken = generateTrackingToken();
    const tokenHash = hashTrackingToken(rawToken);
    const expiresAt = new Date(Date.now() + 90 * 86400 * 1000).toISOString();

    // Mark quotation as ISSUED
    const { error: updateQuoErr } = await supabase
      .from("quotations")
      .update({
        status: "ISSUED",
        issued_at: new Date().toISOString(),
        tracking_token_hash: tokenHash,
        tracking_token_expires_at: expiresAt,
        tracking_token_revoked_at: null,
      })
      .eq("id", quotationId);

    if (updateQuoErr) {
      return { ok: false, message: `Failed to issue quotation: ${updateQuoErr.message}` };
    }

    // Advance enquiry status to QUOTATION_SENT
    await supabase
      .from("enquiries")
      .update({ status: "QUOTATION_SENT", updated_at: new Date().toISOString() })
      .eq("id", quo.enquiry_id);

    // Record in enquiry_status_history
    await supabase.from("enquiry_status_history").insert({
      enquiry_id: quo.enquiry_id,
      previous_status: "CONTACTED",
      new_status: "QUOTATION_SENT",
      changed_by: adminId,
      description: `Formal quotation ${quo.reference} (v${quo.version}) issued to customer`,
    });

    return {
      ok: true,
      rawToken,
      reference: quo.reference,
      trackingUrl: `/quotation/${rawToken}`,
    };
  } catch (error) {
    logger.error("issue_quotation_failed", { quotationId, error });
    return { ok: false, message: "Failed to issue quotation." };
  }
}

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
