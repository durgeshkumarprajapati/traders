// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/errors";
import { getAuthenticatedAdmin, requireAdmin, sanitizeReturnUrl, withAdminAction } from "./admin";

describe("sanitizeReturnUrl", () => {
  it("allows safe internal admin URLs", () => {
    expect(sanitizeReturnUrl("/admin/dashboard")).toBe("/admin/dashboard");
    expect(sanitizeReturnUrl("/admin/products")).toBe("/admin/products");
    expect(sanitizeReturnUrl("/admin/products/new")).toBe("/admin/products/new");
    expect(sanitizeReturnUrl("/admin/products?status=in_stock")).toBe(
      "/admin/products?status=in_stock",
    );
    expect(sanitizeReturnUrl("/admin/enquiries/123")).toBe("/admin/enquiries/123");
  });

  it("rejects non-admin internal URLs", () => {
    expect(sanitizeReturnUrl("/")).toBeNull();
    expect(sanitizeReturnUrl("/products")).toBeNull();
    expect(sanitizeReturnUrl("/contact")).toBeNull();
    expect(sanitizeReturnUrl("/bulk-enquiry")).toBeNull();
  });

  it("rejects login URLs to prevent loops", () => {
    expect(sanitizeReturnUrl("/admin/login")).toBeNull();
    expect(sanitizeReturnUrl("/admin/login?returnTo=/admin/dashboard")).toBeNull();
  });

  it("rejects external and open-redirect vectors", () => {
    expect(sanitizeReturnUrl("https://evil.com/admin/dashboard")).toBeNull();
    expect(sanitizeReturnUrl("http://evil.com/admin/dashboard")).toBeNull();
    expect(sanitizeReturnUrl("//evil.com/admin/dashboard")).toBeNull();
    expect(sanitizeReturnUrl("/\\evil.com/admin/dashboard")).toBeNull();
    expect(sanitizeReturnUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeReturnUrl("data:text/html,<h1>evil</h1>")).toBeNull();
    expect(sanitizeReturnUrl("///evil.com")).toBeNull();
    expect(sanitizeReturnUrl("/admin/\r\nevil.com")).toBeNull();
  });

  it("rejects invalid or empty inputs", () => {
    expect(sanitizeReturnUrl(null)).toBeNull();
    expect(sanitizeReturnUrl(undefined)).toBeNull();
    expect(sanitizeReturnUrl("")).toBeNull();
    expect(sanitizeReturnUrl("   ")).toBeNull();
  });
});

function createMockSupabase(params: {
  user?: { id: string; email?: string } | null;
  authError?: Error | null;
  profile?: { id: string; email: string; full_name: string; is_active: boolean } | null;
  dbError?: Error | null;
}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: params.user ?? null },
        error: params.authError ?? null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: params.profile ?? null,
            error: params.dbError ?? null,
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

describe("getAuthenticatedAdmin", () => {
  it("returns null when user is not authenticated", async () => {
    const supabase = createMockSupabase({ user: null });
    const admin = await getAuthenticatedAdmin(supabase);
    expect(admin).toBeNull();
  });

  it("returns null when auth getUser returns an error", async () => {
    const supabase = createMockSupabase({
      user: null,
      authError: new Error("Invalid JWT token"),
    });
    const admin = await getAuthenticatedAdmin(supabase);
    expect(admin).toBeNull();
  });

  it("returns null when user exists in Auth but has no admin_profile", async () => {
    const supabase = createMockSupabase({
      user: { id: "user-123", email: "user@example.com" },
      profile: null,
    });
    const admin = await getAuthenticatedAdmin(supabase);
    expect(admin).toBeNull();
  });

  it("returns null when admin_profile has is_active = false", async () => {
    const supabase = createMockSupabase({
      user: { id: "user-123", email: "admin@example.com" },
      profile: {
        id: "user-123",
        email: "admin@example.com",
        full_name: "Deactivated Admin",
        is_active: false,
      },
    });
    const admin = await getAuthenticatedAdmin(supabase);
    expect(admin).toBeNull();
  });

  it("returns null when database lookup errors (fail closed)", async () => {
    const supabase = createMockSupabase({
      user: { id: "user-123", email: "admin@example.com" },
      dbError: new Error("Database timeout"),
    });
    const admin = await getAuthenticatedAdmin(supabase);
    expect(admin).toBeNull();
  });

  it("returns AdminContext when user is active administrator", async () => {
    const supabase = createMockSupabase({
      user: { id: "user-123", email: "admin@example.com" },
      profile: {
        id: "user-123",
        email: "admin@example.com",
        full_name: "Sagar Admin",
        is_active: true,
      },
    });
    const admin = await getAuthenticatedAdmin(supabase);
    expect(admin).toEqual({
      id: "user-123",
      email: "admin@example.com",
      fullName: "Sagar Admin",
      isActive: true,
    });
  });
});

describe("requireAdmin", () => {
  it("throws UNAUTHORIZED AppError when unauthenticated", async () => {
    const supabase = createMockSupabase({ user: null });
    await expect(requireAdmin(supabase)).rejects.toThrowError(AppError);
    await expect(requireAdmin(supabase)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      publicMessage: "Administrator authentication required.",
    });
  });

  it("returns AdminContext when active administrator", async () => {
    const supabase = createMockSupabase({
      user: { id: "user-123", email: "admin@example.com" },
      profile: {
        id: "user-123",
        email: "admin@example.com",
        full_name: "Sagar Admin",
        is_active: true,
      },
    });
    const admin = await requireAdmin(supabase);
    expect(admin.id).toBe("user-123");
  });
});

describe("withAdminAction", () => {
  it("rejects unauthorized calls with structured error without running action", async () => {
    // When getAuthenticatedAdmin returns null (default client unconfigured or mock)
    const action = vi.fn();
    const result = await withAdminAction("testAction", action);
    expect(result).toEqual({
      ok: false,
      code: "UNAUTHORIZED",
      message: "Administrator authentication required.",
    });
    expect(action).not.toHaveBeenCalled();
  });
});
