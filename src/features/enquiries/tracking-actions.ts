"use server";

import { headers } from "next/headers";
import { logger } from "@/lib/logger";
import { buildNotificationDeps, loadRateLimitSecret } from "./server/deps";
import { enforceTrackingRateLimit } from "./server/rate-limit";
import { getTrackedEnquiry } from "./server/tracking";
import type { TrackedEnquiry } from "./tracking-types";

async function clientIp(): Promise<string | null> {
  const h = await headers();
  const raw = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || null;
  return raw && /^[0-9a-fA-F:.]{3,45}$/.test(raw) ? raw : null;
}

export async function trackEnquiryAction(
  reference: string,
  token: string,
): Promise<
  { ok: true; data: TrackedEnquiry } | { ok: false; message: string; retryAfterSeconds?: number }
> {
  try {
    const nd = buildNotificationDeps();
    const secret = loadRateLimitSecret();
    const ip = await clientIp();

    const rate = await enforceTrackingRateLimit(nd.rpc, secret, ip);
    if (!rate.allowed) {
      const minutes = Math.max(1, Math.ceil(rate.retryAfterSeconds / 60));
      return {
        ok: false,
        message: `Too many lookup attempts. Please try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`,
        retryAfterSeconds: rate.retryAfterSeconds,
      };
    }

    const data = await getTrackedEnquiry(reference, token, nd.rpc);
    if (!data) {
      return {
        ok: false,
        message:
          "Enquiry not found or the tracking token has expired or is invalid. Please verify your reference and token or contact Sagar Traders directly.",
      };
    }

    return { ok: true, data };
  } catch (error) {
    logger.error("track_enquiry_action_failed", { reference, error });
    return {
      ok: false,
      message: "The enquiry tracking service is temporarily unavailable. Please try again shortly.",
    };
  }
}
