// @vitest-environment node
import { SupabaseApiError, SupabaseConfigError, SupabaseTimeoutError } from "./errors";
import { loadSupabaseAuthConfig, loadSupabaseConfig } from "./config";
import { createSupabaseRpc, RPC_TIMEOUT_MS, type RestDeps } from "./rest";

const KEY = "sb-test-service-role-key-0123456789";
const config = { url: "https://proj.supabase.test", serviceRoleKey: KEY };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function deps(
  script: (Response | Error | ((u: string, i: RequestInit) => Response | Promise<Response>))[],
) {
  const requests: { url: string; init: RequestInit }[] = [];
  const sleeps: number[] = [];
  const d: RestDeps = {
    fetch: async (url, init = {}) => {
      requests.push({ url, init });
      const next = script.shift();
      if (next === undefined) throw new Error("unexpected request");
      const r = typeof next === "function" ? await next(url, init) : next;
      if (r instanceof Error) throw r;
      return r;
    },
    sleep: async (ms) => void sleeps.push(ms),
    random: () => 0,
  };
  return { d, requests, sleeps };
}

describe("loadSupabaseConfig", () => {
  it("accepts a valid configuration and normalises the URL", () => {
    expect(
      loadSupabaseConfig({
        NEXT_PUBLIC_SUPABASE_URL: "https://proj.supabase.test/",
        SUPABASE_SERVICE_ROLE_KEY: KEY,
      }),
    ).toEqual({ url: "https://proj.supabase.test", serviceRoleKey: KEY });
    expect(
      loadSupabaseConfig({
        NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
        SUPABASE_SERVICE_ROLE_KEY: KEY,
      }).url,
    ).toBe("http://localhost:54321");
  });
  it("reports names only, never values, and rejects insecure URLs", () => {
    try {
      loadSupabaseConfig({});
      expect.unreachable();
    } catch (e) {
      expect((e as SupabaseConfigError).missing).toEqual([
        "NEXT_PUBLIC_SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
      ]);
    }
    for (const bad of [
      { NEXT_PUBLIC_SUPABASE_URL: "http://proj.supabase.test", SUPABASE_SERVICE_ROLE_KEY: KEY },
      {
        NEXT_PUBLIC_SUPABASE_URL: "https://proj.supabase.test",
        SUPABASE_SERVICE_ROLE_KEY: "short key with spaces",
      },
    ]) {
      try {
        loadSupabaseConfig(bad);
        expect.unreachable();
      } catch (e) {
        const text = `${(e as Error).message} ${(e as SupabaseConfigError).detail} ${JSON.stringify(e)}`;
        expect(text).not.toContain("short key with spaces");
        expect(text).not.toContain("http://proj.supabase.test");
        expect((e as SupabaseConfigError).invalid.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("loadSupabaseAuthConfig", () => {
  const ANON = "sb-test-anon-public-key-0123456789";

  it("accepts a valid auth configuration and normalises the URL", () => {
    expect(
      loadSupabaseAuthConfig({
        NEXT_PUBLIC_SUPABASE_URL: "https://proj.supabase.test/",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON,
      }),
    ).toEqual({ url: "https://proj.supabase.test", anonKey: ANON, serviceRoleKey: undefined });
  });

  it("reports names only, never values, when keys are missing or invalid", () => {
    try {
      loadSupabaseAuthConfig({});
      expect.unreachable();
    } catch (e) {
      expect((e as SupabaseConfigError).missing).toEqual([
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      ]);
    }

    try {
      loadSupabaseAuthConfig({
        NEXT_PUBLIC_SUPABASE_URL: "https://proj.supabase.test",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "short key",
      });
      expect.unreachable();
    } catch (e) {
      const text = `${(e as Error).message} ${(e as SupabaseConfigError).detail}`;
      expect(text).not.toContain("short key");
      expect((e as SupabaseConfigError).invalid).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }
  });
});

describe("createSupabaseRpc", () => {
  it("POSTs to the RPC endpoint with the service-role key only in headers and returns parsed JSON", async () => {
    const { d, requests } = deps([json({ ok: 1 })]);
    const out = await createSupabaseRpc(config, d)<{ ok: number }>("create_enquiry", {
      p_payload: { a: 1 },
    });
    expect(out).toEqual({ ok: 1 });
    const [r] = requests;
    expect(r.url).toBe("https://proj.supabase.test/rest/v1/rpc/create_enquiry");
    expect(r.init.method).toBe("POST");
    const h = r.init.headers as Record<string, string>;
    expect(h.apikey).toBe(KEY);
    expect(h.authorization).toBe(`Bearer ${KEY}`);
    expect(String(r.init.body)).not.toContain(KEY);
    expect(JSON.parse(String(r.init.body))).toEqual({ p_payload: { a: 1 } });
  });

  it("returns null for functions that return SQL null / no content", async () => {
    const { d } = deps([
      new Response("null", { status: 200 }),
      new Response(null, { status: 204 }),
    ]);
    const rpc = createSupabaseRpc(config, d);
    expect(await rpc("claim_notification", {})).toBeNull();
    expect(await rpc("claim_notification", {})).toBeNull();
  });

  it("rejects unsafe function names without making a request", async () => {
    const { d, requests } = deps([]);
    await expect(createSupabaseRpc(config, d)("../rest/v1/enquiries", {})).rejects.toBeInstanceOf(
      SupabaseApiError,
    );
    expect(requests).toHaveLength(0);
  });

  it("keeps database error text (which can echo submitted data) out of the error", async () => {
    const { d } = deps([
      json(
        {
          code: "23514",
          message: "new row violates check constraint; Failing row contains (Asha Rao, 9876543210)",
          details: "secret-customer-data",
        },
        400,
      ),
    ]);
    const err = (await createSupabaseRpc(config, d)("create_enquiry", { p_payload: {} }).catch(
      (e: unknown) => e,
    )) as SupabaseApiError;
    expect(err).toBeInstanceOf(SupabaseApiError);
    expect(err.status).toBe(400);
    expect(err.pgCode).toBe("23514");
    expect(err.retryable).toBe(false);
    const text = `${err.message} ${err.detail} ${JSON.stringify(err)}`;
    for (const leak of ["Asha Rao", "9876543210", "secret-customer-data", KEY])
      expect(text).not.toContain(leak);
    expect(err.publicMessage).toBe("The service is temporarily unavailable.");
  });

  it("does NOT retry by default (non-idempotent functions), but retries 5xx/network when allowed", async () => {
    const a = deps([json({}, 503), json({ ok: true })]);
    await expect(createSupabaseRpc(config, a.d)("claim_notification", {})).rejects.toMatchObject({
      status: 503,
      retryable: true,
    });
    expect(a.requests).toHaveLength(1);

    const b = deps([json({}, 503), new TypeError("fetch failed"), json({ ok: true })]);
    expect(await createSupabaseRpc(config, b.d)("create_enquiry", {}, { retries: 2 })).toEqual({
      ok: true,
    });
    expect(b.requests).toHaveLength(3);
    expect(b.sleeps).toEqual([200, 400]);
  });

  it("never retries permanent errors, even when retries are allowed", async () => {
    const { d, requests } = deps([json({ code: "23514" }, 400), json({ ok: true })]);
    await expect(
      createSupabaseRpc(config, d)("create_enquiry", {}, { retries: 2 }),
    ).rejects.toMatchObject({ status: 400 });
    expect(requests).toHaveLength(1);
  });

  it("times out hung requests", async () => {
    vi.useFakeTimers();
    try {
      const hang = (_u: string, init: RequestInit) =>
        new Promise<Response>((_res, rej) =>
          init.signal?.addEventListener("abort", () =>
            rej(new DOMException("aborted", "AbortError")),
          ),
        );
      const { d } = deps([hang]);
      const p = createSupabaseRpc(config, d)("create_enquiry", {}).catch((e: unknown) => e);
      await vi.advanceTimersByTimeAsync(RPC_TIMEOUT_MS + 10);
      const err = await p;
      expect(err).toBeInstanceOf(SupabaseTimeoutError);
      expect((err as SupabaseTimeoutError).retryable).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
