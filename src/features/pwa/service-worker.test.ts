// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

/**
 * Behavioural tests of the REAL public/sw.js: it is evaluated in a sandbox with a fake CacheStorage and synthetic fetch
 * events, so what is asserted is what the worker actually does (answers / bypasses / stores), not what its source mentions.
 */
type Listener = (event: unknown) => void;
const SRC = readFileSync(join(process.cwd(), "public/sw.js"), "utf8");
const ORIGIN = "https://shop.test";

function basic(body: string, init: ResponseInit = {}) {
  const r = new Response(body, { status: 200, ...init });
  Object.defineProperty(r, "type", { value: "basic" });
  return r;
}

function boot(fetchImpl: (req: { url: string }) => Promise<Response>) {
  const listeners: Record<string, Listener> = {};
  const store = new Map<string, Map<string, Response>>();
  const timers: Array<() => void> = [];
  const fetchCalls: string[] = [];
  const makeCache = (name: string) => {
    if (!store.has(name)) store.set(name, new Map());
    const m = store.get(name)!;
    return {
      put: async (req: { url: string }, res: Response) => void m.set(req.url, res),
      match: async (req: { url: string }) => m.get(req.url)?.clone(),
      keys: async () => [...m.keys()].map((url) => ({ url })),
      delete: async (req: { url: string }) => m.delete(req.url),
      addAll: async (urls: string[]) => {
        for (const u of urls) m.set(`${ORIGIN}${u}`, basic(`precached ${u}`));
      },
    };
  };
  const caches = {
    open: async (n: string) => makeCache(n),
    keys: async () => [...store.keys()],
    delete: async (n: string) => store.delete(n),
    // Real CacheStorage.match accepts a Request OR a URL string.
    match: async (req: { url: string } | string) => {
      const url = typeof req === "string" ? new URL(req, ORIGIN).href : req.url;
      for (const m of store.values()) {
        const hit = m.get(url);
        if (hit) return hit.clone();
      }
      return undefined;
    },
  };
  const selfObj = {
    location: { origin: ORIGIN },
    addEventListener: (t: string, fn: Listener) => void (listeners[t] = fn),
    clients: { claim: async () => undefined },
    skipWaiting: vi.fn(),
  };
  const ctx = {
    self: selfObj,
    caches,
    fetch: (req: { url: string }) => {
      fetchCalls.push(req.url);
      return fetchImpl(req);
    },
    URL,
    Response,
    Headers,
    setTimeout: (fn: () => void) => (timers.push(fn), 0),
    console,
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);

  async function dispatch(
    path: string,
    opts: {
      method?: string;
      mode?: string;
      headers?: Record<string, string>;
      origin?: string;
    } = {},
  ): Promise<Response | "BYPASSED"> {
    const request = {
      url: `${opts.origin ?? ORIGIN}${path}`,
      method: opts.method ?? "GET",
      mode: opts.mode ?? "navigate",
      headers: new Headers(opts.headers),
    };
    let responded: Promise<Response> | null = null;
    listeners.fetch({
      request,
      respondWith: (p: Promise<Response>) => void (responded = Promise.resolve(p)),
    });
    return responded ? await responded : "BYPASSED";
  }
  const cachedUrls = () => [...store.values()].flatMap((m) => [...m.keys()]);
  return { listeners, store, timers, fetchCalls, dispatch, cachedUrls, selfObj };
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const ok = () =>
  Promise.resolve(basic("<html>page</html>", { headers: { "content-type": "text/html" } }));

describe("service worker: private traffic is never touched", () => {
  const blocked: Array<[string, Parameters<ReturnType<typeof boot>["dispatch"]>[1]?]> = [
    ["/admin/enquiries"],
    ["/admin/login"],
    ["/api/health"],
    ["/api/admin/session"],
    ["/api/quotation/qt_secret/pdf"],
    ["/api/notifications/process"],
    ["/track-enquiry"],
    ["/track-enquiry?ref=ENQ-1&token=tr_secret"],
    ["/quotation/qt_0123456789abcdef0123456789abcdef"],
    ["/_next/data/build/products.json"],
    ["/products?token=abc"],
    ["/products?q=cement"],
    ["/contact?email=a@b.test"],
    ["/products?_rsc=abc", { mode: "cors" }],
    ["/my-material-lists", {}],
    ["/rate-alerts/confirm", {}],
    ["/rate-alerts/unsubscribe", {}],
    ["/api/qr/product/cement?format=png", {}],
    ["/api/rate-alerts/process", {}],
    ["/products", { method: "POST" }],
    ["/products", { origin: "https://evil.example" }],
    ["/products", { headers: { authorization: "Bearer x" } }],
    ["/products", { headers: { range: "bytes=0-10" } }],
    ["/products", { headers: { rsc: "1" } }],
    ["/products", { headers: { "next-router-prefetch": "1" } }],
  ];

  it.each(blocked)(
    "%s is passed straight to the network: no answer, no fetch, nothing stored",
    async (path, opts) => {
      const sw = boot(ok);
      expect(await sw.dispatch(path, opts)).toBe("BYPASSED");
      await tick();
      expect(sw.fetchCalls).toEqual([]);
      expect(sw.cachedUrls()).toEqual([]);
    },
  );

  it("navigations outside the public-page allowlist are network-only", async () => {
    const sw = boot(ok);
    for (const p of [
      "/dev/sheets",
      "/some-other-page",
      "/products/a/b",
      "/products/UPPER",
      "/offline/x",
    ])
      expect(await sw.dispatch(p), p).toBe("BYPASSED");
    expect(sw.cachedUrls()).toEqual([]);
  });
});

describe("service worker: public pages", () => {
  it.each([
    "/",
    "/products",
    "/products/cement-ppc-50kg",
    "/contact",
    "/bulk-enquiry",
    "/tools",
    "/tools/material-calculator",
    "/tools/project-planner",
    "/compare",
    "/delivery-check",
    "/ask-expert",
    "/rate-alerts",
  ])("%s is served from the network and saved with a timestamp", async (path) => {
    const sw = boot(ok);
    const res = await sw.dispatch(path);
    expect(res).not.toBe("BYPASSED");
    expect(await (res as Response).text()).toContain("page");
    await tick();
    const saved = [...sw.store.get("sagar-pages-v2")!.values()][0];
    expect(saved.headers.get("x-sw-cached-at")).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("never stores responses that forbid caching, errors, or non-basic responses", async () => {
    for (const make of [
      () => basic("x", { headers: { "cache-control": "no-store" } }),
      () => basic("x", { headers: { "cache-control": "private, max-age=0" } }),
      () => basic("x", { status: 500 }),
      () => basic("x", { status: 404 }),
      () => {
        const r = new Response("x", { status: 200 });
        Object.defineProperty(r, "type", { value: "cors" });
        return r;
      },
    ]) {
      const sw = boot(() => Promise.resolve(make()));
      await sw.dispatch("/products");
      await tick();
      expect(sw.store.get("sagar-pages-v2")?.size ?? 0).toBe(0);
    }
  });

  it("offline: serves the saved copy (still stamped), else the offline page, else a plain 503", async () => {
    let online = true;
    const sw = boot(() => (online ? ok() : Promise.reject(new TypeError("offline"))));
    await sw.listeners.install({ waitUntil: (p: Promise<unknown>) => p });
    await sw.dispatch("/products");
    await tick();
    online = false;
    const saved = (await sw.dispatch("/products")) as Response;
    expect(saved.headers.get("x-sw-cached-at")).toBeTruthy();
    expect(await saved.text()).toContain("page");
    const fallback = (await sw.dispatch("/contact")) as Response; // never visited
    expect(await fallback.text()).toBe("precached /offline");
    const bare = boot(() => Promise.reject(new TypeError("offline")));
    const last = (await bare.dispatch("/contact")) as Response;
    expect(last.status).toBe(503);
  });

  it("slow network: after the timeout the saved copy is served while the request continues", async () => {
    let release!: (r: Response) => void;
    let first = true;
    const sw = boot(() =>
      first ? ((first = false), ok()) : new Promise<Response>((r) => (release = r)),
    );
    await sw.dispatch("/products");
    await tick();
    const pending = sw.dispatch("/products");
    await tick();
    sw.timers.forEach((t) => t()); // the 4 s navigation timeout fires
    const res = (await pending) as Response;
    expect(res.headers.get("x-sw-cached-at")).toBeTruthy(); // the saved copy answered
    release(basic("fresh"));
  });

  it("keeps the page cache bounded (oldest entries are evicted)", async () => {
    const sw = boot(ok);
    for (let i = 0; i < 50; i++) {
      await sw.dispatch(`/products/item-${i}`);
      await tick();
    }
    const urls = [...sw.store.get("sagar-pages-v2")!.keys()];
    expect(urls.length).toBeLessThanOrEqual(40);
    expect(urls).toContain(`${ORIGIN}/products/item-49`);
    expect(urls).not.toContain(`${ORIGIN}/products/item-0`);
  });
});

describe("service worker: assets, install, activate, messages", () => {
  it("build assets are cache-first: the second request does not hit the network", async () => {
    const sw = boot(() => Promise.resolve(basic("js")));
    await sw.dispatch("/_next/static/chunks/app.js", { mode: "no-cors" });
    await tick();
    await sw.dispatch("/_next/static/chunks/app.js", { mode: "no-cors" });
    expect(sw.fetchCalls).toHaveLength(1);
  });

  it("does not handle other same-origin resources (e.g. /_next/image, fonts) — network only", async () => {
    const sw = boot(ok);
    expect(await sw.dispatch("/_next/image?url=%2Fa.jpg&w=640&q=75", { mode: "no-cors" })).toBe(
      "BYPASSED",
    );
    expect(await sw.dispatch("/robots.txt", { mode: "no-cors" })).toBe("BYPASSED");
  });

  it("install pre-caches only the offline page and icons — no dynamic pages", async () => {
    const sw = boot(ok);
    await sw.listeners.install({ waitUntil: (p: Promise<unknown>) => p });
    expect(sw.cachedUrls().sort()).toEqual(
      [`${ORIGIN}/icons/icon-192.png`, `${ORIGIN}/icons/icon-512.png`, `${ORIGIN}/offline`].sort(),
    );
  });

  it("activate removes old Sagar caches only, and leaves other applications' caches alone", async () => {
    const sw = boot(ok);
    sw.store.set("sagar-pages-v1", new Map());
    sw.store.set("sagar-traders-v1", new Map());
    sw.store.set("sagar-pages-v2", new Map());
    sw.store.set("someone-elses-cache", new Map());
    await sw.listeners.activate({ waitUntil: (p: Promise<unknown>) => p });
    expect([...sw.store.keys()].sort()).toEqual(["sagar-pages-v2", "someone-elses-cache"]);
  });

  it("only activates a new version when the page asks (SKIP_WAITING), and can clear its caches", async () => {
    const sw = boot(ok);
    await sw.listeners.install({ waitUntil: (p: Promise<unknown>) => p });
    expect(sw.selfObj.skipWaiting).not.toHaveBeenCalled(); // no forced takeover of open pages
    sw.listeners.message({ data: { type: "SKIP_WAITING" }, waitUntil: () => undefined });
    expect(sw.selfObj.skipWaiting).toHaveBeenCalledTimes(1);
    sw.listeners.message({ data: { type: "something-else" }, waitUntil: () => undefined });
    expect(sw.selfObj.skipWaiting).toHaveBeenCalledTimes(1);
    let done: Promise<unknown> = Promise.resolve();
    sw.listeners.message({
      data: { type: "CLEAR_CACHES" },
      waitUntil: (p: Promise<unknown>) => (done = p),
    });
    await done;
    expect(sw.store.size).toBe(0);
  });
});
