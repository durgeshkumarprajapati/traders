// @vitest-environment node
import type { ViewCatalogue } from "@/features/catalogue/view";
import {
  FIXTURE_BRANDS,
  FIXTURE_CATEGORIES,
  FIXTURE_PRODUCTS,
} from "@/features/products/test-fixtures";
import type { Product } from "@/features/products/types";
import { MAX_COMPARE, buildComparison, compareHref, parseCompareIds } from "./compare";

const base = FIXTURE_PRODUCTS[0];
const mk = (id: string, over: Partial<Product> = {}): Product => ({
  ...base,
  id,
  slug: id,
  name: `Product ${id}`,
  sku: null,
  brandId: null,
  price: null,
  stockStatus: null,
  updatedAt: null,
  imageUrl: null,
  specifications: [],
  unit: { code: "BAG" },
  ...over,
});
const catalogue = (products: Product[]): ViewCatalogue => ({
  products,
  categories: FIXTURE_CATEGORIES,
  brands: FIXTURE_BRANDS,
});

describe("parseCompareIds", () => {
  it("accepts up to three distinct, well-formed ids from a comma list or repeated parameters", () => {
    expect(parseCompareIds("a,b,c")).toEqual(["a", "b", "c"]);
    expect(parseCompareIds(["a,b", "c"])).toEqual(["a", "b", "c"]);
    expect(parseCompareIds("a,b,c,d,e")).toEqual(["a", "b", "c"]);
    expect(parseCompareIds(" a , a , b ")).toEqual(["a", "b"]);
  });

  it.each([undefined, "", ",,,", "bad id", "a/../b", "<script>", "x".repeat(65), "%00"])(
    "ignores %j",
    (raw) => {
      expect(parseCompareIds(raw as string | undefined)).toEqual([]);
    },
  );

  it("drops only the invalid entries", () => {
    expect(parseCompareIds("ok,not ok,fine")).toEqual(["ok", "fine"]);
  });

  it("builds a shareable URL with only valid ids (max three)", () => {
    expect(compareHref(["a", "b", "c", "d"])).toBe("/compare?ids=a,b,c");
    expect(compareHref([])).toBe("/compare");
    expect(compareHref(["bad id"])).toBe("/compare");
    expect(MAX_COMPARE).toBe(3);
  });
});

describe("buildComparison", () => {
  it("works for one, two and three products, in the requested order", () => {
    const c = catalogue([mk("a"), mk("b"), mk("c"), mk("d")]);
    expect(buildComparison(c, ["a"]).columns.map((x) => x.id)).toEqual(["a"]);
    expect(buildComparison(c, ["c", "a"]).columns.map((x) => x.id)).toEqual(["c", "a"]);
    expect(buildComparison(c, ["a", "b", "c"]).columns).toHaveLength(3);
  });

  it("never returns a fourth product, even if asked", () => {
    const c = catalogue([mk("a"), mk("b"), mk("c"), mk("d")]);
    const r = buildComparison(c, ["a", "b", "c", "d"]);
    expect(r.columns.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("reports ids that are not active catalogue products (inactive / deleted) as missing instead of inventing them", () => {
    const r = buildComparison(catalogue([mk("a")]), ["a", "gone", "inactive"]);
    expect(r.columns.map((x) => x.id)).toEqual(["a"]);
    expect(r.missing).toEqual(["gone", "inactive"]);
  });

  it("an attribute that is not in the catalogue stays null — nothing is invented", () => {
    const r = buildComparison(catalogue([mk("a")]), ["a"]);
    expect(r.columns[0]).toMatchObject({
      brand: null,
      sku: null,
      rate: null,
      stockStatus: null,
      updatedAt: null,
      imageUrl: null,
    });
    expect(r.columns[0].specs).toEqual([]);
    expect(r.specRows).toEqual([]);
  });

  it("a missing or zero price is null, never ₹0", () => {
    const r = buildComparison(
      catalogue([mk("a", { price: null }), mk("b", { price: 0 }), mk("c", { price: 385 })]),
      ["a", "b", "c"],
    );
    expect(r.columns.map((c) => c.rate)).toEqual([null, null, "₹385.00 / Bag"]);
  });

  it("uses the real brand, category, unit label (incl. custom labels), stock and date", () => {
    const r = buildComparison(
      catalogue([
        mk("a", {
          brandId: FIXTURE_BRANDS[0].id,
          categoryId: FIXTURE_CATEGORIES[0].id,
          unit: { code: "CUSTOM", customLabel: "Roll" },
          stockStatus: "IN_STOCK",
          updatedAt: "2026-11-18T00:00:00Z",
          sku: "S-1",
        }),
      ]),
      ["a"],
    );
    expect(r.columns[0]).toMatchObject({
      brand: FIXTURE_BRANDS[0].name,
      category: FIXTURE_CATEGORIES[0].name,
      unit: "Roll",
      unitCode: "CUSTOM",
      stockStatus: "IN_STOCK",
      sku: "S-1",
    });
  });

  it("merges specification labels case-insensitively across products, with null where a product lacks one", () => {
    const r = buildComparison(
      catalogue([
        mk("a", {
          specifications: [
            { label: "Grade", value: "53" },
            { label: "Weight", value: "50 kg" },
          ],
        }),
        mk("b", {
          specifications: [
            { label: "grade", value: "43" },
            { label: "Colour", value: "Grey" },
          ],
        }),
      ]),
      ["a", "b"],
    );
    expect(r.specRows).toEqual([
      { label: "Grade", values: ["53", "43"] },
      { label: "Weight", values: ["50 kg", null] },
      { label: "Colour", values: [null, "Grey"] },
    ]);
  });

  it("flags different units and says rates cannot be compared directly", () => {
    const r = buildComparison(
      catalogue([mk("a", { unit: { code: "BAG" } }), mk("b", { unit: { code: "KG" } })]),
      ["a", "b"],
    );
    expect(r.notes).toHaveLength(1);
    expect(r.notes[0]).toMatch(/different units/);
    expect(r.notes[0]).toMatch(/cannot be compared directly/);
  });

  it("TON and METRIC_TON are called out as NOT the same", () => {
    const r = buildComparison(
      catalogue([mk("a", { unit: { code: "TON" } }), mk("b", { unit: { code: "METRIC_TON" } })]),
      ["a", "b"],
    );
    expect(r.notes[0]).toMatch(/Ton and Metric Ton, which are not the same/);
  });

  it("no note when every unit is the same", () => {
    expect(buildComparison(catalogue([mk("a"), mk("b")]), ["a", "b"]).notes).toEqual([]);
  });

  it("never ranks or recommends: no best / cheapest / strongest / recommended wording anywhere in the result", () => {
    const r = buildComparison(
      catalogue([mk("a", { price: 100 }), mk("b", { price: 50, unit: { code: "KG" } })]),
      ["a", "b"],
    );
    expect(JSON.stringify(r)).not.toMatch(
      /best|cheapest|strongest|recommend|winner|better|most suitable|rank/i,
    );
  });

  it("an empty request gives an empty, valid comparison", () => {
    expect(buildComparison(catalogue([mk("a")]), [])).toEqual({
      columns: [],
      missing: [],
      specRows: [],
      notes: [],
    });
  });
});
