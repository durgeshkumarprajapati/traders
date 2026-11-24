import "server-only";
import { createHash, createHmac, randomUUID } from "node:crypto";
import type { CatalogueLoad } from "@/features/catalogue/server";
import { isHoneypotFilled } from "@/features/enquiries/server/submit";
import { hashIdentifier } from "@/features/enquiries/server/rate-limit";
import type { CustomerEmailProvider } from "@/lib/email/provider";
import { logger } from "@/lib/logger";
import type { Rpc } from "@/lib/supabase/rest";
import {
  RATE_ALERT_CONSENT_TEXT,
  RATE_ALERT_MESSAGES,
  formatPaise,
  parseRupeesToPaise,
  rateAlertSubscribeSchema,
  toPaise,
  type RateAlertResult,
} from "../types";

export type RateAlertDeps = {
  rpc: Rpc;
  provider: CustomerEmailProvider | null;
  secret: string;
  loadCatalogue: () => Promise<CatalogueLoad>;
  /** Public site origin used in email links (never taken from a request). */
  origin: string;
};

/** Tokens are derived from the subscription id with the server secret, so they never need storing: only their hashes are. */
export function rateAlertToken(
  kind: "confirm" | "unsubscribe",
  id: string,
  secret: string,
): string {
  return `ra_${createHmac("sha256", secret).update(`rate-alert:${kind}:v1:${id}`).digest("hex")}`;
}
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const TOKEN_PATTERN = /^ra_[0-9a-f]{64}$/;

const unavailable = (): RateAlertResult => ({
  ok: false,
  code: "UNAVAILABLE",
  message: RATE_ALERT_MESSAGES.unavailable,
});

async function allowed(rpc: Rpc, key: string, limit: number, windowSeconds: number) {
  const r = (await rpc("check_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  })) as {
    allowed?: boolean;
  };
  return r.allowed === true;
}

export async function subscribeRateAlert(
  input: unknown,
  ctx: { ip: string | null },
  deps: RateAlertDeps,
): Promise<RateAlertResult> {
  if (isHoneypotFilled(input)) return { ok: true, message: RATE_ALERT_MESSAGES.checkInbox };
  // Without a real provider no confirmation can be delivered, so nothing is stored and nothing is "confirmed".
  if (!deps.provider) return unavailable();

  const parsed = rateAlertSubscribeSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0] ?? "form")] ??= i.message;
    return {
      ok: false,
      code: "VALIDATION",
      message: "Please check the highlighted fields.",
      fieldErrors,
    };
  }
  const v = parsed.data;

  try {
    const email = v.email.toLowerCase();
    const ok =
      (await allowed(
        deps.rpc,
        `ra-ip:${hashIdentifier("ip", ctx.ip ?? "unknown", deps.secret)}`,
        10,
        3600,
      )) &&
      (await allowed(
        deps.rpc,
        `ra-email:${hashIdentifier("mobile", email, deps.secret)}`,
        5,
        3600,
      ));
    if (!ok)
      return {
        ok: false,
        code: "RATE_LIMITED",
        message: "Too many requests. Please try again later.",
      };

    const load = await deps.loadCatalogue();
    if (!load.ok || load.source !== "LIVE") return unavailable();
    const product = load.catalogue.products.find((p) => p.id === v.productId);
    if (!product || typeof product.price !== "number" || product.price <= 0)
      return {
        ok: false,
        code: "INVALID_PRODUCT",
        message: "This product has no listed rate to follow.",
      };

    const id = randomUUID();
    const confirm = rateAlertToken("confirm", id, deps.secret);
    const unsubscribe = rateAlertToken("unsubscribe", id, deps.secret);
    const created = (
      await deps.rpc<{ created: boolean }>("subscribe_rate_alert", {
        p_id: id,
        p_product_id: product.id,
        p_email: email,
        p_alert_type: v.alertType,
        p_target_price_paise:
          v.alertType === "DROPS_BELOW" ? parseRupeesToPaise(v.targetPrice) : null,
        p_consent_text: RATE_ALERT_CONSENT_TEXT,
        p_confirm_hash: hashToken(confirm),
        p_unsubscribe_hash: hashToken(unsubscribe),
      })
    ).created;

    if (created) {
      const sent = await deps.provider.send({
        to: email,
        subject: `Confirm your rate alert for ${product.name}`,
        text: [
          `You asked Sagar Traders to email you about the listed rate of ${product.name}.`,
          `To start these alerts, confirm here: ${deps.origin}/rate-alerts/confirm#t=${confirm}`,
          `If you did not ask for this, ignore this email — nothing will be sent.`,
          `Unsubscribe any time: ${deps.origin}/rate-alerts/unsubscribe#t=${unsubscribe}`,
        ].join("\n\n"),
      });
      if (!sent.ok) {
        // The confirmation never went out: remove the pending row so the customer can try again, and say so honestly.
        await deps.rpc("unsubscribe_rate_alert", { p_unsubscribe_hash: hashToken(unsubscribe) });
        logger.error("rate_alert_confirmation_failed", { error: sent.error });
        return unavailable();
      }
    }
    return { ok: true, message: RATE_ALERT_MESSAGES.checkInbox };
  } catch (error) {
    logger.error("rate_alert_subscribe_failed", { error });
    return unavailable();
  }
}

export async function confirmRateAlert(token: string, rpc: Rpc): Promise<boolean> {
  if (!TOKEN_PATTERN.test(token)) return false;
  try {
    return (
      (await rpc<boolean>("confirm_rate_alert", { p_confirm_hash: hashToken(token) })) === true
    );
  } catch (error) {
    logger.error("rate_alert_confirm_failed", { error });
    return false;
  }
}

export async function unsubscribeRateAlert(
  token: string,
  rpc: Rpc,
): Promise<"DONE" | "NOT_FOUND" | "ERROR"> {
  if (!TOKEN_PATTERN.test(token)) return "NOT_FOUND";
  try {
    return (await rpc<boolean>("unsubscribe_rate_alert", {
      p_unsubscribe_hash: hashToken(token),
    })) === true
      ? "DONE"
      : "NOT_FOUND";
  } catch (error) {
    logger.error("rate_alert_unsubscribe_failed", { error });
    return "ERROR";
  }
}

export type CycleSummary = {
  snapshotsRecorded: number;
  queued: number;
  sent: number;
  failed: number;
  providerConfigured: boolean;
  skippedReason?: string;
};

/**
 * Daily job: snapshot today's authoritative sheet prices, queue notifications for price changes (exact integer comparison in
 * the database, idempotent per day), and send them if — and only if — a provider exists. The live Google Sheet is required:
 * the built-in fallback catalogue is never snapshotted, so a Sheets outage cannot register as a "price change".
 */
export async function runRateAlertCycle(
  deps: Omit<RateAlertDeps, "secret"> & { secret: string },
  today: string,
): Promise<CycleSummary> {
  const summary: CycleSummary = {
    snapshotsRecorded: 0,
    queued: 0,
    sent: 0,
    failed: 0,
    providerConfigured: deps.provider !== null,
  };
  const load = await deps.loadCatalogue();
  if (!load.ok || load.source !== "LIVE")
    return { ...summary, skippedReason: "LIVE_CATALOGUE_UNAVAILABLE" };

  const prices = load.catalogue.products
    .filter((p) => typeof p.price === "number" && p.price > 0)
    .map((p) => ({ product_id: p.id, price_paise: toPaise(p.price as number) }));
  summary.snapshotsRecorded = await deps.rpc<number>("record_price_snapshots", {
    p_date: today,
    p_prices: prices,
  });
  summary.queued = await deps.rpc<number>("queue_rate_alert_notifications", { p_date: today });
  if (!deps.provider) return { ...summary, skippedReason: "NO_EMAIL_PROVIDER" };

  const due = await deps.rpc<
    Array<{
      id: string;
      subscription_id: string;
      email: string;
      product_id: string;
      price_from_paise: number | null;
      price_to_paise: number;
    }>
  >("list_rate_alerts_due", { p_limit: 50 });
  const names = new Map(load.catalogue.products.map((p) => [p.id, p.name]));
  for (const n of due) {
    const name = names.get(n.product_id) ?? "a product you follow";
    const unsubscribe = rateAlertToken("unsubscribe", n.subscription_id, deps.secret);
    const res = await deps.provider.send({
      to: n.email,
      subject: `Listed rate update: ${name}`,
      text: [
        `The listed rate for ${name} is now ${formatPaise(n.price_to_paise)}${n.price_from_paise ? ` (was ${formatPaise(n.price_from_paise)})` : ""}.`,
        `Listed rates are indicative and may change; Sagar Traders confirms the rate and availability when you enquire.`,
        `Unsubscribe: ${deps.origin}/rate-alerts/unsubscribe#t=${unsubscribe}`,
      ].join("\n\n"),
    });
    await deps.rpc("record_rate_alert_result", {
      p_id: n.id,
      p_sent: res.ok,
      p_error: res.ok ? null : res.error,
    });
    if (res.ok) summary.sent++;
    else summary.failed++;
  }
  return summary;
}
