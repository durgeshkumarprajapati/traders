"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { loadCatalogue } from "@/features/catalogue/server";
import { logger } from "@/lib/logger";
import { ENQUIRY_MESSAGES, type EnquiryActionResult } from "./result";
import { buildNotificationDeps, loadRateLimitSecret } from "./server/deps";
import { processDueNotifications, processNotification } from "./server/notifications";
import { submitCallbackEnquiry, type SubmitDeps } from "./server/submit";

async function clientIp(): Promise<string | null> {
  const h = await headers();
  const raw = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || null;
  return raw && /^[0-9a-fA-F:.]{3,45}$/.test(raw) ? raw : null;
}

export async function submitCallbackEnquiryAction(input: unknown): Promise<EnquiryActionResult> {
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
    logger.error("callback_enquiry_config_failed", { error });
    return { ok: false, code: "UNAVAILABLE", message: ENQUIRY_MESSAGES.unavailable };
  }
  const ctx = { ip: await clientIp() };
  return submitCallbackEnquiry(input, ctx, deps);
}
