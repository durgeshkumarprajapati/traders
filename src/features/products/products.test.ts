import { FIXTURE_BRANDS, FIXTURE_CATEGORIES, FIXTURE_PRODUCTS } from "./test-fixtures";
import { PRICE_DISCLAIMER, formatPrice, formatRate, formatUpdated } from "./format";
import { PAGE_SIZE, filterAndSort, listingQuery, paginate, parseListingParams } from "./query";
import type { Product } from "./types";
import { UNIT_CODES, UNIT_LABELS, isUnitCode, isValidUnit, unitLabel } from "./units";

const data = { products: FIXTURE_PRODUCTS, categories: FIXTURE_CATEGORIES, brands: FIXTURE_BRANDS };
const base = parseListingParams({});

describe("units", () => {
  it("contains exactly the confirmed canonical list", () => {
    expect([...UNIT_CODES]).toEqual([
      "BAG",
      "PIECE",
      "KG",
      "TON",
      "METRIC_TON",
      "CUBIC_FEET",
      "CUBIC_METER",
      "BUNDLE",
      "BOX",
      "METER",
      "BRASS",
      "BLOCK",
      "CUSTOM",
    ]);
  });
  it("keeps TON and METRIC_TON separate with different labels", () => {
    expect(UNIT_LABELS.TON).toBe("Ton");
    expect(UNIT_LABELS.METRIC_TON).toBe("Metric Ton");
    expect(unitLabel({ code: "TON" })).not.toBe(unitLabel({ code: "METRIC_TON" }));
  });
  it("shows the user-defined label for CUSTOM and validates consistency", () => {
    expect(unitLabel({ code: "CUSTOM", customLabel: " Set " })).toBe("Set");
    expect(isValidUnit({ code: "CUSTOM", customLabel: "Set" })).toBe(true);
    expect(isValidUnit({ code: "CUSTOM" })).toBe(false);
    expect(isValidUnit({ code: "BAG", customLabel: "x" })).toBe(false);
    expect(isValidUnit({ code: "BAG" })).toBe(true);
  });
  it("does not treat pack descriptions as units", () => {
    expect(isUnitCode("50 kg Bag")).toBe(false);
    expect(isUnitCode("3m Length")).toBe(false);
    expect(isUnitCode("BAG")).toBe(true);
  });
});

describe("format", () => {
  it("never shows a missing, zero, negative or invalid price", () => {
    for (const p of [null, 0, -5, Number.NaN, Infinity]) expect(formatPrice(p)).toBeNull();
    expect(formatRate(null, { code: "BAG" })).toBeNull();
  });
  it("formats a valid rate with its unit", () => {
    expect(formatPrice(1234.5)).toBe("₹1,234.50");
    expect(formatRate(1234.5, { code: "METRIC_TON" })).toBe("₹1,234.50 / Metric Ton");
  });
  it("formats dates absolutely and rejects missing/invalid input", () => {
    expect(formatUpdated("2026-11-18T10:00:00Z")).toBe("18 Nov 2026");
    expect(formatUpdated(null)).toBeNull();
    expect(formatUpdated("not a date")).toBeNull();
  });
  it("uses the exact approved disclaimer", () => {
    expect(PRICE_DISCLAIMER).toBe(
      "Prices are indicative and subject to change. Please confirm the final rate before placing an order.",
    );
  });
});

describe("test fixtures", () => {
  it("are fake, price-free and cover all four stock statuses", () => {
    expect(FIXTURE_PRODUCTS.every((p) => p.price === null && p.updatedAt === null)).toBe(true);
    expect(FIXTURE_BRANDS.every((b) => /^Sample Brand/.test(b.name))).toBe(true);
    expect(new Set(FIXTURE_PRODUCTS.map((p) => p.stockStatus)).size).toBe(4);
  });
});

describe("parseListingParams", () => {
  it("applies defaults", () => {
    expect(base).toEqual({
      q: "",
      category: null,
      brands: [],
      stock: [],
      units: [],
      minPrice: null,
      maxPrice: null,
      sort: "featured",
      page: 1,
    });
  });
  it("sanitises untrusted input", () => {
    const p = parseListingParams({
      q: "  cement  ",
      category: "Bad Slug!",
      brand: ["ok-brand", "../x"],
      stock: ["IN_STOCK", "HACK"],
      sort: "nope",
      page: "-3",
    });
    expect(p).toMatchObject({
      q: "cement",
      category: null,
      brands: ["ok-brand"],
      stock: ["IN_STOCK"],
      sort: "featured",
      page: 1,
    });
    expect(parseListingParams({ q: "x".repeat(500) }).q).toHaveLength(100);
    expect(parseListingParams({ page: "abc" }).page).toBe(1);
  });
});

describe("filterAndSort", () => {
  it("searches case-insensitively over name, SKU and brand", () => {
    expect(filterAndSort(data, { ...base, q: "SAMPLE CEMENT" }).map((p) => p.id)).toEqual([
      "prod-1",
      "prod-2",
    ]);
    expect(filterAndSort(data, { ...base, q: "sample-010" }).map((p) => p.id)).toEqual(["prod-10"]);
    // Multi-word search requires every term to appear somewhere (name, SKU, brand, category, description).
    expect(
      filterAndSort(data, { ...base, q: "Brand C" }).some((p) => p.brandId === "brand-c"),
    ).toBe(true);
    expect(filterAndSort(data, { ...base, q: "brick sample brand b" }).map((p) => p.id)).toContain(
      "prod-5",
    );
    expect(filterAndSort(data, { ...base, q: "brick pipe" })).toEqual([]); // no product contains both terms
    expect(filterAndSort(data, { ...base, q: "zzz-nothing" })).toEqual([]);
  });
  it("filters by category, brand and stock (including AVAILABLE_ON_ORDER), and combines them", () => {
    expect(
      filterAndSort(data, { ...base, category: "steel-tmt" })
        .map((p) => p.id)
        .sort(),
    ).toEqual(["prod-3", "prod-4"]);
    expect(
      filterAndSort(data, { ...base, brands: ["sample-brand-a"] }).every(
        (p) => p.brandId === "brand-a",
      ),
    ).toBe(true);
    expect(
      filterAndSort(data, { ...base, stock: ["AVAILABLE_ON_ORDER"] })
        .map((p) => p.id)
        .sort(),
    ).toEqual(["prod-4", "prod-9"]);
    expect(
      filterAndSort(data, { ...base, category: "steel-tmt", stock: ["AVAILABLE_ON_ORDER"] }).map(
        (p) => p.id,
      ),
    ).toEqual(["prod-4"]);
    expect(filterAndSort(data, { ...base, category: "unknown-category" })).toEqual([]);
  });
  it("puts featured products first by default", () => {
    const featuredFlags = filterAndSort(data, base).map((p) => p.isFeatured);
    expect(featuredFlags.indexOf(false)).toBeGreaterThanOrEqual(featuredFlags.lastIndexOf(true));
  });
  it("sorts by price with unpriced products always last, never as 0", () => {
    const priced: Product[] = [
      { ...FIXTURE_PRODUCTS[0], id: "a", price: 300 },
      { ...FIXTURE_PRODUCTS[1], id: "b", price: null },
      { ...FIXTURE_PRODUCTS[2], id: "c", price: 100 },
    ];
    const d = { ...data, products: priced };
    expect(filterAndSort(d, { ...base, sort: "price-asc" }).map((p) => p.id)).toEqual([
      "c",
      "a",
      "b",
    ]);
    expect(filterAndSort(d, { ...base, sort: "price-desc" }).map((p) => p.id)).toEqual([
      "a",
      "c",
      "b",
    ]);
  });
  it("filters by canonical unit codes", () => {
    const bagOnly = filterAndSort(data, { ...base, units: ["BAG"] });
    expect(bagOnly.length).toBeGreaterThan(0);
    expect(bagOnly.every((p) => p.unit.code === "BAG")).toBe(true);
  });
  it("filters by price range when prices are present", () => {
    const pricedData = {
      ...data,
      products: [
        { ...FIXTURE_PRODUCTS[0], id: "p1", price: 100 },
        { ...FIXTURE_PRODUCTS[1], id: "p2", price: 250 },
        { ...FIXTURE_PRODUCTS[2], id: "p3", price: 500 },
      ],
    };
    const range = filterAndSort(pricedData, { ...base, minPrice: 150, maxPrice: 300 });
    expect(range.map((p) => p.id)).toEqual(["p2"]);
  });
  it("matches products via vernacular synonyms", () => {
    // e.g. "sariya" matches steel / tmt rebars
    const steelData = {
      ...data,
      products: [
        {
          ...FIXTURE_PRODUCTS[0],
          id: "s1",
          name: "Fe 550D TMT Rebar 12mm",
          description: "High strength steel bar",
        },
        {
          ...FIXTURE_PRODUCTS[1],
          id: "c1",
          name: "PPC Cement 50kg",
          description: "Portland cement",
        },
      ],
    };
    const result = filterAndSort(steelData, { ...base, q: "sariya" });
    expect(result.map((p) => p.id)).toEqual(["s1"]);
  });
  it("sorts by recent update with unknown dates last", () => {
    const ts: Product[] = [
      { ...FIXTURE_PRODUCTS[0], id: "old", updatedAt: "2026-01-01T00:00:00Z" },
      { ...FIXTURE_PRODUCTS[1], id: "none", updatedAt: null },
      { ...FIXTURE_PRODUCTS[2], id: "new", updatedAt: "2026-06-01T00:00:00Z" },
    ];
    expect(
      filterAndSort({ ...data, products: ts }, { ...base, sort: "updated" }).map((p) => p.id),
    ).toEqual(["new", "old", "none"]);
  });
});

describe("paginate / listingQuery", () => {
  it("paginates and clamps the page", () => {
    const items = Array.from({ length: PAGE_SIZE + 3 }, (_, i) => i);
    expect(paginate(items, 1)).toMatchObject({ page: 1, pageCount: 2, total: 11, start: 0 });
    expect(paginate(items, 2).items).toHaveLength(3);
    expect(paginate(items, 99).page).toBe(2);
    expect(paginate([], 1)).toMatchObject({ pageCount: 1, total: 0, items: [] });
  });
  it("builds query strings that omit defaults", () => {
    expect(listingQuery(base)).toBe("");
    expect(
      listingQuery(
        { ...base, q: "a b", category: "cement", brands: ["x", "y"], sort: "price-asc" },
        { page: 3 },
      ),
    ).toBe("?q=a+b&category=cement&brand=x&brand=y&sort=price-asc&page=3");
  });
});
