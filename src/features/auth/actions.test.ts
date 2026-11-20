// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loginAdminAction, logoutAdminAction, logoutAdminSession } from "./actions";

// Mock redirect from next/navigation
const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

function createMockSupabase(params: {
  signInError?: Error | null;
  signInUser?: { id: string; email: string } | null;
  profile?: { id: string; email: string; full_name: string; is_active: boolean } | null;
}) {
  const signOut = vi.fn().mockResolvedValue({ error: null });
  const user =
    params.signInUser ??
    (params.signInError ? null : { id: "admin-1", email: "admin@example.com" });

  const client = {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { user },
        error: params.signInError ?? null,
      }),
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
      signOut,
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data:
              params.profile !== undefined
                ? params.profile
                : {
                    id: "admin-1",
                    email: "admin@example.com",
                    full_name: "Admin",
                    is_active: true,
                  },
            error: null,
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;

  return { client, signOut };
}

describe("loginAdminAction", () => {
  it("authenticates an active administrator and redirects to dashboard", async () => {
    const { client } = createMockSupabase({});
    const res = await loginAdminAction(
      { email: "admin@example.com", password: "secure-password-123" },
      client,
    );

    expect(res).toEqual({
      ok: true,
      redirectTo: "/admin/dashboard",
    });
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "admin@example.com",
      password: "secure-password-123",
    });
  });

  it("handles FormData inputs seamlessly", async () => {
    const { client } = createMockSupabase({});
    const formData = new FormData();
    formData.append("email", "admin@example.com");
    formData.append("password", "secure-password-123");
    formData.append("returnTo", "/admin/products");

    const res = await loginAdminAction(formData, client);
    expect(res).toEqual({
      ok: true,
      redirectTo: "/admin/products",
    });
  });

  it("sanitizes returnTo destination to prevent open redirects", async () => {
    const { client } = createMockSupabase({});
    const res = await loginAdminAction(
      {
        email: "admin@example.com",
        password: "secure-password-123",
        returnTo: "https://evil.com/phish",
      },
      client,
    );

    expect(res).toEqual({
      ok: true,
      redirectTo: "/admin/dashboard",
    });
  });

  it("returns generic error on invalid credentials without leaking details", async () => {
    const { client } = createMockSupabase({
      signInError: new Error("Invalid login credentials"),
      signInUser: null,
    });

    const res = await loginAdminAction(
      { email: "unknown@example.com", password: "wrong-password" },
      client,
    );

    expect(res).toEqual({
      ok: false,
      error: "Invalid email or password.",
    });
  });

  it("denies access and signs out if user exists in Auth but has no admin_profile", async () => {
    const { client, signOut } = createMockSupabase({
      signInUser: { id: "non-admin-user", email: "customer@example.com" },
      profile: null,
    });

    const res = await loginAdminAction(
      { email: "customer@example.com", password: "customer-password" },
      client,
    );

    expect(res).toEqual({
      ok: false,
      error: "Invalid email or password.",
    });
    expect(signOut).toHaveBeenCalled();
  });

  it("denies access and signs out if admin account is inactive", async () => {
    const { client, signOut } = createMockSupabase({
      signInUser: { id: "disabled-admin", email: "disabled@example.com" },
      profile: {
        id: "disabled-admin",
        email: "disabled@example.com",
        full_name: "Disabled Admin",
        is_active: false,
      },
    });

    const res = await loginAdminAction(
      { email: "disabled@example.com", password: "valid-password" },
      client,
    );

    expect(res).toEqual({
      ok: false,
      error: "Invalid email or password.",
    });
    expect(signOut).toHaveBeenCalled();
  });

  it("rejects invalid or missing email and password with validation errors", async () => {
    const res = await loginAdminAction({ email: "", password: "" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe("Please correct the errors in the form.");
      expect(res.fieldErrors?.email).toBeDefined();
      expect(res.fieldErrors?.password).toBeDefined();
    }
  });

  it("rejects invalid email format", async () => {
    const res = await loginAdminAction({ email: "not-an-email", password: "valid-pass" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.fieldErrors?.email).toContain("Enter a valid email address.");
    }
  });

  it("fails safely with user-friendly error when client throws an unexpected error", async () => {
    const client = {
      auth: {
        signInWithPassword: vi.fn().mockRejectedValue(new Error("Supabase network outage")),
      },
    } as unknown as SupabaseClient;

    const res = await loginAdminAction(
      { email: "admin@example.com", password: "secure-password-123" },
      client,
    );

    expect(res).toEqual({
      ok: false,
      error: "Unable to sign in at this time. Please try again later.",
    });
  });
});

describe("logoutAdminAction & logoutAdminSession", () => {
  it("signs out from Supabase client and redirects to /admin/login", async () => {
    const { client, signOut } = createMockSupabase({});

    try {
      await logoutAdminSession(client);
    } catch {
      // Expected NEXT_REDIRECT error
    }

    expect(signOut).toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledWith("/admin/login");
  });

  it("handles logoutAdminAction form submissions", async () => {
    try {
      await logoutAdminAction();
    } catch {
      // Expected NEXT_REDIRECT error
    }
    expect(mockRedirect).toHaveBeenCalledWith("/admin/login");
  });
});
