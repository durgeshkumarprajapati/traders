import "server-only";

import { loadAdminCatalogue } from "@/features/catalogue/server";
import { loadWeb3FormsConfig } from "@/lib/email/web3forms";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface ServiceStatus {
  status: "connected" | "degraded" | "not_configured" | "error" | "configured";
  message?: string;
  details?: Record<string, unknown>;
}

export interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  durationMs: number;
  checks: {
    app: ServiceStatus;
    googleSheets: ServiceStatus;
    supabase: ServiceStatus;
    notifications: ServiceStatus;
  };
}

const TIMEOUT_MS = 3500;

export async function checkHealth(): Promise<HealthCheckResult> {
  const startedAt = Date.now();
  const checks: HealthCheckResult["checks"] = {
    app: {
      status: "connected",
      message: "Application server online",
      details: {
        uptimeSeconds: Math.floor(process.uptime()),
        nodeVersion: process.version,
      },
    },
    googleSheets: { status: "not_configured" },
    supabase: { status: "not_configured" },
    notifications: { status: "not_configured" },
  };

  // 1. Google Sheets Check
  try {
    const catResult = await Promise.race([
      loadAdminCatalogue(),
      new Promise<{ ok: false; error: string }>((resolve) =>
        setTimeout(
          () => resolve({ ok: false, error: "Google Sheets request timeout" }),
          TIMEOUT_MS,
        ),
      ),
    ]);

    if (catResult.ok) {
      checks.googleSheets = {
        status: "connected",
        message: "Google Sheets API connected and catalogue snapshot loaded.",
        details: {
          totalProducts: catResult.snapshot.products.length,
          totalCategories: catResult.snapshot.categories.length,
          totalBrands: catResult.snapshot.brands.length,
          issuesCount: catResult.snapshot.issues.length,
        },
      };
    } else {
      const err = catResult.error;
      if (
        err.includes("does not exist") ||
        err.includes("misnamed") ||
        err.includes("SheetsStructureError")
      ) {
        checks.googleSheets = {
          status: "degraded",
          message: `Spreadsheet connected, but required worksheets pending import (${err.slice(0, 120)}).`,
        };
      } else if (err.includes("missing") || err.includes("SheetsConfigError")) {
        checks.googleSheets = {
          status: "not_configured",
          message: "Google Sheets credentials missing or malformed.",
        };
      } else {
        checks.googleSheets = {
          status: "error",
          message: `Google Sheets error: ${err.slice(0, 120)}`,
        };
      }
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    checks.googleSheets = {
      status: "error",
      message: `Google Sheets probe failed: ${errorMsg.slice(0, 100)}`,
    };
  }

  // 2. Supabase Check
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

    if (!url || !anonKey) {
      checks.supabase = {
        status: "not_configured",
        message: "Supabase URL or Anon key missing.",
      };
    } else {
      const client = await createSupabaseServerClient().catch(() => null);
      if (!client) {
        checks.supabase = {
          status: "not_configured",
          message: "Supabase client initialization failed.",
        };
      } else {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
          const { error } = await client
            .from("enquiries")
            .select("id", { count: "exact", head: true })
            .abortSignal(controller.signal);

          if (!error) {
            checks.supabase = {
              status: "connected",
              message: "Supabase PostgreSQL & PostgREST connected.",
            };
          } else if (
            error.code === "PGRST204" ||
            error.message?.includes("Could not find the table") ||
            error.message?.includes("schema cache")
          ) {
            checks.supabase = {
              status: "degraded",
              message: "Supabase project reachable, but database migrations pending application.",
            };
          } else {
            checks.supabase = {
              status: "error",
              message: `Supabase query error: ${error.message.slice(0, 100)}`,
            };
          }
        } finally {
          clearTimeout(timer);
        }
      }
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    checks.supabase = {
      status: "error",
      message: `Supabase probe failed: ${errorMsg.slice(0, 100)}`,
    };
  }

  // 3. Notifications Check
  try {
    const web3forms = loadWeb3FormsConfig();
    if (web3forms) {
      checks.notifications = {
        status: "configured",
        message: "Web3Forms access key configured and validated.",
      };
    } else {
      checks.notifications = {
        status: "not_configured",
        message: "Web3Forms access key not configured.",
      };
    }
  } catch {
    checks.notifications = {
      status: "error",
      message: "Failed to evaluate notifications configuration.",
    };
  }

  // Determine overall status
  const statuses = [
    checks.app.status,
    checks.googleSheets.status,
    checks.supabase.status,
    checks.notifications.status,
  ];

  let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";

  if (statuses.includes("error")) {
    overallStatus = "degraded";
  } else if (statuses.includes("degraded") || statuses.includes("not_configured")) {
    overallStatus = "degraded";
  }

  const durationMs = Date.now() - startedAt;

  logger.info("health_check_completed", {
    status: overallStatus,
    durationMs,
    statuses: {
      app: checks.app.status,
      googleSheets: checks.googleSheets.status,
      supabase: checks.supabase.status,
      notifications: checks.notifications.status,
    },
  });

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    durationMs,
    checks,
  };
}
