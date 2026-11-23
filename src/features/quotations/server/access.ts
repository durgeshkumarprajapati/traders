import "server-only";

import { headers } from "next/headers";
import { buildNotificationDeps, loadRateLimitSecret } from "@/features/enquiries/server/deps";
import { enforceTrackingRateLimit } from "@/features/enquiries/server/rate-limit";
import { logger } from "@/lib/logger";

/**
 * Rate-limit gate for the customer token routes (`/quotation/[token]` and its PDF). Shares the "tracking" budget with the
 * enquiry tracking lookup, so an attacker cannot multiply guesses by alternating routes. Keyed by a salted hash of the
 * client IP (never stored raw). Fails CLOSED when the limiter store is unreachable.
 */
export async function guardTokenAccess(): Promise<
  { allowed: true } | { allowed: false; retryAfterSeconds: number }
> {
  try {
    const h = await headers();
    const raw =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || null;
    const ip = raw && /^[0-9a-fA-F:.]{3,45}$/.test(raw) ? raw : null;
    const nd = buildNotificationDeps();
    const decision = await enforceTrackingRateLimit(nd.rpc, loadRateLimitSecret(), ip);
    return decision.allowed
      ? { allowed: true }
      : { allowed: false, retryAfterSeconds: decision.retryAfterSeconds };
  } catch (error) {
    logger.error("token_access_guard_failed", { error });
    return { allowed: false, retryAfterSeconds: 60 };
  }
}
