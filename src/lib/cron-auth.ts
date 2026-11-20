import { createHash, timingSafeEqual } from "node:crypto";

const digest = (v: string) => createHash("sha256").update(v).digest();

/**
 * Bearer-token check for operator-only routes (sweeper, email test). `CRON_SECRET` must be set and >= 16 chars;
 * without it every request is refused ("unconfigured") — such routes are never open. Constant-time comparison.
 */
export function authorizeCron(request: Request): "ok" | "unauthorized" | "unconfigured" {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || secret.length < 16) return "unconfigured";
  const given = request.headers.get("authorization") ?? "";
  return timingSafeEqual(digest(given), digest(`Bearer ${secret}`)) ? "ok" : "unauthorized";
}
