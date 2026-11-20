import "server-only";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminContext = {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
};

export type AdminActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: "UNAUTHORIZED" | "FORBIDDEN" | "VALIDATION" | "INTERNAL";
      message: string;
    };

/**
 * Validates and sanitizes a return URL to prevent open redirects.
 * Only internal admin paths (e.g. /admin/products) are allowed.
 * Login itself, external URLs, protocol-relative URLs, and invalid chars are rejected.
 */
export function sanitizeReturnUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const trimmed = rawUrl.trim();

  // Must begin with /admin/ and not // or /\
  if (!trimmed.startsWith("/admin/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return null;
  }

  // Reject URLs containing protocol or control chars
  if (trimmed.includes("://") || /[\r\n\t\0]/.test(trimmed)) {
    return null;
  }

  // Do not redirect back to login
  if (trimmed === "/admin/login" || trimmed.startsWith("/admin/login?")) {
    return null;
  }

  try {
    const parsed = new URL(trimmed, "http://localhost");
    // Ensure path remains strictly an internal /admin/* route
    if (!parsed.pathname.startsWith("/admin/")) return null;
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

/**
 * Authoritatively retrieves the current authenticated administrator.
 *
 * 1. Securely verifies the session with Supabase Auth (getUser()).
 * 2. Checks admin_profiles in the database for the matching user ID and is_active = true.
 * 3. Fails closed (returns null) on missing session, inactive account, database failure, or missing config.
 */
export async function getAuthenticatedAdmin(client?: SupabaseClient): Promise<AdminContext | null> {
  try {
    const supabase = client ?? (await createSupabaseServerClient());
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !user.id) {
      return null;
    }

    const { data: profile, error: dbError } = await supabase
      .from("admin_profiles")
      .select("id, email, full_name, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (dbError) {
      logger.warn("admin_profile_lookup_error", { error: dbError.message });
      return null;
    }

    if (!profile || profile.is_active !== true) {
      return null;
    }

    return {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      isActive: profile.is_active,
    };
  } catch (err) {
    logger.warn("get_authenticated_admin_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Requires an authenticated, active administrator.
 * Throws AppError("UNAUTHORIZED") if unauthenticated or not an active administrator.
 * For use in Route Handlers, services, and internal server functions.
 */
export async function requireAdmin(client?: SupabaseClient): Promise<AdminContext> {
  const admin = await getAuthenticatedAdmin(client);
  if (!admin) {
    throw new AppError("UNAUTHORIZED", "Administrator authentication required.");
  }
  return admin;
}

/**
 * Requires an authenticated administrator session in Server Components (pages, layouts).
 * Redirects to /admin/login if the user is not authenticated or not an active administrator.
 */
export async function requireAdminSession(client?: SupabaseClient): Promise<AdminContext> {
  const admin = await getAuthenticatedAdmin(client);
  if (!admin) {
    redirect("/admin/login");
  }
  return admin;
}

/**
 * Server Action wrapper that verifies admin authorization before executing the protected function.
 */
export async function withAdminAction<T>(
  actionName: string,
  fn: (admin: AdminContext, client: SupabaseClient) => Promise<T>,
  clientOverride?: SupabaseClient,
): Promise<AdminActionResult<T>> {
  try {
    let client = clientOverride;
    if (!client) {
      try {
        client = await createSupabaseServerClient();
      } catch {
        return {
          ok: false,
          code: "UNAUTHORIZED",
          message: "Administrator authentication required.",
        };
      }
    }
    const admin = await getAuthenticatedAdmin(client);
    if (!admin) {
      return {
        ok: false,
        code: "UNAUTHORIZED",
        message: "Administrator authentication required.",
      };
    }
    const data = await fn(admin, client);
    return { ok: true, data };
  } catch (err) {
    if (err instanceof AppError) {
      return {
        ok: false,
        code: err.code as "UNAUTHORIZED" | "FORBIDDEN" | "VALIDATION" | "INTERNAL",
        message: err.publicMessage,
      };
    }
    logger.error("admin_action_error", {
      error: err instanceof Error ? err.message : String(err),
      action: actionName,
    });
    return {
      ok: false,
      code: "INTERNAL",
      message: "An unexpected error occurred.",
    };
  }
}
