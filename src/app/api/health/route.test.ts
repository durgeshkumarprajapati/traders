// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const catalogueMock = vi.hoisted(() => ({
  loadAdminCatalogue: vi.fn(),
}));

const supabaseMock = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
}));

const emailMock = vi.hoisted(() => ({
  loadWeb3FormsConfig: vi.fn(),
}));

vi.mock("@/features/catalogue/server", () => ({
  loadAdminCatalogue: catalogueMock.loadAdminCatalogue,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: supabaseMock.createSupabaseServerClient,
}));

vi.mock("@/lib/email/web3forms", () => ({
  loadWeb3FormsConfig: emailMock.loadWeb3FormsConfig,
}));

import { GET } from "./route";

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://xyz.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key-123");
  });

  it("returns healthy when all integrations are connected and configured", async () => {
    catalogueMock.loadAdminCatalogue.mockResolvedValue({
      ok: true,
      snapshot: {
        products: [{ id: "p1" }],
        categories: [{ id: "c1" }],
        brands: [{ id: "b1" }],
        issues: [],
      },
    });

    supabaseMock.createSupabaseServerClient.mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          abortSignal: vi.fn().mockResolvedValue({ error: null }),
        })),
      })),
    });

    emailMock.loadWeb3FormsConfig.mockReturnValue({ accessKey: "uuid-key-12345" });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("healthy");
    expect(body.checks.app.status).toBe("connected");
    expect(body.checks.googleSheets.status).toBe("connected");
    expect(body.checks.supabase.status).toBe("connected");
    expect(body.checks.notifications.status).toBe("configured");

    // Ensure secrets are never leaked
    const jsonStr = JSON.stringify(body);
    expect(jsonStr).not.toContain("uuid-key-12345");
    expect(jsonStr).not.toContain("anon-key-123");
  });

  it("reports degraded when Google Sheets is missing required worksheets", async () => {
    catalogueMock.loadAdminCatalogue.mockResolvedValue({
      ok: false,
      error:
        'SheetsStructureError: Worksheet "Products": the worksheet does not exist or is misnamed',
    });

    supabaseMock.createSupabaseServerClient.mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          abortSignal: vi.fn().mockResolvedValue({ error: null }),
        })),
      })),
    });

    emailMock.loadWeb3FormsConfig.mockReturnValue(null);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.checks.googleSheets.status).toBe("degraded");
    expect(body.checks.googleSheets.message).toContain("required worksheets pending import");
  });

  it("reports degraded when Supabase migrations are pending", async () => {
    catalogueMock.loadAdminCatalogue.mockResolvedValue({
      ok: false,
      error: "SheetsConfigError: missing required variables",
    });

    supabaseMock.createSupabaseServerClient.mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          abortSignal: vi.fn().mockResolvedValue({
            error: {
              code: "PGRST204",
              message: "Could not find the table 'public.enquiries' in the schema cache",
            },
          }),
        })),
      })),
    });

    emailMock.loadWeb3FormsConfig.mockReturnValue(null);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.checks.supabase.status).toBe("degraded");
    expect(body.checks.supabase.message).toContain("migrations pending");
  });
});
