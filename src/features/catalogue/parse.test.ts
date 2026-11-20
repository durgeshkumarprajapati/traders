// @vitest-environment node
import { parseTable } from "@/lib/google-sheets/cells";
import { BRANDS, CATEGORIES, PRODUCTS, SETTINGS } from "@/lib/google-sheets/worksheets";
import {
  BRAND_HEADERS,
  CATEGORY_HEADERS,
  PRODUCT_HEADERS,
  baseSheets,
  brandRow,
  categoryRow,
  productRow,
} from "@/lib/google-sheets/test-utils";
import { buildCatalogue, parseSettingValue, type Tables } from "./parse";
import type { ValidationIssue } from "./types";

function tables(
  over: {
    products?: unknown[][];
    categories?: unknown[][];
    brands?: unknown[][];
    settings?: unknown[][];
  } = {},
): Tables {
  const b = baseSheets();
  return {
    products: parseTable([PRODUCT_HEADERS, ...(over.products ?? [productRow()])], PRODUCTS),
    categories: parseTable(
      [CATEGORY_HEADERS, ...(over.categories ?? b.Categories.slice(1))],
      CATEGORIES,
    ),
    brands: parseTable([BRAND_HEADERS, ...(over.brands ?? b.Brands.slice(1))], BRANDS),
    settings: parseTable([["setting_key", "setting_value"], ...(over.settings ?? [])], SETTINGS),
  };
}
const issue = (built: { issues: ValidationIssue[] }, column: string, row = 2) =>
  built.issues.find((i) => i.column === column && i.row === row);

describe("valid data", () => {
  it("maps a valid row to the typed contract", () => {
    const built = buildCatalogue(
      tables({
        products: [
          productRow({
            sku: "SKU-1",
            price: 385.5,
            specifications: '[{"label":"Grade","value":"43"}]',
            image_url: "https://res.cloudinary.com/x/a.jpg",
            is_featured: "TRUE",
          }),
        ],
      }),
    );
    expect(built.issues).toEqual([]);
    expect(built.products[0]).toEqual({
      id: "prod_1",
      slug: "sample-product-1",
      name: "Sample Product 1",
      sku: "SKU-1",
      categoryId: "cat_1",
      brandId: "brand_1",
      description: "Test description",
      specifications: [{ label: "Grade", value: "43" }],
      imageUrl: "https://res.cloudinary.com/x/a.jpg",
      price: 385.5,
      unit: { code: "BAG" },
      stockStatus: "IN_STOCK",
      isFeatured: true,
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(built.stats.products).toEqual({ rows: 1, valid: 1 });
  });
  it("accepts numeric ids, checkbox booleans and Sheets serial dates", () => {
    const built = buildCatalogue(
      tables({
        products: [
          productRow({ product_id: 1001, is_active: true, created_at: 46344, updated_at: 46344.5 }),
        ],
      }),
    );
    expect(built.issues).toEqual([]);
    expect(built.products[0].id).toBe("1001");
    expect(built.products[0].createdAt).toBe("2026-11-18T00:00:00.000Z");
    expect(built.products[0].updatedAt).toBe("2026-11-18T12:00:00.000Z");
  });
  it("sorts categories by display_order (unspecified last), then name", () => {
    const built = buildCatalogue(
      tables({
        categories: [
          categoryRow({ category_id: "c3", slug: "c3", category_name: "Zed", display_order: "" }),
          categoryRow({ category_id: "c2", slug: "c2", category_name: "B", display_order: 2 }),
          categoryRow({ category_id: "c1", slug: "c1", category_name: "A", display_order: 1 }),
        ],
        products: [],
      }),
    );
    expect(built.categories.map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
    expect(built.categories[2].displayOrder).toBeNull();
  });
});

describe("empty vs invalid", () => {
  it("header-only worksheets yield empty arrays and no issues", () => {
    const built = buildCatalogue(tables({ products: [], categories: [], brands: [] }));
    expect(built).toMatchObject({ products: [], categories: [], brands: [], issues: [] });
  });
});

describe("hard errors exclude only the bad row and report worksheet/row/column", () => {
  it.each([
    ["product_id", { product_id: "" }, "MISSING_REQUIRED"],
    ["product_name", { product_name: "  " }, "MISSING_REQUIRED"],
    ["slug", { slug: "Bad Slug!" }, "INVALID_FORMAT"],
    ["slug", { slug: "" }, "MISSING_REQUIRED"],
    ["category_id", { category_id: "" }, "MISSING_REQUIRED"],
    ["unit", { unit: "50 kg Bag" }, "INVALID_UNIT"], // pack description is not a unit
    ["unit", { unit: "3m Length" }, "INVALID_UNIT"], // product size is not a unit
    ["unit", { unit: "" }, "MISSING_REQUIRED"],
    ["stock_status", { stock_status: "PLENTY" }, "INVALID_ENUM"],
    ["is_active", { is_active: "maybe" }, "INVALID_BOOLEAN"],
    ["is_featured", { is_featured: "" }, "MISSING_REQUIRED"],
    ["sku", { sku: "bad sku!" }, "INVALID_FORMAT"],
  ])("%s: %j → %s", (column, over, code) => {
    const built = buildCatalogue(
      tables({
        products: [productRow(), productRow({ product_id: "prod_2", slug: "two", ...over })],
      }),
    );
    const i = issue(built, column, 3)!;
    expect(i).toMatchObject({ worksheet: "Products", row: 3, severity: "error", code });
    expect(built.products.map((p) => p.id)).toEqual(["prod_1"]); // the good row survives
    expect(built.stats.products).toEqual({ rows: 2, valid: 1 });
  });

  it("never echoes huge values and quotes only a short excerpt", () => {
    const built = buildCatalogue(tables({ products: [productRow({ unit: "X".repeat(500) })] }));
    expect(issue(built, "unit")!.message.length).toBeLessThan(250);
  });

  it("units are never silently converted: TON and METRIC_TON are both accepted but stay distinct", () => {
    const built = buildCatalogue(
      tables({
        products: [
          productRow({ unit: "ton" }),
          productRow({ product_id: "p2", slug: "p2", unit: "METRIC_TON" }),
        ],
      }),
    );
    expect(built.products.map((p) => p.unit.code)).toEqual(["TON", "METRIC_TON"]);
  });

  it("CUSTOM requires a display label; other units must not carry one", () => {
    const built = buildCatalogue(
      tables({
        products: [
          productRow({ product_id: "a", slug: "a", unit: "CUSTOM", unit_custom: "" }),
          productRow({ product_id: "b", slug: "b", unit: "CUSTOM", unit_custom: " Set " }),
          productRow({ product_id: "c", slug: "c", unit: "BAG", unit_custom: "Set" }),
        ],
      }),
    );
    expect(issue(built, "unit_custom", 2)).toMatchObject({
      code: "MISSING_REQUIRED",
      severity: "error",
    });
    expect(issue(built, "unit_custom", 4)).toMatchObject({
      code: "INVALID_UNIT",
      severity: "error",
    });
    expect(built.products).toHaveLength(1);
    expect(built.products[0].unit).toEqual({ code: "CUSTOM", customLabel: "Set" });
  });

  it("accepts all four stock statuses", () => {
    const rows = ["IN_STOCK", "LIMITED_STOCK", "OUT_OF_STOCK", "AVAILABLE_ON_ORDER"].map((s, i) =>
      productRow({ product_id: `p${i}`, slug: `p${i}`, stock_status: s }),
    );
    expect(buildCatalogue(tables({ products: rows })).products.map((p) => p.stockStatus)).toEqual([
      "IN_STOCK",
      "LIMITED_STOCK",
      "OUT_OF_STOCK",
      "AVAILABLE_ON_ORDER",
    ]);
  });
});

describe("soft fields: dropped and reported, never invented", () => {
  it.each([["blank", ""]])(
    "price %s is valid and null (Rate on request) with no issue",
    (_n, price) => {
      const built = buildCatalogue(tables({ products: [productRow({ price })] }));
      expect(built.products[0].price).toBeNull();
      expect(built.issues).toEqual([]);
    },
  );
  it.each([["abc"], ["₹385"], ["1,234"], ["385/-"], [0], [-5], ["0"], [1e12]])(
    "invalid price %j → null + warning (never 0)",
    (price) => {
      const built = buildCatalogue(tables({ products: [productRow({ price })] }));
      expect(built.products[0].price).toBeNull();
      expect(built.products[0].price).not.toBe(0);
      expect(issue(built, "price")).toMatchObject({ severity: "warning", code: "INVALID_PRICE" });
      expect(built.products).toHaveLength(1); // product is kept
    },
  );
  it("malformed dates → null + warning", () => {
    const built = buildCatalogue(
      tables({ products: [productRow({ created_at: "18/11/2026", updated_at: "garbage" })] }),
    );
    expect(built.products[0]).toMatchObject({ createdAt: null, updatedAt: null });
    expect(issue(built, "created_at")?.code).toBe("INVALID_DATE");
    expect(issue(built, "updated_at")?.code).toBe("INVALID_DATE");
  });
  it("invalid image URLs (http, other host, junk) → null + warning", () => {
    for (const url of [
      "http://res.cloudinary.com/a.jpg",
      "https://evil.example/a.jpg",
      "javascript:alert(1)",
      "not a url",
    ]) {
      const built = buildCatalogue(tables({ products: [productRow({ image_url: url })] }));
      expect(built.products[0].imageUrl).toBeNull();
      expect(issue(built, "image_url")).toMatchObject({ severity: "warning", code: "INVALID_URL" });
    }
  });
  it("malformed specifications JSON → [] + warning", () => {
    for (const s of ["not json", '{"a":1}', '[{"label":"","value":"x"}]']) {
      const built = buildCatalogue(tables({ products: [productRow({ specifications: s })] }));
      expect(built.products[0].specifications).toEqual([]);
      expect(issue(built, "specifications")?.code).toBe("INVALID_JSON");
    }
  });
  it("invalid category display_order → null + warning", () => {
    const built = buildCatalogue(
      tables({ categories: [categoryRow({ display_order: "first" })], products: [] }),
    );
    expect(built.categories[0].displayOrder).toBeNull();
    expect(built.issues[0]).toMatchObject({
      worksheet: "Categories",
      column: "display_order",
      severity: "warning",
      code: "INVALID_NUMBER",
    });
  });
});

describe("duplicates: every row in the group is excluded and reported", () => {
  it("duplicate product ids", () => {
    const built = buildCatalogue(
      tables({ products: [productRow(), productRow({ slug: "other" })] }),
    );
    expect(built.products).toEqual([]);
    expect(built.issues.filter((i) => i.code === "DUPLICATE_ID").map((i) => i.row)).toEqual([2, 3]);
    expect(built.issues[0].message).toMatch(/rows 2, 3/);
  });
  it("duplicate slugs (case-insensitive) and SKUs", () => {
    const slugs = buildCatalogue(
      tables({
        products: [
          productRow({ slug: "same" }),
          productRow({ product_id: "p2", slug: "SAME".toLowerCase() }),
          productRow({ product_id: "p3", slug: "unique" }),
        ],
      }),
    );
    expect(slugs.products.map((p) => p.id)).toEqual(["p3"]);
    expect(slugs.issues.filter((i) => i.code === "DUPLICATE_SLUG")).toHaveLength(2);
    const skus = buildCatalogue(
      tables({
        products: [
          productRow({ sku: "ab-1" }),
          productRow({ product_id: "p2", slug: "p2", sku: "AB-1" }),
          productRow({ product_id: "p3", slug: "p3", sku: "" }),
          productRow({ product_id: "p4", slug: "p4", sku: "" }),
        ],
      }),
    );
    expect(skus.products.map((p) => p.id)).toEqual(["p3", "p4"]); // blank SKUs never collide
    expect(skus.issues.filter((i) => i.code === "DUPLICATE_SKU")).toHaveLength(2);
  });
  it("duplicate category/brand ids and slugs", () => {
    const built = buildCatalogue(
      tables({
        categories: [categoryRow(), categoryRow({ slug: "x" })],
        brands: [brandRow(), brandRow({ brand_id: "b2" })],
        products: [],
      }),
    );
    expect(built.categories).toEqual([]);
    expect(built.brands).toEqual([]);
    expect(built.issues.map((i) => `${i.worksheet}:${i.code}`).sort()).toEqual([
      "Brands:DUPLICATE_SLUG",
      "Brands:DUPLICATE_SLUG",
      "Categories:DUPLICATE_ID",
      "Categories:DUPLICATE_ID",
    ]);
  });
});

describe("references", () => {
  it("unknown category/brand references exclude the product", () => {
    const built = buildCatalogue(
      tables({
        products: [
          productRow({ category_id: "nope" }),
          productRow({ product_id: "p2", slug: "p2", brand_id: "nope" }),
          productRow({ product_id: "p3", slug: "p3" }),
        ],
      }),
    );
    expect(built.products.map((p) => p.id)).toEqual(["p3"]);
    expect(issue(built, "category_id", 2)).toMatchObject({
      code: "UNKNOWN_CATEGORY",
      severity: "error",
    });
    expect(issue(built, "brand_id", 3)).toMatchObject({ code: "UNKNOWN_BRAND", severity: "error" });
  });
  it("a reference to an excluded (invalid or duplicated) category is also unknown", () => {
    const built = buildCatalogue(tables({ categories: [categoryRow({ slug: "BAD SLUG" })] }));
    expect(issue(built, "category_id")?.code).toBe("UNKNOWN_CATEGORY");
  });
  it("active product → inactive category/brand is an error; inactive product is fine", () => {
    const cats = [categoryRow({ is_active: false })];
    const brands = [brandRow({ is_active: false })];
    const active = buildCatalogue(tables({ categories: cats, brands, products: [productRow()] }));
    expect(active.products).toEqual([]);
    expect(active.issues.map((i) => i.code).sort()).toEqual([
      "INACTIVE_BRAND",
      "INACTIVE_CATEGORY",
    ]);
    const inactive = buildCatalogue(
      tables({ categories: cats, brands, products: [productRow({ is_active: false })] }),
    );
    expect(inactive.products).toHaveLength(1);
    expect(inactive.issues).toEqual([]);
  });
  it("matches ids case-insensitively and canonicalises them", () => {
    const built = buildCatalogue(
      tables({ products: [productRow({ category_id: "CAT_1", brand_id: "BRAND_1" })] }),
    );
    expect(built.products[0]).toMatchObject({ categoryId: "cat_1", brandId: "brand_1" });
  });
});

describe("business settings", () => {
  const settings = (rows: unknown[][]) => buildCatalogue(tables({ settings: rows }));
  it("maps known settings, normalising WhatsApp digits and GSTIN case", () => {
    const b = settings([
      ["business_name", "Test Business"],
      ["phone", "+91 11111 22222"],
      ["whatsapp_number", "+91 98765-43210"],
      ["email", "a@example.test"],
      ["gst_number", "27aabcu9603r1zm"],
      ["google_maps_url", "https://maps.example.test/x"],
      ["social_instagram", "https://example.test/ig"],
      ["announcement_enabled", "TRUE"],
      ["announcement_text", "Closed on holiday"],
    ]);
    expect(b.issues).toEqual([]);
    expect(b.settings).toMatchObject({
      businessName: "Test Business",
      phone: "+91 11111 22222",
      whatsappNumber: "919876543210",
      email: "a@example.test",
      gstNumber: "27AABCU9603R1ZM",
      googleMapsUrl: "https://maps.example.test/x",
      social: { instagram: "https://example.test/ig" },
      announcement: { enabled: true, text: "Closed on holiday" },
    });
  });
  it("leaves everything null when nothing is configured (no invented business data)", () => {
    expect(settings([]).settings).toEqual({
      businessName: null,
      tagline: null,
      logoUrl: null,
      phone: null,
      whatsappNumber: null,
      email: null,
      address: null,
      businessHours: null,
      gstNumber: null,
      googleMapsUrl: null,
      deliveryCoverage: null,
      social: {},
      announcement: { enabled: false, text: null },
      whyChooseUs: [],
    });
  });
  it("reads structured 'Why choose us' items: only complete title+description pairs, in order, max 6", () => {
    const b = settings([
      ["why_choose_us_2_title", "Second"],
      ["why_choose_us_2_description", "Second description"],
      ["why_choose_us_1_title", "First"],
      ["why_choose_us_1_description", "First description"],
      ["why_choose_us_3_title", "Only a title"],
      ["why_choose_us_4_description", "Only a description"],
      ["why_choose_us_7_title", "Out of range"],
      ["why_choose_us_5_title", "T".repeat(81)],
      ["why_choose_us_5_description", "ok"],
    ]);
    expect(b.settings.whyChooseUs).toEqual([
      { title: "First", description: "First description" },
      { title: "Second", description: "Second description" },
    ]);
    const issues = b.issues.map((i) => `${i.row}:${i.code}`);
    expect(issues).toContain("6:INVALID_SETTING"); // item 3 half-filled (row of its title)
    expect(issues).toContain("7:INVALID_SETTING"); // item 4 half-filled (row of its description)
    expect(issues).toContain("8:UNKNOWN_SETTING"); // index 7 is outside 1–6
    expect(issues).toContain("9:INVALID_SETTING"); // title longer than 80 characters
    expect(parseSettingValue("why_choose_us_1_title", "x").ok).toBe(true);
    expect(parseSettingValue("why_choose_us_1_description", "x".repeat(301)).ok).toBe(false);
  });
  it("ignores and reports invalid, unknown and duplicate settings", () => {
    const b = settings([
      ["email", "nope"],
      ["phone", "abc"],
      ["gst_number", "123"],
      ["whatsapp_number", "12"],
      ["google_maps_url", "http://x.test"],
      ["mystery", "1"],
      ["tagline", "a"],
      ["tagline", "b"],
      ["", "orphan"],
    ]);
    expect(b.settings.email).toBeNull();
    expect(b.settings.phone).toBeNull();
    expect(b.settings.gstNumber).toBeNull();
    expect(b.settings.whatsappNumber).toBeNull();
    expect(b.settings.googleMapsUrl).toBeNull();
    expect(b.settings.tagline).toBeNull();
    expect(new Set(b.issues.map((i) => i.code))).toEqual(
      new Set(["INVALID_SETTING", "UNKNOWN_SETTING", "DUPLICATE_SETTING", "MISSING_REQUIRED"]),
    );
  });
  it("only shows an announcement when enabled and non-empty", () => {
    expect(settings([["announcement_enabled", "TRUE"]]).settings.announcement).toEqual({
      enabled: false,
      text: null,
    });
    expect(
      settings([
        ["announcement_enabled", "FALSE"],
        ["announcement_text", "x"],
      ]).settings.announcement,
    ).toEqual({ enabled: false, text: null });
  });
  it("parseSettingValue validates individual values (used by writes)", () => {
    expect(parseSettingValue("email", "bad").ok).toBe(false);
    expect(parseSettingValue("social_x", "https://example.test").ok).toBe(true);
    expect(parseSettingValue("unknown", "v").ok).toBe(false);
  });
});

describe("issue ordering", () => {
  it("is stable: worksheet, then row, then column", () => {
    const built = buildCatalogue(
      tables({
        products: [
          productRow({ price: "x", image_url: "bad" }),
          productRow({ product_id: "p2", slug: "p2", unit: "bad" }),
        ],
        categories: [categoryRow({ display_order: "x" })],
      }),
    );
    expect(built.issues.map((i) => `${i.worksheet}:${i.row}:${i.column}`)).toEqual([
      "Products:2:image_url",
      "Products:2:price",
      "Products:3:unit",
      "Categories:2:display_order",
    ]);
  });
});
