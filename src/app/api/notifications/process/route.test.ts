// @vitest-environment node
import { SupabaseApiError } from "@/lib/supabase/errors";

const deps = vi.hoisted(() => ({
  rpc: vi.fn(),
  buildNotificationDeps: vi.fn(),
  processDueNotifications: vi.fn(),
}));
vi.mock("@/features/enquiries/server/deps", () => ({
  buildNotificationDeps: deps.buildNotificationDeps,
  processDueNotifications: deps.processDueNotifications,
}));

import { GET, POST } from "./route";

const SECRET = "cron-secret-0123456789abcdef";
const req = (auth?: string, method = "GET") =>
  new Request("https://example.test/api/notifications/process", {
    method,
    headers: auth ? { authorization: auth } : {},
  });

beforeEach(() => {
  deps.rpc.mockReset().mockResolvedValue(3);
  deps.buildNotificationDeps.mockReset().mockReturnValue({ rpc: deps.rpc, web3forms: null });
  deps.processDueNotifications
    .mockReset()
    .mockResolvedValue({ due: 2, sent: 1, failed: 1, skipped: 0, notConfigured: 0, unrecorded: 0 });
  vi.stubEnv("CRON_SECRET", SECRET);
});
afterEach(() => vi.unstubAllEnvs());

describe("notification sweeper route", () => {
  it("refuses everything when CRON_SECRET is not configured (never open)", async () => {
    for (const v of ["", "short"]) {
      vi.stubEnv("CRON_SECRET", v);
      const res = await GET(req(`Bearer ${v}`));
      expect(res.status).toBe(503);
      expect((await res.json()).error.code).toBe("NOT_CONFIGURED");
    }
    expect(deps.processDueNotifications).not.toHaveBeenCalled();
  });

  it.each([
    undefined,
    "",
    "Bearer wrong-secret-0123456789abcdef",
    SECRET,
    "bearer " + SECRET,
    `Bearer ${SECRET}x`,
  ])("rejects a missing or wrong credential: %j", async (auth) => {
    const res = await GET(req(auth));
    expect(res.status).toBe(401);
    expect(JSON.stringify(await res.json())).not.toContain(SECRET);
    expect(deps.processDueNotifications).not.toHaveBeenCalled();
  });

  it("with the correct bearer token it attempts due notifications, purges stale rate limits, and returns counts only", async () => {
    for (const handler of [GET, POST]) {
      const res = await handler(req(`Bearer ${SECRET}`));
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(await res.json()).toEqual({
        ok: true,
        due: 2,
        sent: 1,
        failed: 1,
        skipped: 0,
        notConfigured: 0,
        unrecorded: 0,
        purgedRateLimits: 3,
      });
    }
    expect(deps.processDueNotifications).toHaveBeenCalledWith(10, expect.anything());
    expect(deps.rpc).toHaveBeenCalledWith("purge_rate_limits", { p_older_than_seconds: 86400 });
  });

  it("hides internal errors behind a generic response", async () => {
    deps.processDueNotifications.mockRejectedValue(
      new SupabaseApiError(
        "Supabase RPC list_due_notifications failed (HTTP 500) internal-detail",
        500,
        null,
        true,
      ),
    );
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(req(`Bearer ${SECRET}`));
    spy.mockRestore();
    expect(res.status).toBe(502);
    const body = JSON.stringify(await res.json());
    expect(body).toContain("UPSTREAM");
    expect(body).not.toMatch(/internal-detail|Supabase RPC|HTTP 500/);
  });
});
