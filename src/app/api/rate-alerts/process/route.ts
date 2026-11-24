import { NextResponse } from "next/server";
import { loadCatalogue } from "@/features/catalogue/server";
import { loadRateLimitSecret } from "@/features/enquiries/server/deps";
import { runRateAlertCycle } from "@/features/rate-alerts/server/service";
import { authorizeCron } from "@/lib/cron-auth";
import { loadCustomerEmailProvider } from "@/lib/email/provider";
import { publicEnv } from "@/lib/env/public";
import { toErrorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { loadSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseRpc } from "@/lib/supabase/rest";

/**
 * Daily rate-alert job (see vercel.json). Requires `Authorization: Bearer <CRON_SECRET>`; without CRON_SECRET it refuses everything.
 * Records price snapshots and queues changes even with no email provider; it only SENDS when a provider is configured.
 */
const noStore = { "cache-control": "no-store" };
const todayIst = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

async function handle(request: Request) {
  const auth = authorizeCron(request);
  if (auth === "unconfigured")
    return NextResponse.json(
      { error: { code: "NOT_CONFIGURED", message: "The job is not configured." } },
      { status: 503, headers: noStore },
    );
  if (auth === "unauthorized")
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Unauthorized." } },
      { status: 401, headers: noStore },
    );
  try {
    const summary = await runRateAlertCycle(
      {
        rpc: createSupabaseRpc(loadSupabaseConfig()),
        provider: loadCustomerEmailProvider(),
        secret: loadRateLimitSecret(),
        loadCatalogue,
        origin: publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, ""),
      },
      todayIst(),
    );
    logger.info("rate_alert_cycle", { ...summary });
    return NextResponse.json({ ok: true, ...summary }, { headers: noStore });
  } catch (error) {
    logger.error("rate_alert_cycle_failed", { error });
    return toErrorResponse(error);
  }
}

export const GET = handle;
export const POST = handle;
