import "server-only";

import { createHash, createHmac, randomBytes } from "node:crypto";
import { logger } from "@/lib/logger";
import type { Rpc } from "@/lib/supabase/rest";
import type { EnquiryStatus } from "@/components/ui/status-badge";
import type { TrackedEnquiry } from "../tracking-types";

export type { TrackedEnquiry };

export function generateTrackingToken(seed?: string, secret?: string): string {
  if (seed && secret) {
    const hmac = createHmac("sha256", secret).update(seed).digest("hex");
    return `tr_${hmac}`;
  }
  return `tr_${randomBytes(32).toString("hex")}`;
}

export function hashTrackingToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function getTrackedEnquiry(
  reference: string,
  token: string,
  rpc: Rpc,
): Promise<TrackedEnquiry | null> {
  const cleanRef = reference.trim().toUpperCase();
  const cleanToken = token.trim();

  if (!/^ENQ-\d{4}-\d{6}$/.test(cleanRef)) {
    return null;
  }

  if (cleanToken.length < 32 || cleanToken.length > 128) {
    return null;
  }

  const tokenHash = hashTrackingToken(cleanToken);

  try {
    const raw = (await rpc(
      "get_tracked_enquiry",
      {
        p_reference: cleanRef,
        p_token_hash: tokenHash,
      },
      { retries: 1 },
    )) as Record<string, unknown> | null;

    if (!raw) return null;

    const timeline = (Array.isArray(raw.timeline) ? raw.timeline : []).map(
      (t: Record<string, unknown>) => ({
        id: String(t.id || ""),
        previousStatus: (t.previous_status as string) || null,
        newStatus: String(t.new_status || ""),
        description: (t.description as string) || null,
        createdAt: String(t.created_at || ""),
      }),
    );

    const items = (Array.isArray(raw.items) ? raw.items : []).map(
      (item: Record<string, unknown>) => ({
        id: String(item.id || ""),
        position: Number(item.position || 0),
        productName: String(item.product_name || ""),
        brandName: (item.brand_name as string) || null,
        unitLabel: String(item.unit_label || ""),
        quantity: Number(item.quantity || 0),
        listedPrice: item.listed_price !== null ? Number(item.listed_price) : null,
      }),
    );

    const rawQuo = raw.quotation as Record<string, unknown> | null;
    const latestQuotation = rawQuo
      ? {
          reference: String(rawQuo.reference || ""),
          version: Number(rawQuo.version || 1),
          totalAmount: Number(rawQuo.total_amount || 0),
          validUntil: (rawQuo.valid_until as string) || null,
          trackingUrl: String(rawQuo.tracking_url || `/quotation/${rawQuo.reference}`),
        }
      : null;

    return {
      reference: String(raw.reference),
      type: raw.type === "BULK" ? "BULK" : "GENERAL",
      status: (raw.status as EnquiryStatus) || "NEW",
      customerName: String(raw.customer_name || "Customer"),
      mobile: String(raw.mobile || ""),
      email: (raw.email as string) || null,
      deliveryLocation: (raw.delivery_location as string) || null,
      message: (raw.message as string) || null,
      createdAt: String(raw.created_at),
      updatedAt: String(raw.updated_at),
      items,
      statusHistory: timeline,
      latestQuotation,
    };
  } catch (error) {
    logger.error("get_tracked_enquiry_rpc_failed", { reference: cleanRef, error });
    return null;
  }
}
