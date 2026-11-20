import "server-only";
import { z } from "zod";
import type { CatalogueLoad } from "@/features/catalogue/server";
import { logger } from "@/lib/logger";
import type { Rpc } from "@/lib/supabase/rest";
import { ENQUIRY_MESSAGES, type EnquiryActionResult } from "../result";
import {
  HONEYPOT_FIELD,
  bulkSubmissionSchema,
  contactSubmissionSchema,
  toSubmissionFieldErrors,
} from "../submission-schemas";
import { enforceRateLimits } from "./rate-limit";
import { buildItemSnapshots } from "./snapshots";

/**
 * Public enquiry submission services (BULK and GENERAL only — there is no per-product enquiry type).
 * Flow: honeypot → Zod validation → rate limits → (bulk) authoritative catalogue lookup → ONE database transaction
 * (enquiry + item snapshots + outbox row) → schedule the email attempt AFTER the response. The email never
 * decides whether the enquiry was saved.
 */
export type SubmitDeps = {
  rpc: Rpc;
  rateLimitSecret: string;
  loadCatalogue: () => Promise<CatalogueLoad>;
  /** Run work after the response (Next `after`). Must not throw into the caller. */
  schedule: (task: () => Promise<unknown>) => void;
  processNotification: (outboxId: string) => Promise<unknown>;
  processDue: () => Promise<unknown>;
};
export type SubmitContext = { ip: string | null };

const created = z.object({
  id: z.uuid(),
  reference: z.string().regex(/^ENQ-\d{4}-\d{6}$/),
  outbox_id: z.uuid().nullable(),
  duplicate: z.boolean(),
});

const unavailable = (): EnquiryActionResult => ({
  ok: false,
  code: "UNAVAILABLE",
  message: ENQUIRY_MESSAGES.unavailable,
});

function isHoneypotFilled(input: unknown): boolean {
  if (typeof input !== "object" || input === null) return false;
  const v = (input as Record<string, unknown>)[HONEYPOT_FIELD];
  return typeof v === "string" && v.trim() !== "";
}

type Payload = Record<string, unknown>;

async function persistAndNotify(
  type: "BULK" | "GENERAL",
  payload: Payload,
  itemCount: number,
  deps: SubmitDeps,
): Promise<EnquiryActionResult> {
  let result: z.infer<typeof created>;
  try {
    // Idempotent per idempotency_key, so transient failures can safely be retried.
    result = created.parse(
      await deps.rpc("create_enquiry", { p_payload: payload }, { retries: 2 }),
    );
  } catch (error) {
    logger.error("enquiry_persist_failed", { type, itemCount, error });
    return unavailable();
  }
  logger.info("enquiry_saved", {
    type,
    reference: result.reference,
    items: itemCount,
    duplicate: result.duplicate,
  });

  // After the response: first delivery attempt for this enquiry (also re-attempts it when the customer retried a
  // submission whose first email failed), then a small opportunistic sweep of older due notifications.
  deps.schedule(async () => {
    try {
      if (result.outbox_id) await deps.processNotification(result.outbox_id);
      await deps.processDue();
    } catch (error) {
      logger.error("notification_after_failed", { reference: result.reference, error });
    }
  });
  return { ok: true, reference: result.reference };
}

async function limited(
  rpc: Rpc,
  secret: string,
  ip: string | null,
  mobile: string,
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
    // The limiter store is the same database that stores enquiries: if it is down we cannot save anyway.
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

  const blocked = await limited(deps.rpc, deps.rateLimitSecret, ctx.ip, v.mobile);
  if (blocked) return blocked;

  const load = await deps.loadCatalogue();
  if (!load.ok) return unavailable(); // cannot verify products: never accept unverified items

  const snap = buildItemSnapshots(v.items, load.catalogue);
  if (!snap.ok) {
    return {
      ok: false,
      code: "INVALID_PRODUCTS",
      message: ENQUIRY_MESSAGES.invalidProducts,
      productIds: snap.invalidProductIds,
    };
  }

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
      items: snap.snapshots,
    },
    snap.snapshots.length,
    deps,
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

  const blocked = await limited(deps.rpc, deps.rateLimitSecret, ctx.ip, v.mobile);
  if (blocked) return blocked;

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
      items: [],
    },
    0,
    deps,
  );
}
