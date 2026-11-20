// @vitest-environment node
import type { ViewCatalogue } from "@/features/catalogue/view";
import { buildItemSnapshots } from "./snapshots";

const catalogue: ViewCatalogue = {
  categories: [],
  brands: [{ id: "b1", slug: "b1", name: "Brand One", logoUrl: null }],
  products: [
    {
      id: "a",
      slug: "a",
      name: "Alpha",
      sku: "A-1",
      categoryId: "c",
      brandId: "b1",
      description: "",
      specifications: [],
      imageUrl: null,
      price: 99.5,
      unit: { code: "KG" },
      stockStatus: "LIMITED_STOCK",
      isFeatured: false,
      updatedAt: null,
    },
    {
      id: "b",
      slug: "b",
      name: "Beta",
      sku: null,
      categoryId: "c",
      brandId: "missing-brand",
      description: "",
      specifications: [],
      imageUrl: null,
      price: null,
      unit: { code: "CUSTOM", customLabel: "Roll" },
      stockStatus: "AVAILABLE_ON_ORDER",
      isFeatured: false,
      updatedAt: null,
    },
    {
      id: "z",
      slug: "z",
      name: "Zero",
      sku: null,
      categoryId: "c",
      brandId: "b1",
      description: "",
      specifications: [],
      imageUrl: null,
      price: 0,
      unit: { code: "TON" },
      stockStatus: "IN_STOCK",
      isFeatured: false,
      updatedAt: null,
    },
  ],
};

describe("buildItemSnapshots", () => {
  it("snapshots authoritative product facts in the requested order", () => {
    const r = buildItemSnapshots(
      [
        { productId: "b", quantity: 2 },
        { productId: "a", quantity: 1.25 },
      ],
      catalogue,
    );
    expect(r).toEqual({
      ok: true,
      snapshots: [
        {
          product_id: "b",
          sku: null,
          product_name: "Beta",
          brand_name: null,
          unit_code: "CUSTOM",
          unit_label: "Roll",
          quantity: 2,
          listed_price: null,
          stock_status: "AVAILABLE_ON_ORDER",
        },
        {
          product_id: "a",
          sku: "A-1",
          product_name: "Alpha",
          brand_name: "Brand One",
          unit_code: "KG",
          unit_label: "Kg",
          quantity: 1.25,
          listed_price: 99.5,
          stock_status: "LIMITED_STOCK",
        },
      ],
    });
  });

  it("never turns a missing or zero price into 0 (and never rounds a price)", () => {
    const r = buildItemSnapshots(
      [
        { productId: "z", quantity: 1 },
        { productId: "b", quantity: 1 },
      ],
      catalogue,
    );
    expect(r.ok && r.snapshots.map((s) => s.listed_price)).toEqual([null, null]);
  });

  it("reports every unknown id and returns no partial snapshots", () => {
    expect(
      buildItemSnapshots(
        [
          { productId: "a", quantity: 1 },
          { productId: "x", quantity: 1 },
          { productId: "y", quantity: 1 },
        ],
        catalogue,
      ),
    ).toEqual({ ok: false, invalidProductIds: ["x", "y"] });
  });

  it("normalises quantity to 3 decimal places", () => {
    const r = buildItemSnapshots([{ productId: "a", quantity: 1.0004 }], catalogue);
    expect(r.ok && r.snapshots[0].quantity).toBe(1);
  });
});
