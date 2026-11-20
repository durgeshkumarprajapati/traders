"use server";

import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthenticatedAdmin, sanitizeReturnUrl } from "@/lib/auth/admin";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loginSchema } from "./schemas";

export type LoginActionResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Server Action for administrator sign-in.
 * Validates input, authenticates via Supabase Auth, authoritatively checks
 * the admin_profiles table, and returns a sanitized redirect target.
 */
export async function loginAdminAction(
  formData: FormData | unknown,
  clientOverride?: SupabaseClient,
): Promise<LoginActionResult> {
  const raw = formData instanceof FormData ? Object.fromEntries(formData.entries()) : formData;

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      ok: false,
      error: "Please correct the errors in the form.",
      fieldErrors,
    };
  }

  const { email, password, returnTo } = parsed.data;

  try {
    const supabase = clientOverride ?? (await createSupabaseServerClient());

    // 1. Authenticate credentials via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      logger.warn("admin_login_auth_failed", {
        reason: "invalid_credentials",
      });
      return {
        ok: false,
        error: "Invalid email or password.",
      };
    }

    // 2. Verify active administrator identity in admin_profiles
    const admin = await getAuthenticatedAdmin(supabase);
    if (!admin) {
      // User is authenticated in Supabase Auth, but NOT provisioned or NOT active in admin_profiles.
      // Immediately invalidate the session to prevent unauthorized access.
      await supabase.auth.signOut();
      logger.warn("unauthorized_admin_login_denied", {
        userId: authData.user.id,
      });
      return {
        ok: false,
        error: "Invalid email or password.",
      };
    }

    logger.info("admin_login_success", {
      adminId: admin.id,
    });

    const safeDestination = sanitizeReturnUrl(returnTo) ?? "/admin/dashboard";
    return {
      ok: true,
      redirectTo: safeDestination,
    };
  } catch (err) {
    logger.error("admin_login_system_error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      error: "Unable to sign in at this time. Please try again later.",
    };
  }
}

/**
 * Server Action for administrator sign-out (callable from HTML form action or client).
 * Invalidates the Supabase Auth session, removes session cookies, and redirects to /admin/login.
 */
export async function logoutAdminAction(_formData?: FormData): Promise<void> {
  void _formData;
  await logoutAdminSession();
}

/**
 * Underlying implementation of logout, allowing client override in tests.
 */
export async function logoutAdminSession(clientOverride?: SupabaseClient): Promise<void> {
  try {
    const supabase = clientOverride ?? (await createSupabaseServerClient());
    await supabase.auth.signOut();
    logger.info("admin_logout_success");
  } catch (err) {
    logger.warn("admin_logout_error", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  redirect("/admin/login");
}
