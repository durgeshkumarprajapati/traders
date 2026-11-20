import "server-only";
import { z } from "zod";
import { sendWeb3FormsEmail, type EmailResult, type Web3FormsConfig } from "@/lib/email/web3forms";
import { logger } from "@/lib/logger";
import type { Rpc } from "@/lib/supabase/rest";
import { buildEnquiryEmail } from "./email-template";

/**
 * Durable notification delivery from the outbox (see supabase/migrations). Mechanism:
 *   claim (atomic lease) → send ONE email → record the attempt (SENT, or FAILED with exponential backoff).
 *  - The enquiry is already committed before this runs; a failure here never affects it.
 *  - A SENT row can never be claimed again, so retries cannot duplicate an email that was recorded as delivered.
 *  - Delivery is AT-LEAST-ONCE: if the process dies after Web3Forms accepted the message but before the result
 *    was recorded, the lease expires and the notification is retried (a rare duplicate email is possible).
 */
export type NotificationDeps = {
  rpc: Rpc;
  /** null when WEB3FORMS_ACCESS_KEY is missing/malformed. */
  web3forms: Web3FormsConfig | null;
  send?: (
    config: Web3FormsConfig,
    message: ReturnType<typeof buildEnquiryEmail>,
  ) => Promise<EmailResult>;
};

const num = z.union([z.number(), z.string()]);
const claim = z.object({
  outbox_id: z.uuid(),
  attempt_number: z.number().int().min(1),
  enquiry: z.object({
    reference: z.string(),
    type: z.enum(["BULK", "GENERAL"]),
    customer_name: z.string(),
    mobile: z.string(),
    email: z.string().nullable(),
    delivery_location: z.string().nullable(),
    message: z.string().nullable(),
    created_at: z.string(),
  }),
  items: z.array(
    z.object({
      position: z.number(),
      product_id: z.string(),
      sku: z.string().nullable(),
      product_name: z.string(),
      brand_name: z.string().nullable(),
      unit_label: z.string(),
      quantity: num,
      listed_price: num.nullable(),
      stock_status: z.string(),
    }),
  ),
});

export type ProcessOutcome = "sent" | "failed" | "skipped" | "not_configured" | "unrecorded";

export async function processNotification(
  outboxId: string,
  deps: NotificationDeps,
): Promise<ProcessOutcome> {
  if (!deps.web3forms) {
    // Not configured: do NOT claim (no attempt is consumed); the row stays PENDING until the key is set.
    logger.warn("notification_not_configured", { outboxId });
    return "not_configured";
  }
  const claimed = await deps.rpc<unknown>("claim_notification", {
    p_outbox_id: outboxId,
    p_lease_seconds: 120,
  });
  if (claimed === null || claimed === undefined) return "skipped"; // sent already, backing off, or leased by another worker

  const parsed = claim.safeParse(claimed);
  if (!parsed.success) {
    logger.error("notification_claim_malformed", { outboxId });
    const attemptNo = z.object({ attempt_number: z.number().int().min(1) }).safeParse(claimed);
    if (attemptNo.success) {
      await record(deps.rpc, outboxId, attemptNo.data.attempt_number, {
        ok: false,
        kind: "NETWORK",
        status: null,
        retryable: false,
        summary: "claim payload malformed",
      }).catch(() => undefined);
    }
    return "failed";
  }
  const { attempt_number: attempt, enquiry, items } = parsed.data;

  let result: EmailResult;
  try {
    result = await (deps.send ?? sendWeb3FormsEmail)(
      deps.web3forms,
      buildEnquiryEmail(enquiry, items),
    );
  } catch {
    result = {
      ok: false,
      kind: "NETWORK",
      status: null,
      retryable: true,
      summary: "unexpected error while sending",
    };
  }

  try {
    await record(deps.rpc, outboxId, attempt, result);
  } catch (error) {
    // The email outcome could not be stored. The lease expires and the row is retried (at-least-once).
    logger.error("notification_record_failed", { outboxId, attempt, delivered: result.ok, error });
    return "unrecorded";
  }
  logger.info("notification_attempt", {
    outboxId,
    attempt,
    ok: result.ok,
    kind: result.ok ? null : result.kind,
  });
  return result.ok ? "sent" : "failed";
}

function record(rpc: Rpc, outboxId: string, attempt: number, r: EmailResult) {
  return rpc("record_notification_attempt", {
    p_outbox_id: outboxId,
    p_attempt_number: attempt,
    p_outcome: r.ok ? "SUCCESS" : r.kind === "TIMEOUT" ? "TIMEOUT" : "FAILURE",
    p_http_status: r.ok ? 200 : r.status,
    p_error_code: r.ok ? null : r.kind,
    p_error_summary: r.ok ? null : r.summary,
    p_retryable: r.ok ? true : r.retryable,
  });
}

export type SweepSummary = {
  due: number;
  sent: number;
  failed: number;
  skipped: number;
  notConfigured: number;
  unrecorded: number;
};

/** Attempt every notification that is due (sweeper / opportunistic retry). Sequential on purpose: tiny volume, gentle on the provider. */
export async function processDueNotifications(
  limit: number,
  deps: NotificationDeps,
  maxDurationMs = 20000,
): Promise<SweepSummary> {
  const ids = z
    .array(z.uuid())
    .parse(await deps.rpc<unknown>("list_due_notifications", { p_limit: limit }));
  const summary: SweepSummary = {
    due: ids.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    notConfigured: 0,
    unrecorded: 0,
  };
  const startTime = Date.now();
  for (const id of ids) {
    if (Date.now() - startTime >= maxDurationMs) {
      logger.warn("notification_sweep_deadline_reached", {
        processed: summary.sent + summary.failed + summary.skipped,
        due: summary.due,
      });
      break;
    }
    const o = await processNotification(id, deps);
    if (o === "sent") summary.sent++;
    else if (o === "failed") summary.failed++;
    else if (o === "skipped") summary.skipped++;
    else if (o === "not_configured") summary.notConfigured++;
    else summary.unrecorded++;
  }
  return summary;
}

/** Manual retry (for the future admin screen): resets a FAILED row, refuses SENT rows, then attempts it once. */
export async function retryNotification(outboxId: string, deps: NotificationDeps) {
  const r = z
    .object({ retried: z.boolean(), reason: z.string().optional() })
    .parse(await deps.rpc<unknown>("retry_notification", { p_outbox_id: outboxId }));
  if (!r.retried) return { retried: false as const, reason: r.reason ?? "UNKNOWN" };
  return { retried: true as const, outcome: await processNotification(outboxId, deps) };
}
