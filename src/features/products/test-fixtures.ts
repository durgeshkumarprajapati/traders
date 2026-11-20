/**
 * TEST FIXTURES ONLY — never imported by application code (a test enforces this).
 * Generic, obviously fake values (no real brands, prices or timestamps) used to exercise the UI
 * components and the catalogue query logic. Real data comes from Google Sheets (Phase 4/5).
 */
import type { Brand, Category, Product } from "./types";

export const FIXTURE_CATEGORIES: Category[] = [
  {
    id: "cat-1",
    slug: "cement",
    name: "Cement",
    description: "Sample category",
    icon: "cement",
    displayOrder: 1,
    imageUrl: null,
  },
  {
    id: "cat-2",
    slug: "steel-tmt",
    name: "Steel & TMT",
    description: "Sample category",
    icon: "steel",
    displayOrder: 2,
    imageUrl: null,
  },
  {
    id: "cat-3",
    slug: "bricks-blocks",
    name: "Bricks & Blocks",
    description: "Sample category",
    icon: "bricks",
    displayOrder: 3,
    imageUrl: null,
  },
  {
    id: "cat-4",
    slug: "sand-aggregates",
    name: "Sand & Aggregates",
    description: "Sample category",
    icon: "sand",
    displayOrder: 4,
    imageUrl: null,
  },
  {
    id: "cat-5",
    slug: "hardware-plumbing",
    name: "Hardware & Plumbing",
    description: "Sample category",
    icon: "hardware",
    displayOrder: 5,
    imageUrl: null,
  },
];

export const FIXTURE_BRANDS: Brand[] = [
  { id: "brand-a", slug: "sample-brand-a", name: "Sample Brand A", logoUrl: null },
  { id: "brand-b", slug: "sample-brand-b", name: "Sample Brand B", logoUrl: null },
  { id: "brand-c", slug: "sample-brand-c", name: "Sample Brand C", logoUrl: null },
];

const spec = (n: number) => [
  { label: `Specification ${n}`, value: "Placeholder value" },
  { label: `Specification ${n + 1}`, value: "Placeholder value" },
];

function sample(
  n: number,
  name: string,
  categoryId: string,
  brandId: string,
  unit: Product["unit"],
  stockStatus: Product["stockStatus"],
  isFeatured = false,
  sku: string | null = null,
): Product {
  return {
    id: `prod-${n}`,
    slug: `sample-product-${n}`,
    name,
    sku,
    categoryId,
    brandId,
    description:
      "Placeholder description. Real product information will come from the product catalogue.",
    specifications: spec(n),
    imageUrl: null,
    price: null,
    unit,
    stockStatus,
    isFeatured,
    updatedAt: null,
  };
}

export const FIXTURE_PRODUCTS: Product[] = [
  sample(
    1,
    "Sample Cement Product 1",
    "cat-1",
    "brand-a",
    { code: "BAG" },
    "IN_STOCK",
    true,
    "SAMPLE-001",
  ),
  sample(2, "Sample Cement Product 2", "cat-1", "brand-b", { code: "BAG" }, "LIMITED_STOCK"),
  sample(3, "Sample TMT Product 1", "cat-2", "brand-a", { code: "METRIC_TON" }, "IN_STOCK", true),
  sample(
    4,
    "Sample TMT Product 2",
    "cat-2",
    "brand-c",
    { code: "TON" },
    "AVAILABLE_ON_ORDER",
    true,
  ),
  sample(5, "Sample Brick Product", "cat-3", "brand-b", { code: "PIECE" }, "IN_STOCK"),
  sample(6, "Sample Block Product", "cat-3", "brand-c", { code: "BLOCK" }, "OUT_OF_STOCK", true),
  sample(7, "Sample Sand Product", "cat-4", "brand-a", { code: "CUBIC_FEET" }, "IN_STOCK"),
  sample(8, "Sample Aggregate Product", "cat-4", "brand-b", { code: "BRASS" }, "LIMITED_STOCK"),
  sample(9, "Sample Pipe Product", "cat-5", "brand-c", { code: "METER" }, "AVAILABLE_ON_ORDER"),
  sample(
    10,
    "Sample Fitting Product",
    "cat-5",
    "brand-a",
    { code: "CUSTOM", customLabel: "Set" },
    "IN_STOCK",
    false,
    "SAMPLE-010",
  ),
];
