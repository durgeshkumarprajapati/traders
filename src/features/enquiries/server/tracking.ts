import "server-only";

import { createHash, createHmac, randomBytes } from "node:crypto";
import { logger } from "@/lib/logger";
import type { Rpc } from "@/lib/supabase/rest";
import type { EnquiryStatus } from "@/components/ui/status-badge";
import type { TrackedEnquiry } from "../tracking-types";

export type { TrackedEnquiry };

/**
 * Tracking token. Random by default. When a `seed` (the submission's idempotency key) and a server `secret` are given the
 * token is an HMAC of the seed instead, so a retried submission (same key) gets the SAME token whose hash is already
 * stored. It stays unguessable: it cannot be derived without the server secret. The HMAC input is domain-separated so the
 * shared secret is never used to produce the same value for any other purpose (e.g. rate-limit keys).
 */
export function generateTrackingToken(seed?: string, secret?: string): string {
  if (seed && secret) {
    const hmac = createHmac("sha256", secret).update(`tracking-token:v1:${seed}`).digest("hex");
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

  // Current references are random (ENQ-XXXX-XXXX-XXXX); older ones were sequential (ENQ-YYYY-NNNNNN).
  if (!/^ENQ-(?:\d{4}-\d{6}|[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4})$/.test(cleanRef)) {
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
          isExpired: rawQuo.is_expired === true,
        }
      : null;

    return {
      reference: String(raw.reference),
      type: raw.type === "BULK" ? "BULK" : "GENERAL",
      status: (raw.status as EnquiryStatus) || "NEW",
      deliveryLocation: (raw.delivery_location as string) || null,
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
