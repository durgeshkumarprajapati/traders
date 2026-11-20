// @vitest-environment node
import { NextRequest } from "next/server";
import { config, proxy } from "./proxy";
import * as proxyModule from "@/lib/supabase/proxy";

const req = (path: string, cookies: Record<string, string> = {}) => {
  const r = new NextRequest(`https://shop.example.test${path}`);
  for (const [k, v] of Object.entries(cookies)) {
    r.cookies.set(k, v);
  }
  return r;
};

const isRewriteToMissing = (res: Response) =>
  (res.headers.get("x-middleware-rewrite") ?? "").endsWith("/__product-not-found__");
const isNext = (res: Response) => res.headers.get("x-middleware-next") === "1";
const isRedirectTo = (res: Response, path: string) =>
  res.headers.get("location") === `https://shop.example.test${path}`;

function stubFetch(impl: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  const f = vi.fn(async (url: string, init?: RequestInit) => impl(url, init));
  vi.stubGlobal("fetch", f);
  return f;
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("proxy: matcher", () => {
  it("matches both product slug URLs and admin routes", () => {
    expect(config.matcher).toEqual(["/products/:slug", "/admin/:path*"]);
  });
});

describe("proxy: genuine 404 for missing products", () => {
  it("lets existing products through after asking the internal catalogue route", async () => {
    const f = stubFetch(() => new Response('{"exists":true}', { status: 200 }));
    const res = await proxy(req("/products/cement-ppc-50kg"));
    expect(isNext(res)).toBe(true);
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0];
    expect(String(url)).toBe(
      "https://shop.example.test/api/catalogue/product?slug=cement-ppc-50kg",
    );
    expect(init?.cache).toBe("no-store");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("rewrites unknown/inactive products (catalogue says 404) to a route that does not exist", async () => {
    stubFetch(() => new Response('{"exists":false}', { status: 404 }));
    const res = await proxy(req("/products/retired-item"));
    expect(isRewriteToMissing(res)).toBe(true);
    expect(isNext(res)).toBe(false);
  });

  it.each([
    "/products/Bad%20Slug",
    "/products/UPPER",
    "/products/..%2Fetc%2Fpasswd",
    "/products/%E0%A4%A",
    `/products/${"a".repeat(81)}`,
    "/products/a--b",
    "/products/-x",
  ])("rejects malformed slug %s with a 404 WITHOUT asking the catalogue", async (path) => {
    const f = stubFetch(() => new Response("{}", { status: 200 }));
    expect(isRewriteToMissing(await proxy(req(path)))).toBe(true);
    expect(f).not.toHaveBeenCalled();
  });

  it.each([
    ["catalogue unavailable (503)", () => new Response("{}", { status: 503 })],
    ["internal route error (500)", () => new Response("{}", { status: 500 })],
    ["network error", () => Promise.reject(new TypeError("fetch failed"))],
    ["timeout", () => Promise.reject(new DOMException("timed out", "TimeoutError"))],
  ])("FAILS OPEN on %s", async (_n, impl) => {
    stubFetch(impl);
    expect(isNext(await proxy(req("/products/cement-ppc-50kg")))).toBe(true);
  });
});

describe("proxy: admin route protection and session management", () => {
  function mockSupabaseProxy(params: {
    user?: { id: string; email?: string } | null;
    profile?: { id: string; is_active: boolean } | null;
    shouldThrow?: boolean;
  }) {
    if (params.shouldThrow) {
      vi.spyOn(proxyModule, "createSupabaseProxyClient").mockImplementation(() => {
        throw new Error("Supabase proxy initialization error");
      });
      return;
    }

    vi.spyOn(proxyModule, "createSupabaseProxyClient").mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: params.user ?? null },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: params.profile ?? null,
              error: null,
            }),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof proxyModule.createSupabaseProxyClient>);
  }

  it("redirects unauthenticated visitor accessing /admin/dashboard to /admin/login with returnTo", async () => {
    mockSupabaseProxy({ user: null });
    const res = await proxy(req("/admin/dashboard"));
    expect(isRedirectTo(res, "/admin/login?returnTo=%2Fadmin%2Fdashboard")).toBe(true);
  });

  it("redirects unauthenticated visitor accessing nested routes preserving query parameters", async () => {
    mockSupabaseProxy({ user: null });
    const res = await proxy(req("/admin/products?cat=tmt-steel"));
    expect(isRedirectTo(res, "/admin/login?returnTo=%2Fadmin%2Fproducts%3Fcat%3Dtmt-steel")).toBe(
      true,
    );
  });

  it("allows unauthenticated visitor to reach /admin/login", async () => {
    mockSupabaseProxy({ user: null });
    const res = await proxy(req("/admin/login"));
    expect(isNext(res)).toBe(true);
  });

  it("redirects authenticated active admin away from /admin/login to /admin/dashboard", async () => {
    mockSupabaseProxy({
      user: { id: "admin-1", email: "admin@example.com" },
      profile: { id: "admin-1", is_active: true },
    });
    const res = await proxy(req("/admin/login"));
    expect(isRedirectTo(res, "/admin/dashboard")).toBe(true);
  });

  it("redirects authenticated active admin to valid returnTo destination when accessing login", async () => {
    mockSupabaseProxy({
      user: { id: "admin-1", email: "admin@example.com" },
      profile: { id: "admin-1", is_active: true },
    });
    const res = await proxy(req("/admin/login?returnTo=/admin/categories"));
    expect(isRedirectTo(res, "/admin/categories")).toBe(true);
  });

  it("allows authenticated user without active admin profile to view /admin/login", async () => {
    mockSupabaseProxy({
      user: { id: "user-2", email: "user@example.com" },
      profile: null,
    });
    const res = await proxy(req("/admin/login"));
    expect(isNext(res)).toBe(true);
  });

  it("allows authenticated user through on protected admin route", async () => {
    mockSupabaseProxy({
      user: { id: "admin-1", email: "admin@example.com" },
      profile: { id: "admin-1", is_active: true },
    });
    const res = await proxy(req("/admin/dashboard"));
    expect(isNext(res)).toBe(true);
  });

  it("fails closed on protected route if Supabase client throws", async () => {
    mockSupabaseProxy({ shouldThrow: true });
    const res = await proxy(req("/admin/dashboard"));
    expect(isRedirectTo(res, "/admin/login")).toBe(true);
  });
});
