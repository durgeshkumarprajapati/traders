// @vitest-environment node
import { loadFrom, realisticSheets } from "@/features/catalogue/test-catalogue";

const state = vi.hoisted(() => ({ load: null as unknown }));
vi.mock("@/features/catalogue/server", () => ({ loadCatalogue: async () => state.load }));

import { resolveMaterialItemsAction } from "./actions";

beforeEach(async () => {
  state.load = await loadFrom(realisticSheets());
});

describe("resolveMaterialItemsAction (fresh catalogue facts for saved lists)", () => {
  it("returns current name, unit, rate and stock for known products and null for unknown ones", async () => {
    const load = state.load as { catalogue: { products: { id: string; name: string }[] } };
    const real = load.catalogue.products[0];
    const r = await resolveMaterialItemsAction([real.id, "no-such-product"]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.products["no-such-product"]).toBeNull();
    expect(r.products[real.id]).toMatchObject({ name: real.name });
    expect(Object.keys(r.products[real.id]!).sort()).toEqual([
      "brandName",
      "name",
      "rate",
      "slug",
      "stockStatus",
      "unitLabel",
      "updatedAt",
    ]);
  });

  it("returns only public fields (no ids, SKU, internal data, descriptions)", async () => {
    const load = state.load as { catalogue: { products: { id: string }[] } };
    const r = await resolveMaterialItemsAction([load.catalogue.products[0].id]);
    expect(JSON.stringify(r)).not.toMatch(/sku|description|isActive|createdAt|categoryId|brandId/);
  });

  it("de-duplicates ids and rejects malformed or oversized input without touching the catalogue", async () => {
    const load = state.load as { catalogue: { products: { id: string }[] } };
    const id = load.catalogue.products[0].id;
    const dup = await resolveMaterialItemsAction([id, id, id]);
    expect(dup.ok && Object.keys(dup.products)).toEqual([id]);
    for (const bad of [
      "x",
      null,
      [1],
      ["has space"],
      ["a".repeat(65)],
      Array.from({ length: 101 }, (_, i) => `p${i}`),
      [{ id: "x" }],
      ["../etc"],
    ])
      expect((await resolveMaterialItemsAction(bad)).ok, JSON.stringify(bad)).toBe(false);
  });

  it("says plainly when the catalogue cannot be read (never invents values)", async () => {
    state.load = { ok: false };
    const r = await resolveMaterialItemsAction(["p1"]);
    expect(r).toEqual({ ok: false, message: expect.stringMatching(/temporarily unavailable/i) });
  });

  it("labels static fallback data as STATIC so the page can warn that it is not live", async () => {
    const live = state.load as {
      ok: true;
      source: string;
      catalogue: { products: { id: string }[] };
    };
    state.load = { ...live, source: "STATIC" };
    const r = await resolveMaterialItemsAction([live.catalogue.products[0].id]);
    expect(r.ok && r.source).toBe("STATIC");
  });
});
