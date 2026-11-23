"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { loadCatalogue } from "@/features/catalogue/server";
import { logger } from "@/lib/logger";
import { ENQUIRY_MESSAGES, type EnquiryActionResult } from "./result";
import { buildNotificationDeps, loadRateLimitSecret } from "./server/deps";
import { processDueNotifications, processNotification } from "./server/notifications";
import { submitBulkEnquiry, submitContactEnquiry, type SubmitDeps } from "./server/submit";

/**
 * Public enquiry Server Actions. They are public HTTP endpoints: everything is validated again on the server,
 * product facts come from the server-side catalogue, and no authorisation is needed or assumed (customers are anonymous).
 * Next.js additionally enforces same-origin for Server Actions.
 */

/** First address of `x-forwarded-for` (set by Vercel's proxy), shape-checked. Used only as a rate-limit key (hashed). */
async function clientIp(): Promise<string | null> {
  const h = await headers();
  const raw = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || null;
  return raw && /^[0-9a-fA-F:.]{3,45}$/.test(raw) ? raw : null;
}

async function run(kind: "bulk" | "contact", input: unknown): Promise<EnquiryActionResult> {
  let deps: SubmitDeps;
  try {
    const nd = buildNotificationDeps();
    deps = {
      rpc: nd.rpc,
      rateLimitSecret: loadRateLimitSecret(),
      loadCatalogue,
      schedule: (task) => after(task),
      processNotification: (id) => processNotification(id, nd),
      processDue: () => processDueNotifications(3, nd),
      web3formsConfig: nd.web3forms,
      enableEmailFallback: false,
    };
  } catch (error) {
    logger.error("enquiry_config_failed", { error }); // names of missing variables only; never values
    return { ok: false, code: "UNAVAILABLE", message: ENQUIRY_MESSAGES.unavailable };
  }
  const ctx = { ip: await clientIp() };
  if (kind === "bulk") return submitBulkEnquiry(input, ctx, deps);
  return submitContactEnquiry(input, ctx, deps);
}

export async function submitBulkEnquiryAction(input: unknown): Promise<EnquiryActionResult> {
  return run("bulk", input);
}

export async function submitContactEnquiryAction(input: unknown): Promise<EnquiryActionResult> {
  return run("contact", input);
}
