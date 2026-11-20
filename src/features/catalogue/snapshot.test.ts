// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SheetsApiError, SheetsStructureError } from "@/lib/google-sheets/errors";
import {
  FakeSheets,
  PRODUCT_HEADERS,
  baseSheets,
  productRow,
} from "@/lib/google-sheets/test-utils";
import { SHEETS_CACHE_LIFE, SHEETS_CACHE_TAG } from "./constants";
import { fetchSheetsSnapshot } from "./snapshot";
import { toPublicCatalogue } from "./public";

const NOW = new Date("2026-11-18T12:00:00.000Z");
const fetchFrom = (sheets: FakeSheets) => fetchSheetsSnapshot(sheets, () => NOW);

describe("fetchSheetsSnapshot", () => {
  it("reads all four worksheets in a single request and returns a serialisable snapshot", async () => {
    const fake = new FakeSheets();
    const snap = await fetchFrom(fake);
    expect(fake.calls).toEqual(["read"]);
    expect(snap.fetchedAt).toBe("2026-11-18T12:00:00.000Z");
    expect(snap.stats).toEqual({
      products: { rows: 1, valid: 1 },
      categories: { rows: 2, valid: 2 },
      brands: { rows: 2, valid: 2 },
      settings: { rows: 1, valid: 1 },
    });
    expect(snap.settings.businessName).toBe("Test Business");
    expect(JSON.parse(JSON.stringify(snap))).toEqual(snap); // safe to cache / send across the cache boundary
  });

  it("a header-only worksheet is an empty catalogue, not an error", async () => {
    const sheets = baseSheets();
    sheets.Products = [PRODUCT_HEADERS];
    const snap = await fetchFrom(new FakeSheets(sheets));
    expect(snap.products).toEqual([]);
    expect(snap.issues).toEqual([]);
  });

  it("an API failure THROWS — it is never turned into an empty or invented catalogue", async () => {
    const fake = new FakeSheets();
    fake.failOn.read = new SheetsApiError("Google Sheets API error (HTTP 503)", 503, true);
    await expect(fetchFrom(fake)).rejects.toBeInstanceOf(SheetsApiError);
  });

  it("a missing or blank worksheet throws a structure error instead of returning zero records", async () => {
    const sheets = baseSheets();
    delete sheets.Brands;
    await expect(fetchFrom(new FakeSheets(sheets))).rejects.toBeInstanceOf(SheetsStructureError);
    const blank = baseSheets();
    blank.Categories = [[]];
    await expect(fetchFrom(new FakeSheets(blank))).rejects.toMatchObject({
      worksheet: "Categories",
    });
  });

  it("one malformed record does not corrupt the rest of the catalogue", async () => {
    const sheets = baseSheets();
    sheets.Products.push(
      productRow({ product_id: "bad", slug: "Bad Slug", unit: "50 kg Bag" }),
      productRow({ product_id: "prod_3", slug: "sample-product-3", price: "abc" }),
    );
    const snap = await fetchFrom(new FakeSheets(sheets));
    expect(snap.products.map((p) => p.id)).toEqual(["prod_1", "prod_3"]);
    expect(snap.products[1].price).toBeNull();
    expect(snap.issues.filter((i) => i.severity === "error")).toHaveLength(2); // slug + unit on the bad row
    expect(snap.issues.filter((i) => i.severity === "warning").map((i) => i.code)).toEqual([
      "INVALID_PRICE",
    ]);
    expect(snap.issues.every((i) => i.worksheet && i.row !== undefined)).toBe(true);
  });
});

describe("toPublicCatalogue", () => {
  it("exposes only active products, categories and brands", async () => {
    const sheets = baseSheets();
    sheets.Categories[2][6] = false; // category 2 inactive
    sheets.Products.push(productRow({ product_id: "off", slug: "off", is_active: false }));
    const pub = toPublicCatalogue(await fetchFrom(new FakeSheets(sheets)));
    expect(pub.products.map((p) => p.id)).toEqual(["prod_1"]);
    expect(pub.categories.map((c) => c.id)).toEqual(["cat_1"]);
    expect(pub.brands).toHaveLength(2);
  });
});

describe("cache policy", () => {
  it("documents explicit durations: 60 s stale / 300 s revalidate / 1800 s max staleness", () => {
    expect(SHEETS_CACHE_LIFE).toEqual({ stale: 60, revalidate: 300, expire: 1800 });
    expect(SHEETS_CACHE_TAG).toBe("sheets");
  });

  it("the cached function uses the shared remote cache (not process memory) and the same literal policy", () => {
    const src = readFileSync(join(process.cwd(), "src/features/catalogue/cache.ts"), "utf8");
    expect(src).toContain('"use cache: remote"');
    expect(src).toMatch(/cacheLife\(\{ stale: 60, revalidate: 300, expire: 1800 \}\)/);
    expect(src).toContain("cacheTag(SHEETS_CACHE_TAG)");
  });
});
