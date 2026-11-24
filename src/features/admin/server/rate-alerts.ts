import "server-only";
import { connection } from "next/server";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminRateAlertOverview =
  | { ok: false }
  | {
      ok: true;
      counts: { pending: number; active: number; unsubscribed: number };
      lastSnapshotDate: string | null;
      notificationCounts: { pending: number; sent: number; failed: number };
      subscriptions: Array<{
        id: string;
        productId: string;
        email: string;
        alertType: string;
        targetPricePaise: number | null;
        status: string;
        createdAt: string;
      }>;
      notifications: Array<{
        id: string;
        status: string;
        snapshotDate: string;
        priceToPaise: number;
        attempts: number;
        lastError: string | null;
      }>;
    };

/** Reads through the administrator's own session (RLS `is_admin()`); the token hashes are not readable by that role at all. */
export async function loadAdminRateAlerts(): Promise<AdminRateAlertOverview> {
  await connection();
  try {
    const db = await createSupabaseServerClient();
    const count = async (table: string, col: string, value: string) => {
      const r = await db.from(table).select("*", { count: "exact", head: true }).eq(col, value);
      if (r.error) throw r.error;
      return r.count ?? 0;
    };
    const [pending, active, unsubscribed, nPending, nSent, nFailed, subs, notes, snap] =
      await Promise.all([
        count("rate_alert_subscriptions", "status", "PENDING"),
        count("rate_alert_subscriptions", "status", "ACTIVE"),
        count("rate_alert_subscriptions", "status", "UNSUBSCRIBED"),
        count("rate_alert_notifications", "status", "PENDING"),
        count("rate_alert_notifications", "status", "SENT"),
        count("rate_alert_notifications", "status", "FAILED"),
        db
          .from("rate_alert_subscriptions")
          .select("id, product_id, email, alert_type, target_price_paise, status, created_at")
          .order("created_at", { ascending: false })
          .limit(50),
        db
          .from("rate_alert_notifications")
          .select("id, status, snapshot_date, price_to_paise, attempts, last_error")
          .order("created_at", { ascending: false })
          .limit(30),
        db
          .from("product_price_snapshots")
          .select("captured_on")
          .order("captured_on", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
    if (subs.error || notes.error) throw subs.error ?? notes.error;
    return {
      ok: true,
      counts: { pending, active, unsubscribed },
      notificationCounts: { pending: nPending, sent: nSent, failed: nFailed },
      lastSnapshotDate: (snap.data as { captured_on?: string } | null)?.captured_on ?? null,
      subscriptions: (subs.data ?? []).map((s) => ({
        id: s.id as string,
        productId: s.product_id as string,
        email: s.email as string,
        alertType: s.alert_type as string,
        targetPricePaise: s.target_price_paise === null ? null : Number(s.target_price_paise),
        status: s.status as string,
        createdAt: s.created_at as string,
      })),
      notifications: (notes.data ?? []).map((n) => ({
        id: n.id as string,
        status: n.status as string,
        snapshotDate: n.snapshot_date as string,
        priceToPaise: Number(n.price_to_paise),
        attempts: Number(n.attempts),
        lastError: (n.last_error as string | null) ?? null,
      })),
    };
  } catch (error) {
    logger.error("admin_rate_alerts_load_failed", { error });
    return { ok: false };
  }
}
