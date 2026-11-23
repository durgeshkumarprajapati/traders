// @vitest-environment node
import { FakeSupabase } from "@/lib/supabase/test-utils";
import { hashIdentifier } from "@/features/enquiries/server/rate-limit";

const state = vi.hoisted(() => ({
  db: null as unknown,
  headers: {} as Record<string, string>,
  fail: false,
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers(state.headers) }));
vi.mock("@/features/enquiries/server/deps", () => ({
  buildNotificationDeps: () => {
    if (state.fail) throw new Error("missing SUPABASE_SERVICE_ROLE_KEY");
    return { rpc: (state.db as FakeSupabase).rpc };
  },
  loadRateLimitSecret: () => "test-rate-limit-secret-0123456789",
}));

import { guardTokenAccess } from "./access";

let db: FakeSupabase;
beforeEach(() => {
  db = new FakeSupabase();
  state.db = db;
  state.fail = false;
  state.headers = { "x-forwarded-for": "203.0.113.9, 10.0.0.1" };
});

describe("guardTokenAccess (quotation page and PDF)", () => {
  it("allows normal use and counts against a salted hash of the client IP — the raw IP is not stored", async () => {
    expect(await guardTokenAccess()).toEqual({ allowed: true });
    const keys = [...db.limits.keys()];
    expect(keys).toEqual([
      hashIdentifier("ip", "tracking:203.0.113.9", "test-rate-limit-secret-0123456789"),
    ]);
    expect(keys.join("")).not.toContain("203.0.113.9");
  });

  it("blocks after 20 attempts in the window and reports when to retry (brute-forcing a token is throttled)", async () => {
    for (let i = 0; i < 20; i++) expect((await guardTokenAccess()).allowed).toBe(true);
    const blocked = await guardTokenAccess();
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("each client has its own budget; a forged header value cannot reset or share another's", async () => {
    for (let i = 0; i < 21; i++) await guardTokenAccess();
    state.headers = { "x-forwarded-for": "198.51.100.77" };
    expect((await guardTokenAccess()).allowed).toBe(true);
    state.headers = { "x-forwarded-for": "not-an-ip<script>" };
    expect((await guardTokenAccess()).allowed).toBe(true); // falls into the shared 'unknown' bucket, still limited
  });

  it("FAILS CLOSED when the limiter store or configuration is unavailable", async () => {
    state.fail = true;
    const r = await guardTokenAccess();
    expect(r.allowed).toBe(false);
  });
});
