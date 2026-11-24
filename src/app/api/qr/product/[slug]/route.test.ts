// @vitest-environment node
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { loadFrom, realisticSheets } from "@/features/catalogue/test-catalogue";

const state = vi.hoisted(() => ({ load: null as unknown, site: "https://shop.example.test" }));
vi.mock("@/features/catalogue/server", () => ({ loadCatalogue: async () => state.load }));
vi.mock("@/lib/env/public", () => ({
  publicEnv: new Proxy(
    {},
    { get: (_t, k) => (k === "NEXT_PUBLIC_SITE_URL" ? state.site : undefined) },
  ),
}));

import { GET } from "./route";

const call = (slug: string, query = "") =>
  GET(new Request(`https://shop.example.test/api/qr/product/${slug}${query}`), {
    params: Promise.resolve({ slug }),
  });
const scan = async (res: Response) => {
  const img = PNG.sync.read(Buffer.from(await res.arrayBuffer()));
  return jsQR(new Uint8ClampedArray(img.data), img.width, img.height)?.data ?? null;
};
let slug: string;

beforeEach(async () => {
  state.site = "https://shop.example.test";
  state.load = await loadFrom(realisticSheets());
  slug = (state.load as { catalogue: { products: { slug: string }[] } }).catalogue.products[0].slug;
});

describe("GET /api/qr/product/[slug]", () => {
  it("SVG for an active product (default), cacheable, with no private data", async () => {
    const res = await call(slug);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/image\/svg\+xml/);
    expect(res.headers.get("cache-control")).toMatch(/public/);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect((await res.text()).startsWith("<svg")).toBe(true);
  });

  it("PNG scans back to the canonical https product URL of the configured site", async () => {
    const res = await call(slug, "?format=png&size=600");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(await scan(res)).toBe(`https://shop.example.test/products/${slug}`);
  });

  it("the encoded domain follows the configured site URL (canonical domain handling)", async () => {
    state.site = "https://www.sagar.example.test";
    expect(await scan(await call(slug, "?format=png"))).toBe(
      `https://www.sagar.example.test/products/${slug}`,
    );
  });

  it("refuses to encode anything when the site URL is not https", async () => {
    state.site = "http://shop.example.test";
    expect((await call(slug)).status).toBe(500);
  });

  it("download=1 sets a safe attachment filename; otherwise the image is shown inline", async () => {
    const dl = await call(slug, "?format=png&download=1");
    expect(dl.headers.get("content-disposition")).toBe(
      `attachment; filename="sagar-traders-${slug}-qr.png"`,
    );
    expect((await call(slug)).headers.get("content-disposition")).toBeNull();
  });

  it("clamps the PNG size so it cannot be used to request huge images", async () => {
    const big = PNG.sync.read(
      Buffer.from(await (await call(slug, "?format=png&size=100000")).arrayBuffer()),
    );
    expect(big.width).toBeLessThanOrEqual(1100);
    const tiny = PNG.sync.read(
      Buffer.from(await (await call(slug, "?format=png&size=1")).arrayBuffer()),
    );
    expect(tiny.width).toBeGreaterThanOrEqual(100);
  });

  it.each(["UPPER", "has space", "../etc/passwd", "a--b", "x".repeat(81), "a%2fb", "<script>"])(
    "400 for the malformed slug %j (no catalogue lookup, no image)",
    async (bad) => {
      const res = await call(bad);
      expect(res.status).toBe(400);
      expect(res.headers.get("content-type")).toMatch(/text\/plain/);
    },
  );

  it("404 for an unknown or inactive product (inactive products are not in the public catalogue)", async () => {
    expect((await call("no-such-product")).status).toBe(404);
    expect((await call("retired-item")).status).toBe(404);
  });

  it("400 for an unsupported format; 503 when the catalogue cannot be read", async () => {
    expect((await call(slug, "?format=gif")).status).toBe(400);
    expect((await call(slug, "?format=<svg")).status).toBe(400);
    state.load = { ok: false };
    expect((await call(slug)).status).toBe(503);
  });

  it("error responses are never cached", async () => {
    expect((await call("UPPER")).headers.get("cache-control")).toBe("no-store");
    expect((await call("no-such-product")).headers.get("cache-control")).toBe("no-store");
  });
});
