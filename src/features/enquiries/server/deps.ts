import "server-only";
import { loadSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseRpc } from "@/lib/supabase/rest";
import { loadWeb3FormsConfig } from "@/lib/email/web3forms";
import {
  processDueNotifications,
  processNotification,
  type NotificationDeps,
} from "./notifications";
import { SupabaseError } from "@/lib/supabase/errors";

/** Server-only wiring of the real integrations. Throws a (generic, secret-free) SupabaseError when configuration is missing. */
export function buildNotificationDeps(): NotificationDeps {
  const rpc = createSupabaseRpc(loadSupabaseConfig());
  return { rpc, web3forms: loadWeb3FormsConfig() };
}

export function loadRateLimitSecret(env: Record<string, string | undefined> = process.env): string {
  const s = env.RATE_LIMIT_SECRET?.trim();
  if (!s || s.length < 16) {
    throw new SupabaseError(
      "INTERNAL",
      "The service is temporarily unavailable.",
      "RATE_LIMIT_SECRET is missing or shorter than 16 characters",
    );
  }
  return s;
}

export { processDueNotifications, processNotification };
