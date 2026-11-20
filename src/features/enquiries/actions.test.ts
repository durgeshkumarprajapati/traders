// @vitest-environment node
import { loadFrom, realisticSheets } from "@/features/catalogue/test-catalogue";
import { FakeSupabase } from "@/lib/supabase/test-utils";
import { hashIdentifier } from "./server/rate-limit";
import { KEY, bulkInput, contactInput } from "./server/test-helpers";

const state = vi.hoisted(() => ({
  headers: {} as Record<string, string>,
  after: [] as (() => Promise<unknown>)[],
  db: null as unknown,
  load: null as unknown,
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers(state.headers) }));
vi.mock("next/server", () => ({
  after: (fn: () => Promise<unknown>) => void state.after.push(fn),
}));
vi.mock("@/features/catalogue/server", () => ({ loadCatalogue: async () => state.load }));
vi.mock("@/lib/supabase/rest", async (orig) => ({
  ...(await orig<typeof import("@/lib/supabase/rest")>()),
  createSupabaseRpc: () => (state.db as FakeSupabase).rpc,
}));

import * as actions from "./actions";

const ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://proj.supabase.test",
  SUPABASE_SERVICE_ROLE_KEY: "sb-test-service-role-key-0123456789",
  WEB3FORMS_ACCESS_KEY: "11111111-2222-3333-4444-555555555555",
  RATE_LIMIT_SECRET: "test-rate-limit-secret-0123456789",
};

let db: FakeSupabase;
let fetchCalls: { url: string; body: Record<string, unknown> }[];

beforeEach(async () => {
  db = new FakeSupabase();
  state.db = db;
  state.load = await loadFrom(realisticSheets());
  state.after = [];
  state.headers = { "x-forwarded-for": "203.0.113.7, 10.0.0.1" };
  fetchCalls = [];
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    fetchCalls.push({ url, body: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("public Server Actions", () => {
  it("exports only the two async submission actions (a 'use server' file is a public HTTP surface)", () => {
    expect(Object.keys(actions).sort()).toEqual([
      "submitBulkEnquiryAction",
      "submitContactEnquiryAction",
    ]);
    for (const fn of Object.values(actions)) expect(fn.constructor.name).toBe("AsyncFunction");
  });

  it("bulk: saves, replies with the reference, and sends the email AFTER the response via Web3Forms (server-side)", async () => {
    const r = await actions.submitBulkEnquiryAction(bulkInput());
    expect(r).toMatchObject({ ok: true, reference: expect.stringMatching(/^ENQ-/) });
    expect(db.enquiries).toHaveLength(1);
    expect(fetchCalls).toHaveLength(0); // nothing sent while responding
    expect(state.after).toHaveLength(1);
    await state.after[0]();
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].url).toBe("https://api.web3forms.com/submit");
    expect(fetchCalls[0].body.access_key).toBe(ENV.WEB3FORMS_ACCESS_KEY);
    expect(String(fetchCalls[0].body.message)).toContain((r as { reference: string }).reference);
    expect(JSON.stringify(r)).not.toContain(ENV.WEB3FORMS_ACCESS_KEY); // never returned to the browser
    expect(JSON.stringify(r)).not.toContain(ENV.SUPABASE_SERVICE_ROLE_KEY);
    expect(db.outbox[0].status).toBe("SENT");
  });

  it("contact: saves a GENERAL enquiry with no catalogue involved", async () => {
    state.load = { ok: false };
    const r = await actions.submitContactEnquiryAction(contactInput());
    expect(r).toMatchObject({ ok: true });
    expect(db.enquiries[0].type).toBe("GENERAL");
  });

  it("rate-limits by the FIRST x-forwarded-for address (hashed), and ignores malformed header values", async () => {
    await actions.submitContactEnquiryAction(contactInput());
    expect([...db.limits.keys()]).toContain(
      hashIdentifier("ip", "203.0.113.7", ENV.RATE_LIMIT_SECRET),
    );
    db.limits.clear();
    state.headers = { "x-forwarded-for": "not-an-ip<script>" };
    await actions.submitContactEnquiryAction(contactInput({ idempotencyKey: KEY(50) }));
    expect([...db.limits.keys()]).toContain(hashIdentifier("ip", "unknown", ENV.RATE_LIMIT_SECRET));
    db.limits.clear();
    state.headers = { "x-real-ip": "198.51.100.9" };
    await actions.submitContactEnquiryAction(contactInput({ idempotencyKey: KEY(51) }));
    expect([...db.limits.keys()]).toContain(
      hashIdentifier("ip", "198.51.100.9", ENV.RATE_LIMIT_SECRET),
    );
  });

  it("validates on the server regardless of the browser, and discards honeypot submissions without touching the database", async () => {
    expect(await actions.submitBulkEnquiryAction({ nonsense: true })).toMatchObject({
      ok: false,
      code: "VALIDATION",
    });
    expect(await actions.submitContactEnquiryAction(null)).toMatchObject({
      ok: false,
      code: "VALIDATION",
    });
    expect(db.calls).toHaveLength(0);
    expect(await actions.submitContactEnquiryAction(contactInput({ website: "bot" }))).toEqual({
      ok: true,
      reference: null,
    });
    expect(db.calls).toHaveLength(0);
  });

  it.each([
    ["Supabase URL", "NEXT_PUBLIC_SUPABASE_URL"],
    ["service-role key", "SUPABASE_SERVICE_ROLE_KEY"],
    ["rate-limit secret", "RATE_LIMIT_SECRET"],
  ])(
    "fails closed with a generic message when the %s is missing — and names (never values) go to the log",
    async (_n, name) => {
      vi.stubEnv(name, "");
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const r = await actions.submitContactEnquiryAction(contactInput());
      const logged = spy.mock.calls.map((c) => String(c[0])).join("\n");
      spy.mockRestore();
      expect(r).toMatchObject({ ok: false, code: "UNAVAILABLE" });
      expect(JSON.stringify(r)).not.toMatch(/SUPABASE|RATE_LIMIT|supabase\.test|sb-test/i);
      expect(db.enquiries).toHaveLength(0);
      expect(logged).toContain("enquiry_config_failed");
      for (const value of [
        ENV.SUPABASE_SERVICE_ROLE_KEY,
        ENV.RATE_LIMIT_SECRET,
        ENV.WEB3FORMS_ACCESS_KEY,
      ])
        expect(logged).not.toContain(value);
    },
  );

  it("still saves the enquiry when the email provider is not configured (it stays PENDING for later)", async () => {
    vi.stubEnv("WEB3FORMS_ACCESS_KEY", "");
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await actions.submitContactEnquiryAction(contactInput());
    await state.after[0]();
    spy.mockRestore();
    expect(r).toMatchObject({ ok: true });
    expect(db.outbox[0]).toMatchObject({ status: "PENDING", attempt_count: 0 });
    expect(fetchCalls).toHaveLength(0);
  });
});
