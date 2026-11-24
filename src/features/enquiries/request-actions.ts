"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { loadCatalogue } from "@/features/catalogue/server";
import { logger } from "@/lib/logger";
import {
  COVERAGE_MESSAGES,
  checkCoverage,
  type CoverageStatus,
} from "@/features/delivery/coverage";
import { pinCheckSchema } from "@/features/delivery/schemas";
import { ENQUIRY_MESSAGES, type EnquiryActionResult } from "./result";
import { buildNotificationDeps, loadRateLimitSecret } from "./server/deps";
import { processDueNotifications, processNotification } from "./server/notifications";
import { submitExpertEnquiry, submitFreightEnquiry } from "./server/requests";
import type { SubmitDeps } from "./server/submit";

async function clientIp(): Promise<string | null> {
  const h = await headers();
  const raw = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || null;
  return raw && /^[0-9a-fA-F:.]{3,45}$/.test(raw) ? raw : null;
}

function buildDeps(): SubmitDeps | null {
  try {
    const nd = buildNotificationDeps();
    return {
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
    logger.error("request_enquiry_config_failed", { error });
    return null;
  }
}

const unavailable: EnquiryActionResult = {
  ok: false,
  code: "UNAVAILABLE",
  message: ENQUIRY_MESSAGES.unavailable,
};

export async function submitFreightEnquiryAction(input: unknown): Promise<EnquiryActionResult> {
  const deps = buildDeps();
  if (!deps) return unavailable;
  return submitFreightEnquiry(input, { ip: await clientIp() }, deps);
}

export async function submitExpertEnquiryAction(input: unknown): Promise<EnquiryActionResult> {
  const deps = buildDeps();
  if (!deps) return unavailable;
  return submitExpertEnquiry(input, { ip: await clientIp() }, deps);
}

export type DeliveryCheckResult = {
  status: CoverageStatus;
  message: string;
  notes: string | null;
  terms: string | null;
  localities: string | null;
};

/** Public, read-only: compares a PIN code with the owner's published list. Stores nothing and never promises delivery. */
export async function checkDeliveryAction(pincode: unknown): Promise<DeliveryCheckResult> {
  const parsed = pinCheckSchema.safeParse({ pincode });
  const empty = { notes: null, terms: null, localities: null };
  if (!parsed.success) return { status: "INVALID", message: COVERAGE_MESSAGES.INVALID, ...empty };
  const load = await loadCatalogue();
  const delivery = load.ok && load.source === "LIVE" ? load.settings.delivery : undefined;
  const status = checkCoverage(parsed.data.pincode, delivery);
  return {
    status,
    message: COVERAGE_MESSAGES[status],
    notes: delivery?.enabled ? delivery.notes : null,
    terms: delivery?.enabled ? delivery.terms : null,
    localities: delivery?.enabled ? delivery.localities : null,
  };
}
