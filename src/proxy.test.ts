// @vitest-environment node
import { NextRequest } from "next/server";
import { config, proxy } from "./proxy";

const req = (path: string) => new NextRequest(`https://shop.example.test${path}`);
const isRewriteToMissing = (res: Response) =>
  (res.headers.get("x-middleware-rewrite") ?? "").endsWith("/__product-not-found__");
const isNext = (res: Response) => res.headers.get("x-middleware-next") === "1";

function stubFetch(impl: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  const f = vi.fn(async (url: string, init?: RequestInit) => impl(url, init));
  vi.stubGlobal("fetch", f);
  return f;
}
afterEach(() => vi.unstubAllGlobals());

describe("proxy: genuine 404 for missing products", () => {
  it("matches only single-segment product URLs", () => {
    expect(config.matcher).toEqual(["/products/:slug"]);
  });

  it("lets existing products through after asking the internal catalogue route (same origin, slug encoded)", async () => {
    const f = stubFetch(() => new Response('{"exists":true}', { status: 200 }));
    const res = await proxy(req("/products/cement-ppc-50kg"));
    expect(isNext(res)).toBe(true);
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0];
    expect(String(url)).toBe(
      "https://shop.example.test/api/catalogue/product?slug=cement-ppc-50kg",
    );
    expect(init?.cache).toBe("no-store");
    expect(init?.signal).toBeInstanceOf(AbortSignal); // bounded wait
  });

  it("rewrites unknown/inactive products (catalogue says 404) to a route that does not exist, so Next returns a real 404", async () => {
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
  ])(
    "FAILS OPEN on %s: the page renders its own 'unavailable' state instead of 404ing every product",
    async (_n, impl) => {
      stubFetch(impl);
      expect(isNext(await proxy(req("/products/cement-ppc-50kg")))).toBe(true);
    },
  );
});
