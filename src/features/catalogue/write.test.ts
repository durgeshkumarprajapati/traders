// @vitest-environment node
import { ZodError } from "zod";
import {
  SheetsConflictError,
  SheetsNotFoundError,
  SheetsStructureError,
} from "@/lib/google-sheets/errors";
import {
  FakeSheets,
  PRODUCT_HEADERS,
  baseSheets,
  brandRow,
  categoryRow,
  historySheet,
  productRow,
  testConfig,
} from "@/lib/google-sheets/test-utils";
import {
  createBrand,
  createCategory,
  createProduct,
  setBusinessSetting,
  updateBrand,
  updateCategory,
  updateProduct,
  type ProductInput,
  type WriteDeps,
} from "./write";
import { SheetsValidationError } from "./write-errors";

const NOW = new Date("2026-11-18T12:00:00.000Z");
const config = testConfig("unused-in-these-tests");

function setup(sheets = baseSheets(), over: Partial<WriteDeps> = {}) {
  const fake = new FakeSheets(sheets);
  let n = 0;
  const invalidate = vi.fn(() => true);
  const deps: Partial<WriteDeps> = {
    client: fake,
    config,
    now: () => NOW,
    newId: (p) => `${p}_id${++n}`,
    invalidate,
    ...over,
  };
  return { fake, deps, invalidate };
}

const product = (over: Partial<ProductInput> = {}): ProductInput => ({
  name: "New Product",
  slug: "new-product",
  categoryId: "cat_1",
  brandId: "brand_1",
  unit: { code: "BAG" },
  stockStatus: "IN_STOCK",
  isFeatured: false,
  isActive: true,
  ...over,
});

async function expectIssue(p: Promise<unknown>, column: string, code: string) {
  const err = (await p.catch((e: unknown) => e)) as SheetsValidationError;
  expect(err).toBeInstanceOf(SheetsValidationError);
  expect(err.issues.map((i) => `${i.column}:${i.code}`)).toContain(`${column}:${code}`);
  expect(err.publicMessage).toBe("Some values are not valid. Please correct them and try again.");
}

describe("createProduct", () => {
  it("appends a validated row with a generated stable id, timestamps and typed cells, then invalidates the cache", async () => {
    const { fake, deps, invalidate } = setup();
    const created = await createProduct(
      product({
        sku: "NEW-1",
        price: 250.5,
        description: "d",
        specifications: [{ label: "Grade", value: "43" }],
        unit: { code: "CUSTOM", customLabel: "Set" },
        isFeatured: true,
      }),
      deps,
    );
    expect(created).toMatchObject({
      id: "prod_id1",
      slug: "new-product",
      sku: "NEW-1",
      price: 250.5,
      unit: { code: "CUSTOM", customLabel: "Set" },
      isFeatured: true,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });
    expect(fake.calls).toEqual(["read", "append:Products"]);
    expect(fake.row("Products", 3)).toMatchObject({
      product_id: "prod_id1",
      product_name: "New Product",
      sku: "NEW-1",
      price: 250.5,
      unit: "CUSTOM",
      unit_custom: "Set",
      stock_status: "IN_STOCK",
      is_featured: true,
      is_active: true,
      specifications: '[{"label":"Grade","value":"43"}]',
      created_at: NOW.toISOString(),
      updated_at: NOW.toISOString(),
    });
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it("a missing price is stored blank (Rate on request), never 0", async () => {
    const { fake, deps } = setup();
    await createProduct(product({ price: null }), deps);
    expect(fake.row("Products", 3).price).toBe("");
    await createProduct(product({ slug: "second" }), deps);
    expect(fake.row("Products", 4).price).toBe("");
  });

  it("never reuses an existing id", async () => {
    const ids = ["prod_1", "PROD_1", "prod_fresh"];
    const { fake, deps } = setup(baseSheets(), { newId: () => ids.shift()! });
    const p = await createProduct(product(), deps);
    expect(p.id).toBe("prod_fresh");
    expect(fake.row("Products", 3).product_id).toBe("prod_fresh");
  });

  it.each([
    ["unknown category", { categoryId: "nope" }, "category_id", "UNKNOWN_CATEGORY"],
    ["unknown brand", { brandId: "nope" }, "brand_id", "UNKNOWN_BRAND"],
    ["duplicate slug", { slug: "sample-product-1" }, "slug", "DUPLICATE_SLUG"],
    ["invalid image host", { imageUrl: "https://evil.example/a.jpg" }, "image_url", "INVALID_URL"],
    [
      "CUSTOM without label",
      { unit: { code: "CUSTOM" as const } },
      "unit_custom",
      "MISSING_REQUIRED",
    ],
    [
      "label on a non-custom unit",
      { unit: { code: "BAG" as const, customLabel: "Set" } },
      null,
      null,
    ],
  ])("rejects %s before touching the sheet", async (_n, over, column, code) => {
    const { fake, deps, invalidate } = setup();
    const p = createProduct(product(over as Partial<ProductInput>), deps);
    if (column && code) await expectIssue(p, column, code);
    else await expect(p).resolves.toMatchObject({ unit: { code: "BAG" } }); // label ignored for non-custom units in input mapping
    if (column) {
      expect(fake.calls).toEqual(["read"]); // no append
      expect(invalidate).not.toHaveBeenCalled();
    }
  });

  it("rejects a duplicate SKU", async () => {
    const sheets = baseSheets();
    sheets.Products[1][PRODUCT_HEADERS.indexOf("sku")] = "ABC-1";
    await expectIssue(
      createProduct(product({ sku: "abc-1" }), setup(sheets).deps),
      "sku",
      "DUPLICATE_SKU",
    );
  });

  it("rejects an active product in an inactive category", async () => {
    const sheets = baseSheets();
    sheets.Categories[2][6] = false;
    await expectIssue(
      createProduct(product({ categoryId: "cat_2" }), setup(sheets).deps),
      "category_id",
      "INACTIVE_CATEGORY",
    );
    // …but an inactive product may be created there
    await expect(
      createProduct(product({ categoryId: "cat_2", isActive: false }), setup(sheets).deps),
    ).resolves.toBeTruthy();
  });

  it("validates input shape (bad slug, negative or zero price, bad enum) with Zod before anything else", async () => {
    const { fake, deps } = setup();
    for (const bad of [
      { slug: "Bad Slug" },
      { price: -1 },
      { price: 0 },
      { stockStatus: "PLENTY" },
      { unit: { code: "50 kg Bag" } },
      { name: "" },
    ]) {
      await expect(
        createProduct(product(bad as unknown as Partial<ProductInput>), deps),
      ).rejects.toBeInstanceOf(ZodError);
    }
    expect(fake.calls).toEqual([]); // not even a read
  });

  it("stores formula-looking text as plain text (the client writes with RAW input)", async () => {
    const { fake, deps } = setup();
    await createProduct(product({ name: '=HYPERLINK("http://x")', slug: "formula" }), deps);
    expect(fake.row("Products", 3).product_name).toBe('=HYPERLINK("http://x")');
  });

  it("refuses to write a custom unit when the optional unit_custom column does not exist", async () => {
    const sheets = baseSheets();
    const idx = PRODUCT_HEADERS.indexOf("unit_custom");
    sheets.Products = sheets.Products.map((r) => r.filter((_, i) => i !== idx));
    const { fake, deps } = setup(sheets);
    await expect(
      createProduct(product({ unit: { code: "CUSTOM", customLabel: "Set" } }), deps),
    ).rejects.toBeInstanceOf(SheetsStructureError);
    expect(fake.calls).toEqual(["read"]);
    await expect(createProduct(product(), deps)).resolves.toBeTruthy(); // non-custom units still work
  });

  it("does not report success when the append fails", async () => {
    const { fake, deps, invalidate } = setup();
    fake.failOn.append = new Error("append failed");
    await expect(createProduct(product(), deps)).rejects.toThrow("append failed");
    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe("updateProduct", () => {
  it("writes ONLY the changed cells (+updated_at) and preserves everything else", async () => {
    const { fake, deps, invalidate } = setup();
    const before = [...fake.sheets.Products[1]];
    const spy = vi.spyOn(fake, "updateCells");
    const { product: p } = await updateProduct(
      "prod_1",
      { price: 399, stockStatus: "LIMITED_STOCK" },
      {},
      deps,
    );
    expect(p).toMatchObject({
      price: 399,
      stockStatus: "LIMITED_STOCK",
      updatedAt: NOW.toISOString(),
    });
    const written = spy.mock.calls[0][1].map((u) => PRODUCT_HEADERS[u.columnIndex]).sort();
    expect(written).toEqual(["price", "stock_status", "updated_at"]);
    const after = fake.sheets.Products[1];
    after.forEach((v, i) => {
      if (!["price", "stock_status", "updated_at"].includes(PRODUCT_HEADERS[i]))
        expect(v).toBe(before[i]);
    });
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it("clears a price to blank when set to null", async () => {
    const { fake, deps } = setup();
    await updateProduct("prod_1", { price: null }, {}, deps);
    expect(fake.row("Products", 2).price).toBe("");
  });

  it("is a no-op (no write, no invalidation) when nothing changes", async () => {
    const { fake, deps, invalidate } = setup();
    await updateProduct("prod_1", { price: 100, name: "Sample Product 1" }, {}, deps);
    expect(fake.calls).toEqual(["read"]);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("locates the row by stable id after rows move (never by remembered row number)", async () => {
    const sheets = baseSheets();
    sheets.Products.splice(1, 0, productRow({ product_id: "prod_0", slug: "zero" })); // prod_1 is now on row 3
    const { fake, deps } = setup(sheets);
    await updateProduct("PROD_1", { price: 123 }, {}, deps);
    expect(fake.row("Products", 3)).toMatchObject({ product_id: "prod_1", price: 123 });
    expect(fake.row("Products", 2).price).toBe(100);
  });

  it("preserves unknown columns and cells the patch does not touch", async () => {
    const sheets = baseSheets();
    sheets.Products[0] = [...sheets.Products[0], "internal_note"];
    sheets.Products[1] = [...sheets.Products[1], "keep me"];
    const { fake, deps } = setup(sheets);
    await updateProduct("prod_1", { price: 5 }, {}, deps);
    expect(fake.sheets.Products[1].at(-1)).toBe("keep me");
  });

  it("returns not-found for unknown ids and conflict for duplicate ids", async () => {
    await expect(updateProduct("nope", { price: 1 }, {}, setup().deps)).rejects.toBeInstanceOf(
      SheetsNotFoundError,
    );
    const sheets = baseSheets();
    sheets.Products.push(productRow({ slug: "dupe" }));
    await expect(
      updateProduct("prod_1", { price: 1 }, {}, setup(sheets).deps),
    ).rejects.toBeInstanceOf(SheetsConflictError);
  });

  it("detects concurrent modification via expectedUpdatedAt", async () => {
    const { fake, deps } = setup();
    await expect(
      updateProduct("prod_1", { price: 1 }, { expectedUpdatedAt: "2026-02-02T00:00:00Z" }, deps),
    ).rejects.toBeInstanceOf(SheetsConflictError);
    expect(fake.calls).toEqual(["read"]);
    await expect(
      updateProduct("prod_1", { price: 1 }, { expectedUpdatedAt: "2026-01-01T00:00:00Z" }, deps),
    ).resolves.toBeTruthy();
  });

  it("rejects values that would make the row invalid, with row/column context", async () => {
    const { fake, deps } = setup();
    await expectIssue(
      updateProduct("prod_1", { categoryId: "nope" }, {}, deps),
      "category_id",
      "UNKNOWN_CATEGORY",
    );
    await expectIssue(
      updateProduct("prod_1", { imageUrl: "http://res.cloudinary.com/a.jpg" }, {}, deps),
      "image_url",
      "INVALID_URL",
    );
    await expectIssue(
      updateProduct("prod_1", { unit: { code: "CUSTOM" } }, {}, deps),
      "unit_custom",
      "MISSING_REQUIRED",
    );
    expect(fake.calls.filter((c) => c === "update")).toHaveLength(0);
  });

  it("rejects a slug that collides with another product", async () => {
    const sheets = baseSheets();
    sheets.Products.push(productRow({ product_id: "prod_2", slug: "other" }));
    await expectIssue(
      updateProduct("prod_2", { slug: "sample-product-1" }, {}, setup(sheets).deps),
      "slug",
      "DUPLICATE_SLUG",
    );
  });

  it("warnings in columns the patch does not touch do not block the update", async () => {
    const sheets = baseSheets();
    sheets.Products[1][PRODUCT_HEADERS.indexOf("image_url")] = "http://legacy.example/bad.jpg"; // existing warning
    await expect(
      updateProduct("prod_1", { price: 77 }, {}, setup(sheets).deps),
    ).resolves.toBeTruthy();
  });

  it("does not report success when the update fails", async () => {
    const { fake, deps, invalidate } = setup();
    fake.failOn.update = new Error("update failed");
    await expect(updateProduct("prod_1", { price: 1 }, {}, deps)).rejects.toThrow("update failed");
    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe("price history (optional)", () => {
  const withHistory = () => {
    const sheets = { ...baseSheets(), PriceHistory: historySheet() };
    return setup(sheets, { config: testConfig("k", { priceHistoryEnabled: true }) });
  };
  it("records previous and new price with who/when", async () => {
    const { fake, deps } = withHistory();
    const r = await updateProduct("prod_1", { price: 120 }, { updatedBy: "admin-1" }, deps);
    expect(r.priceHistoryRecorded).toBe(true);
    expect(fake.sheets.PriceHistory[1]).toEqual([
      "ph_id1",
      "prod_1",
      100,
      120,
      NOW.toISOString(),
      "admin-1",
    ]);
  });
  it("requires updated_by before writing anything", async () => {
    const { fake, deps } = withHistory();
    await expectIssue(
      updateProduct("prod_1", { price: 120 }, {}, deps),
      "updated_by",
      "MISSING_REQUIRED",
    );
    expect(fake.calls.filter((c) => c === "update" || c.startsWith("append"))).toEqual([]);
  });
  it("does not record when the price is unchanged or untouched", async () => {
    const { fake, deps } = withHistory();
    expect(
      (await updateProduct("prod_1", { price: 100 }, { updatedBy: "a" }, deps))
        .priceHistoryRecorded,
    ).toBeNull(); // price unchanged ⇒ nothing to record
    expect(fake.sheets.PriceHistory).toHaveLength(1);
    expect(
      (await updateProduct("prod_1", { stockStatus: "OUT_OF_STOCK" }, {}, deps))
        .priceHistoryRecorded,
    ).toBeNull();
  });
  it("a missing PriceHistory sheet aborts BEFORE the product is changed", async () => {
    const { fake, deps } = setup(baseSheets(), {
      config: testConfig("k", { priceHistoryEnabled: true }),
    });
    await expect(
      updateProduct("prod_1", { price: 120 }, { updatedBy: "a" }, deps),
    ).rejects.toBeInstanceOf(SheetsStructureError);
    expect(fake.row("Products", 2).price).toBe(100);
  });
  it("reports a history failure after a successful product update instead of hiding it", async () => {
    const { fake, deps } = withHistory();
    const append = fake.appendRow.bind(fake);
    fake.appendRow = async (ws, v) => {
      if (ws === "PriceHistory") throw new Error("history down");
      return append(ws, v);
    };
    const r = await updateProduct("prod_1", { price: 120 }, { updatedBy: "a" }, deps);
    expect(r.priceHistoryRecorded).toBe(false);
    expect(fake.row("Products", 2).price).toBe(120);
  });
  it("is off by default (no history sheet access)", async () => {
    const { fake, deps } = setup();
    expect(
      (await updateProduct("prod_1", { price: 120 }, {}, deps)).priceHistoryRecorded,
    ).toBeNull();
    expect(fake.calls).toEqual(["read", "update"]);
  });
});

describe("categories and brands", () => {
  it("creates and updates categories and brands with unique ids and slugs", async () => {
    const { fake, deps } = setup();
    const c = await createCategory(
      { name: "Cat 3", slug: "cat-3", displayOrder: 3, isActive: true },
      deps,
    );
    expect(c).toMatchObject({ id: "cat_id1", slug: "cat-3", displayOrder: 3 });
    await expectIssue(
      createCategory({ name: "Dup", slug: "cat-3", isActive: true }, deps),
      "slug",
      "DUPLICATE_SLUG",
    );
    const b = await createBrand({ name: "Brand 3", slug: "brand-3", isActive: true }, deps);
    expect(b.id).toMatch(/^brand_id\d+$/); // ids are unique; rejected attempts may consume counter values
    await updateCategory("cat_id1", { name: "Renamed", displayOrder: 9 }, deps);
    expect(fake.row("Categories", 4)).toMatchObject({ category_name: "Renamed", display_order: 9 });
    await updateBrand("brand_2", { isActive: false }, deps);
    expect(fake.row("Brands", 3).is_active).toBe(false);
  });

  it("blocks deactivating a category or brand that active products still use", async () => {
    const { fake, deps } = setup();
    await expectIssue(
      updateCategory("cat_1", { isActive: false }, deps),
      "category_id",
      "INACTIVE_CATEGORY",
    );
    await expectIssue(
      updateBrand("brand_1", { isActive: false }, deps),
      "brand_id",
      "INACTIVE_BRAND",
    );
    expect(fake.row("Categories", 2).is_active).toBe(true);
    // unused ones can be deactivated
    await expect(updateCategory("cat_2", { isActive: false }, deps)).resolves.toBeTruthy();
  });

  it("blocks a slug change that collides", async () => {
    await expectIssue(
      updateBrand("brand_2", { slug: "brand-1" }, setup().deps),
      "slug",
      "DUPLICATE_SLUG",
    );
  });
});

describe("setBusinessSetting", () => {
  it("updates an existing setting cell", async () => {
    const { fake, deps, invalidate } = setup();
    await setBusinessSetting("Business_Name", "New Name", deps);
    expect(fake.sheets.BusinessSettings[1][1]).toBe("New Name");
    expect(invalidate).toHaveBeenCalled();
  });
  it("appends a missing setting", async () => {
    const { fake, deps } = setup();
    await setBusinessSetting("phone", "+91 11111 22222", deps);
    expect(fake.sheets.BusinessSettings[2]).toEqual(["phone", "+91 11111 22222"]);
  });
  it("rejects unknown keys and invalid values without writing", async () => {
    const { fake, deps } = setup();
    for (const [k, v] of [
      ["mystery", "x"],
      ["email", "nope"],
      ["google_maps_url", "http://x.test"],
      ["gst_number", "1"],
    ]) {
      await expect(setBusinessSetting(k, v, deps)).rejects.toBeInstanceOf(SheetsValidationError);
    }
    expect(fake.calls).toEqual([]);
  });
  it("conflicts when the key is duplicated in the sheet", async () => {
    const sheets = baseSheets();
    sheets.BusinessSettings.push(["business_name", "Other"]);
    await expect(
      setBusinessSetting("business_name", "x", setup(sheets).deps),
    ).rejects.toBeInstanceOf(SheetsConflictError);
  });
});

// keep fixtures referenced
void [brandRow, categoryRow];
