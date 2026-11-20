import { NextResponse } from "next/server";
import { buildNotificationDeps, processDueNotifications } from "@/features/enquiries/server/deps";
import { authorizeCron } from "@/lib/cron-auth";
import { toErrorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * Notification sweeper: attempts every due notification (failed ones whose backoff has elapsed, and
 * pending ones whose first attempt never ran) and purges stale rate-limit rows.
 *
 * It is NOT scheduled by this repository. To run it periodically, call it from a scheduler with
 *   Authorization: Bearer <CRON_SECRET>
 * (Vercel Cron sends this header automatically when CRON_SECRET is set; sub-daily schedules need a paid plan, or use any
 * external HTTP scheduler). Without CRON_SECRET the endpoint refuses every request (503) — it is never open.
 * The first delivery attempt happens right after each submission; this route only handles retries.
 */
const noStore = { "cache-control": "no-store" };

async function handle(request: Request) {
  const auth = authorizeCron(request);
  if (auth === "unconfigured") {
    return NextResponse.json(
      { error: { code: "NOT_CONFIGURED", message: "The sweeper is not configured." } },
      { status: 503, headers: noStore },
    );
  }
  if (auth === "unauthorized") {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Unauthorized." } },
      { status: 401, headers: noStore },
    );
  }
  try {
    const deps = buildNotificationDeps();
    const summary = await processDueNotifications(10, deps);
    const purged = await deps.rpc<number>("purge_rate_limits", { p_older_than_seconds: 86400 });
    logger.info("notification_sweep", { ...summary, purged });
    return NextResponse.json(
      { ok: true, ...summary, purgedRateLimits: purged },
      { headers: noStore },
    );
  } catch (error) {
    logger.error("notification_sweep_failed", { error });
    return toErrorResponse(error);
  }
}

export const GET = handle;
export const POST = handle;
