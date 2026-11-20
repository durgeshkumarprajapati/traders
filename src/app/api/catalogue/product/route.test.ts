// @vitest-environment node
import { loadFrom, realisticSheets } from "@/features/catalogue/test-catalogue";

const state = vi.hoisted(() => ({ load: null as unknown }));
vi.mock("@/features/catalogue/server", () => ({ loadCatalogue: async () => state.load }));

import { GET } from "./route";

const get = (slug?: string) =>
  GET(
    new Request(
      `https://example.test/api/catalogue/product${slug === undefined ? "" : `?slug=${encodeURIComponent(slug)}`}`,
    ),
  );

beforeEach(async () => {
  state.load = await loadFrom(realisticSheets());
});

describe("internal product existence check", () => {
  it("200 for an active product", async () => {
    const res = await get("tmt-12mm");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ exists: true });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it.each([
    "retired-item",
    "in-inactive-category",
    "inactive-brand-item",
    "no-such",
    "UPPER",
    "../x",
    "",
  ])("404 for inactive, excluded, unknown or malformed slug %j", async (slug) => {
    const res = await get(slug);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ exists: false });
  });

  it("404 when no slug is given", async () => {
    expect((await get()).status).toBe(404);
  });

  it("503 (and no existence claim) when the catalogue cannot be read", async () => {
    state.load = { ok: false };
    const res = await get("tmt-12mm");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ available: false });
  });

  it("reveals nothing but existence", async () => {
    const body = JSON.stringify(await (await get("tmt-12mm")).json());
    expect(body).not.toMatch(/62500|TMT|brand|price|sku/i);
  });
});
