"use server";

import { headers } from "next/headers";
import { loadCatalogue } from "@/features/catalogue/server";
import { loadRateLimitSecret } from "@/features/enquiries/server/deps";
import { loadCustomerEmailProvider } from "@/lib/email/provider";
import { publicEnv } from "@/lib/env/public";
import { logger } from "@/lib/logger";
import { loadSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseRpc } from "@/lib/supabase/rest";
import { confirmRateAlert, subscribeRateAlert, unsubscribeRateAlert } from "./server/service";
import { RATE_ALERT_MESSAGES, type RateAlertResult } from "./types";

async function clientIp(): Promise<string | null> {
  const h = await headers();
  const raw = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || null;
  return raw && /^[0-9a-fA-F:.]{3,45}$/.test(raw) ? raw : null;
}

/** True when customers can subscribe. The page uses this to show "unavailable" instead of a form that cannot work. */
export async function rateAlertsAvailable(): Promise<boolean> {
  return loadCustomerEmailProvider() !== null;
}

export async function subscribeRateAlertAction(input: unknown): Promise<RateAlertResult> {
  try {
    return await subscribeRateAlert(
      input,
      { ip: await clientIp() },
      {
        rpc: createSupabaseRpc(loadSupabaseConfig()),
        provider: loadCustomerEmailProvider(),
        secret: loadRateLimitSecret(),
        loadCatalogue,
        origin: publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, ""),
      },
    );
  } catch (error) {
    logger.error("rate_alert_action_failed", { error });
    return { ok: false, code: "UNAVAILABLE", message: RATE_ALERT_MESSAGES.unavailable };
  }
}

export async function confirmRateAlertAction(token: unknown): Promise<boolean> {
  if (typeof token !== "string") return false;
  try {
    return await confirmRateAlert(token, createSupabaseRpc(loadSupabaseConfig()));
  } catch {
    return false;
  }
}

export async function unsubscribeRateAlertAction(
  token: unknown,
): Promise<"DONE" | "NOT_FOUND" | "ERROR"> {
  if (typeof token !== "string") return "NOT_FOUND";
  try {
    return await unsubscribeRateAlert(token, createSupabaseRpc(loadSupabaseConfig()));
  } catch {
    return "ERROR";
  }
}
