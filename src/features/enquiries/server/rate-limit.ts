import "server-only";
import { createHmac } from "node:crypto";
import { z } from "zod";
import type { Rpc } from "@/lib/supabase/rest";

/**
 * Rate-limit strategy (documented in docs/PHASE_6_REPORT.md):
 *  - Shared store: a Postgres fixed-window counter (`check_rate_limit`), so limits hold across all serverless
 *    instances — process memory is NOT used.
 *  - Keys are HMAC-SHA-256 of the identifier with a server secret: raw IP addresses and mobile numbers are never stored.
 *  - Two independent limits per submission: by client IP and by mobile number.
 *  - Fixed windows can allow up to 2× the limit across a window boundary; acceptable for a low-volume enquiry form.
 */
export const RATE_LIMITS = {
  /** Offices/NAT can share an address, so this is generous: 8 enquiries per 10 minutes per IP. */
  ip: { limit: 8, windowSeconds: 600 },
  /** One person rarely needs more than a few enquiries an hour: 3 per hour per mobile number. */
  mobile: { limit: 3, windowSeconds: 3600 },
  /** Rate limit tracking lookups to prevent brute-forcing: 20 attempts per 10 minutes per IP. */
  tracking: { limit: 20, windowSeconds: 600 },
} as const;

export function hashIdentifier(kind: "ip" | "mobile", value: string, secret: string): string {
  return `${kind}:${createHmac("sha256", secret).update(`${kind}|${value}`).digest("hex").slice(0, 40)}`;
}

const outcome = z.object({ allowed: z.boolean(), retry_after_seconds: z.number().int().min(0) });

export type RateLimitDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

async function hit(rpc: Rpc, key: string, policy: { limit: number; windowSeconds: number }) {
  const r = outcome.parse(
    await rpc("check_rate_limit", {
      p_key: key,
      p_limit: policy.limit,
      p_window_seconds: policy.windowSeconds,
    }),
  );
  return r;
}

/** Check IP first (short-circuits so a blocked IP does not burn the mobile quota), then the mobile number. */
export async function enforceRateLimits(
  rpc: Rpc,
  secret: string,
  who: { ip: string | null; mobile: string },
): Promise<RateLimitDecision> {
  const ip = await hit(rpc, hashIdentifier("ip", who.ip ?? "unknown", secret), RATE_LIMITS.ip);
  if (!ip.allowed)
    return { allowed: false, retryAfterSeconds: Math.max(ip.retry_after_seconds, 1) };
  const mobile = await hit(rpc, hashIdentifier("mobile", who.mobile, secret), RATE_LIMITS.mobile);
  if (!mobile.allowed)
    return { allowed: false, retryAfterSeconds: Math.max(mobile.retry_after_seconds, 1) };
  return { allowed: true };
}

export async function enforceTrackingRateLimit(
  rpc: Rpc,
  secret: string,
  ip: string | null,
): Promise<RateLimitDecision> {
  const res = await hit(
    rpc,
    hashIdentifier("ip", `tracking:${ip ?? "unknown"}`, secret),
    RATE_LIMITS.tracking,
  );
  if (!res.allowed) {
    return { allowed: false, retryAfterSeconds: Math.max(res.retry_after_seconds, 1) };
  }
  return { allowed: true };
}
