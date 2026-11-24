import "server-only";
import { z } from "zod";
import type { CatalogueLoad } from "@/features/catalogue/server";
import {
  loadWeb3FormsConfig,
  sendWeb3FormsEmail,
  type Web3FormsConfig,
} from "@/lib/email/web3forms";
import { logger } from "@/lib/logger";
import type { Rpc } from "@/lib/supabase/rest";
import { ENQUIRY_MESSAGES, type EnquiryActionResult } from "../result";
import {
  HONEYPOT_FIELD,
  bulkSubmissionSchema,
  contactSubmissionSchema,
  toSubmissionFieldErrors,
} from "../submission-schemas";
import { CALLBACK_TIME_WINDOW_LABELS, callbackSubmissionSchema } from "../callback-schemas";
import { buildEnquiryEmail, type EmailEnquiry, type EmailItem } from "./email-template";
import { enforceRateLimits } from "./rate-limit";
import { buildItemSnapshots, type ItemSnapshot } from "./snapshots";
import { ENQUIRY_REFERENCE } from "../reference";
import { trackingPath } from "../tracking-types";
import { generateTrackingToken, hashTrackingToken } from "./tracking";

/**
 * Public enquiry submission services (BULK and GENERAL only — there is no per-product enquiry type).
 * Flow: honeypot → Zod validation → rate limits → (bulk) authoritative catalogue lookup → ONE database transaction
 * (enquiry + item snapshots + outbox row) → schedule the email attempt AFTER the response. The email never
 * decides whether the enquiry was saved.
 *
 * Degraded fallback: If Supabase database persistence is unavailable, an email-only fallback delivers the
 * validated enquiry directly to the business owner via Web3Forms without falsely claiming database storage.
 */
export type SubmitDeps = {
  rpc: Rpc;
  rateLimitSecret: string;
  loadCatalogue: () => Promise<CatalogueLoad>;
  /** Run work after the response (Next `after`). Must not throw into the caller. */
  schedule: (task: () => Promise<unknown>) => void;
  processNotification: (outboxId: string) => Promise<unknown>;
  processDue: () => Promise<unknown>;
  web3formsConfig?: Web3FormsConfig | null;
  sendEmail?: typeof sendWeb3FormsEmail;
  enableEmailFallback?: boolean;
};
export type SubmitContext = { ip: string | null };

const created = z.object({
  id: z.uuid(),
  reference: z.string().regex(ENQUIRY_REFERENCE),
  outbox_id: z.uuid().nullable(),
  duplicate: z.boolean(),
});

export const unavailable = (): EnquiryActionResult => ({
  ok: false,
  code: "UNAVAILABLE",
  message: ENQUIRY_MESSAGES.unavailable,
});

export function isHoneypotFilled(input: unknown): boolean {
  if (typeof input !== "object" || input === null) return false;
  const v = (input as Record<string, unknown>)[HONEYPOT_FIELD];
  return typeof v === "string" && v.trim() !== "";
}

type Payload = Record<string, unknown>;

// In-memory rate limiting bucket for degraded mode (when database is down)
const fallbackBuckets = new Map<string, number[]>();
const FALLBACK_MAX = 5; // max 5 submissions per hour
const FALLBACK_WINDOW_MS = 60 * 60 * 1000;

function checkFallbackRateLimit(key: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const timestamps = (fallbackBuckets.get(key) ?? []).filter((t) => now - t < FALLBACK_WINDOW_MS);
  if (timestamps.length >= FALLBACK_MAX) {
    fallbackBuckets.set(key, timestamps);
    const oldest = timestamps[0];
    const retryAfter = Math.max(1, Math.ceil((oldest + FALLBACK_WINDOW_MS - now) / 1000));
    return { allowed: false, retryAfterSeconds: retryAfter };
  }
  timestamps.push(now);
  fallbackBuckets.set(key, timestamps);
  return { allowed: true, retryAfterSeconds: 0 };
}

async function deliverEmailOnlyFallback(
  type: "BULK" | "GENERAL",
  payload: Payload,
  deps: SubmitDeps,
): Promise<EnquiryActionResult> {
  const config = deps.web3formsConfig !== undefined ? deps.web3formsConfig : loadWeb3FormsConfig();
  if (!config) {
    logger.warn("email_fallback_skipped_not_configured");
    return unavailable();
  }

  const year = new Date().getFullYear();
  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  const fallbackRef = `ENQ-${year}-FAL-${randomSuffix}`;

  const enquiry: EmailEnquiry = {
    reference: fallbackRef,
    type,
    customer_name: String(payload.name || ""),
    mobile: String(payload.mobile || ""),
    email: payload.email ? String(payload.email) : null,
    delivery_location: payload.delivery_location ? String(payload.delivery_location) : null,
    message: payload.message ? String(payload.message) : null,
    created_at: new Date().toISOString(),
  };

  const rawItems = (Array.isArray(payload.items) ? payload.items : []) as ItemSnapshot[];
  const items: EmailItem[] = rawItems.map((item, idx) => ({
    position: idx + 1,
    product_id: item.product_id,
    sku: item.sku,
    product_name: item.product_name,
    brand_name: item.brand_name,
    unit_label: item.unit_label,
    quantity: item.quantity,
    listed_price: item.listed_price,
    stock_status: item.stock_status,
  }));

  const emailMsg = buildEnquiryEmail(enquiry, items);
  emailMsg.text = `[DEGRADED EMAIL FALLBACK - Database storage was temporarily unavailable]\n[Note: This enquiry is delivered directly via email and is NOT in the admin dashboard]\n\n${emailMsg.text}`;

  const send = deps.sendEmail ?? sendWeb3FormsEmail;
  const res = await send(config, emailMsg);

  if (res.ok) {
    logger.info("enquiry_email_only_fallback_delivered", {
      type,
      reference: fallbackRef,
      itemCount: items.length,
    });
    return {
      ok: true,
      reference: fallbackRef,
      mode: "EMAIL_FALLBACK",
      message: "Your enquiry has been sent successfully. Our team will contact you shortly.",
    };
  }

  logger.error("enquiry_email_only_fallback_failed", {
    type,
    reference: fallbackRef,
    kind: res.kind,
    summary: res.summary,
  });
  return unavailable();
}

export async function persistAndNotify(
  type: "BULK" | "GENERAL",
  payload: Payload,
  itemCount: number,
  deps: SubmitDeps,
  trackingToken?: string | null,
): Promise<EnquiryActionResult> {
  let result: z.infer<typeof created>;
  try {
    // Primary path: One idempotent transaction in PostgreSQL via Supabase
    result = created.parse(
      await deps.rpc("create_enquiry", { p_payload: payload }, { retries: 2 }),
    );
  } catch (error) {
    if (deps.enableEmailFallback) {
      logger.warn("enquiry_primary_persist_failed_attempting_email_fallback", {
        type,
        itemCount,
        error,
      });
      const fallback = await deliverEmailOnlyFallback(type, payload, deps);
      if (fallback.ok) {
        return fallback;
      }
    }
    logger.error("enquiry_persist_failed", { type, itemCount, error });
    return unavailable();
  }
  logger.info("enquiry_saved", {
    type,
    reference: result.reference,
    items: itemCount,
    duplicate: result.duplicate,
  });

  // After the response: first delivery attempt for this enquiry
  deps.schedule(async () => {
    try {
      if (result.outbox_id) await deps.processNotification(result.outbox_id);
      await deps.processDue();
    } catch (error) {
      logger.error("notification_after_failed", { reference: result.reference, error });
    }
  });
  return {
    ok: true,
    reference: result.reference,
    mode: "PERSISTED",
    trackingToken: trackingToken ?? null,
    trackingUrl: trackingToken ? trackingPath(result.reference, trackingToken) : null,
  };
}

export async function limited(
  rpc: Rpc,
  secret: string,
  ip: string | null,
  mobile: string,
  deps?: SubmitDeps,
): Promise<EnquiryActionResult | null> {
  try {
    const d = await enforceRateLimits(rpc, secret, { ip, mobile });
    if (d.allowed) return null;
    const minutes = Math.max(1, Math.ceil(d.retryAfterSeconds / 60));
    return {
      ok: false,
      code: "RATE_LIMITED",
      retryAfterSeconds: d.retryAfterSeconds,
      message: `Too many enquiries from this connection. Please try again in about ${minutes} minute${minutes === 1 ? "" : "s"}, or contact us directly.`,
    };
  } catch (error) {
    if (deps?.enableEmailFallback) {
      logger.warn("rate_limit_db_down_using_memory_fallback", { error });
      const fallbackKey = `${ip ?? "no-ip"}:${mobile}`;
      const fb = checkFallbackRateLimit(fallbackKey);
      if (!fb.allowed) {
        const minutes = Math.max(1, Math.ceil(fb.retryAfterSeconds / 60));
        return {
          ok: false,
          code: "RATE_LIMITED",
          retryAfterSeconds: fb.retryAfterSeconds,
          message: `Too many enquiries from this connection. Please try again in about ${minutes} minute${minutes === 1 ? "" : "s"}, or contact us directly.`,
        };
      }
      return null;
    }
    logger.error("rate_limit_failed", { error });
    return unavailable();
  }
}

export async function submitBulkEnquiry(
  input: unknown,
  ctx: SubmitContext,
  deps: SubmitDeps,
): Promise<EnquiryActionResult> {
  if (isHoneypotFilled(input)) {
    logger.info("honeypot_triggered", { form: "bulk" });
    return { ok: true, reference: null }; // look successful to bots, store nothing
  }
  const parsed = bulkSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: ENQUIRY_MESSAGES.validation,
      fieldErrors: toSubmissionFieldErrors(parsed.error),
    };
  }
  const v = parsed.data;

  const blocked = await limited(deps.rpc, deps.rateLimitSecret, ctx.ip, v.mobile, deps);
  if (blocked) return blocked;

  const load = await deps.loadCatalogue();
  if (!load.ok) return unavailable();

  const snap = buildItemSnapshots(v.items, load.catalogue);
  if (!snap.ok) {
    return {
      ok: false,
      code: "INVALID_PRODUCTS",
      message: ENQUIRY_MESSAGES.invalidProducts,
      productIds: snap.invalidProductIds,
    };
  }

  const trackingToken = generateTrackingToken(v.idempotencyKey, deps.rateLimitSecret);
  const tokenHash = hashTrackingToken(trackingToken);

  return persistAndNotify(
    "BULK",
    {
      idempotency_key: v.idempotencyKey,
      type: "BULK",
      name: v.name,
      mobile: v.mobile,
      email: v.email,
      delivery_location: v.deliveryLocation,
      message: v.message,
      tracking_token_hash: tokenHash,
      items: snap.snapshots,
    },
    snap.snapshots.length,
    deps,
    trackingToken,
  );
}

export async function submitContactEnquiry(
  input: unknown,
  ctx: SubmitContext,
  deps: SubmitDeps,
): Promise<EnquiryActionResult> {
  if (isHoneypotFilled(input)) {
    logger.info("honeypot_triggered", { form: "contact" });
    return { ok: true, reference: null };
  }
  const parsed = contactSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: ENQUIRY_MESSAGES.validation,
      fieldErrors: toSubmissionFieldErrors(parsed.error),
    };
  }
  const v = parsed.data;

  const blocked = await limited(deps.rpc, deps.rateLimitSecret, ctx.ip, v.mobile, deps);
  if (blocked) return blocked;

  const trackingToken = generateTrackingToken(v.idempotencyKey, deps.rateLimitSecret);
  const tokenHash = hashTrackingToken(trackingToken);

  // GENERAL enquiries need no products and no catalogue access: a customer can always contact the business.
  return persistAndNotify(
    "GENERAL",
    {
      idempotency_key: v.idempotencyKey,
      type: "GENERAL",
      name: v.name,
      mobile: v.mobile,
      email: v.email,
      message: v.message,
      tracking_token_hash: tokenHash,
      items: [],
    },
    0,
    deps,
    trackingToken,
  );
}

export async function submitCallbackEnquiry(
  input: unknown,
  ctx: SubmitContext,
  deps: SubmitDeps,
): Promise<EnquiryActionResult> {
  if (isHoneypotFilled(input)) {
    logger.info("honeypot_triggered", { form: "callback" });
    return { ok: true, reference: null };
  }
  const parsed = callbackSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: ENQUIRY_MESSAGES.validation,
      fieldErrors: toSubmissionFieldErrors(parsed.error),
    };
  }
  const v = parsed.data;

  const blocked = await limited(deps.rpc, deps.rateLimitSecret, ctx.ip, v.mobile, deps);
  if (blocked) return blocked;

  const trackingToken = generateTrackingToken(v.idempotencyKey, deps.rateLimitSecret);
  const tokenHash = hashTrackingToken(trackingToken);

  // The structured preference lives in enquiry_callbacks; this text only gives the admin a readable one-line summary.
  const message = [
    `Callback requested (${CALLBACK_TIME_WINDOW_LABELS[v.preferredTimeWindow]}${v.preferredDate ? `, ${v.preferredDate}` : ", earliest convenience"}).`,
    v.reason && `Reason: ${v.reason}`,
    v.message,
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 1000);

  return persistAndNotify(
    "GENERAL",
    {
      idempotency_key: v.idempotencyKey,
      type: "GENERAL",
      name: v.name,
      mobile: v.mobile,
      email: v.email,
      message,
      tracking_token_hash: tokenHash,
      callback: {
        preferred_date: v.preferredDate || null,
        preferred_time_window: v.preferredTimeWindow,
        reason: v.reason || null,
      },
      items: [],
    },
    0,
    deps,
    trackingToken,
  );
}
