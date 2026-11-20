// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthenticatedAdmin, requireAdmin, withAdminAction } from "@/lib/auth/admin";
import { isSensitiveKey, redact, redactString } from "@/lib/logger";

describe("Phase 7: Security Boundary & Invariant Tests", () => {
  const root = process.cwd();

  it("ensures no public signup route, registration endpoint or action exists", () => {
    // Check app directory for any signup or register routes
    const apiRoutes = existsSync(join(root, "src/app/api"))
      ? readdirSync(join(root, "src/app/api"), { recursive: true }).map(String)
      : [];
    const appRoutes = readdirSync(join(root, "src/app"), { recursive: true }).map(String);

    for (const r of [...apiRoutes, ...appRoutes]) {
      expect(r.toLowerCase()).not.toContain("signup");
      expect(r.toLowerCase()).not.toContain("register");
    }
  });

  it("ensures no admin creation API route exists", () => {
    const adminApiDir = join(root, "src/app/api/admin");
    if (existsSync(adminApiDir)) {
      const adminApiFiles = readdirSync(adminApiDir, { recursive: true }).map(String);
      for (const f of adminApiFiles) {
        expect(f.toLowerCase()).not.toContain("create");
        expect(f.toLowerCase()).not.toContain("provision");
      }
    }
  });

  it("ensures client modules NEVER import server-only or service role key", () => {
    const clientFile = readFileSync(join(root, "src/lib/supabase/client.ts"), "utf8");
    expect(clientFile).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(clientFile).not.toContain("serviceRoleKey");

    const publicEnvFile = readFileSync(join(root, "src/lib/env/public.ts"), "utf8");
    expect(publicEnvFile).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(publicEnvFile).not.toContain("serviceRoleKey");
  });

  it("ensures server-only is enforced on sensitive auth modules", () => {
    const serverModule = readFileSync(join(root, "src/lib/supabase/server.ts"), "utf8");
    expect(serverModule).toContain('import "server-only"');

    const adminClientModule = readFileSync(join(root, "src/lib/supabase/admin.ts"), "utf8");
    expect(adminClientModule).toContain('import "server-only"');

    const adminAuthModule = readFileSync(join(root, "src/lib/auth/admin.ts"), "utf8");
    expect(adminAuthModule).toContain('import "server-only"');
  });

  it("redacts passwords, tokens, cookies and auth headers from logs", () => {
    expect(isSensitiveKey("password")).toBe(true);
    expect(isSensitiveKey("current_password")).toBe(true);
    expect(isSensitiveKey("access_token")).toBe(true);
    expect(isSensitiveKey("refreshToken")).toBe(true);
    expect(isSensitiveKey("cookie")).toBe(true);
    expect(isSensitiveKey("authorization")).toBe(true);
    expect(isSensitiveKey("apiKey")).toBe(true);

    const sensitivePayload = {
      email: "admin@sagartraders.in",
      password: "SuperSecretPassword123!",
      session_id: "session_token_12345",
      user_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy.sig",
      refresh_token: "refresh_token_secret_value",
      authorization: "Bearer secret-token-value",
      cookie: "sb-auth-token=secret-cookie-val",
    };

    const redacted = redact(sensitivePayload) as Record<string, unknown>;
    expect(redacted.email).toBe("admin@sagartraders.in");
    expect(redacted.password).toBe("[redacted]");
    expect(redacted.session_id).toBe("[redacted]");
    expect(redacted.user_token).toBe("[redacted]");
    expect(redacted.refresh_token).toBe("[redacted]");
    expect(redacted.authorization).toBe("[redacted]");
    expect(redacted.cookie).toBe("[redacted]");

    const strWithSecret = redactString("Error while sending password=supersecretpass in request");
    expect(strWithSecret).not.toContain("supersecretpass");
    expect(strWithSecret).toContain("password=[redacted]");
  });

  describe("Server Action & Route Handler Direct Protection", () => {
    it("fails closed when direct call is made without authentication", async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        },
      } as unknown as SupabaseClient;

      await expect(requireAdmin(mockSupabase)).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });

      const action = vi.fn();
      const res = await withAdminAction("directAction", action);
      expect(res).toEqual({
        ok: false,
        code: "UNAUTHORIZED",
        message: "Administrator authentication required.",
      });
      expect(action).not.toHaveBeenCalled();
    });

    it("fails closed when user is authenticated in Supabase but is NOT in admin_profiles", async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "attacker-user-id", email: "attacker@example.com" } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      } as unknown as SupabaseClient;

      const admin = await getAuthenticatedAdmin(mockSupabase);
      expect(admin).toBeNull();
      await expect(requireAdmin(mockSupabase)).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });

    it("fails closed when user is in admin_profiles but is_active = false", async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "disabled-admin-id", email: "disabled@example.com" } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "disabled-admin-id",
                  email: "disabled@example.com",
                  full_name: "Disabled Admin",
                  is_active: false,
                },
                error: null,
              }),
            }),
          }),
        }),
      } as unknown as SupabaseClient;

      const admin = await getAuthenticatedAdmin(mockSupabase);
      expect(admin).toBeNull();
      await expect(requireAdmin(mockSupabase)).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });
  });
});
