/**
 * Test-only helper (never imported by application code): builds a realistic spreadsheet, pushes it
 * through the REAL Phase 4 pipeline (parse → validate → public view) and returns what the loaders return.
 * All values are obviously fake.
 */
import {
  BRAND_HEADERS,
  CATEGORY_HEADERS,
  FakeSheets,
  PRODUCT_HEADERS,
  brandRow,
  categoryRow,
  productRow,
} from "@/lib/google-sheets/test-utils";
import { fetchSheetsSnapshot } from "./snapshot";
import { toPublicCatalogue } from "./public";
import { toBusinessSettings, toViewCatalogue } from "./view";
import type { CatalogueLoad } from "./server";

export const CLOUD = "https://res.cloudinary.com/test-cloud/image/upload";

/** 17 valid active products across 3 pages, plus rows that must NOT reach the public site. */
export function realisticSheets(): Record<string, unknown[][]> {
  const products: unknown[][] = [
    productRow({
      product_id: "p1",
      product_name: "Cement PPC 50kg",
      slug: "cement-ppc-50kg",
      sku: "C-1",
      category_id: "cat_1",
      brand_id: "brand_1",
      price: 385,
      unit: "BAG",
      stock_status: "IN_STOCK",
      is_featured: true,
      updated_at: "2026-11-17T09:30:00Z",
      description: "Pack: 50 kg bag",
    }),
    productRow({
      product_id: "p2",
      product_name: "Cement OPC 53",
      slug: "cement-opc-53",
      category_id: "cat_1",
      brand_id: "brand_2",
      price: "",
      unit: "BAG",
      stock_status: "LIMITED_STOCK",
    }),
    productRow({
      product_id: "p3",
      product_name: "TMT 12mm",
      slug: "tmt-12mm",
      category_id: "cat_2",
      brand_id: "brand_1",
      price: 62500,
      unit: "METRIC_TON",
      stock_status: "AVAILABLE_ON_ORDER",
      is_featured: true,
      specifications: '[{"label":"Size","value":"12 mm"},{"label":"Length","value":"12 m"}]',
    }),
    productRow({
      product_id: "p4",
      product_name: "TMT 10mm",
      slug: "tmt-10mm",
      category_id: "cat_2",
      brand_id: "brand_2",
      price: "abc",
      unit: "TON",
      stock_status: "OUT_OF_STOCK",
    }),
    productRow({
      product_id: "p5",
      product_name: "Red Bricks",
      slug: "red-bricks",
      category_id: "cat_3",
      brand_id: "brand_2",
      price: 9.5,
      unit: "PIECE",
      stock_status: "IN_STOCK",
    }),
    productRow({
      product_id: "p6",
      product_name: "Pipe Set",
      slug: "pipe-set",
      category_id: "cat_3",
      brand_id: "brand_1",
      price: 120,
      unit: "CUSTOM",
      unit_custom: "Set",
      stock_status: "IN_STOCK",
      image_url: `${CLOUD}/pipe.jpg`,
      is_featured: true,
    }),
    productRow({
      product_id: "off",
      product_name: "Retired Item",
      slug: "retired-item",
      category_id: "cat_1",
      brand_id: "brand_1",
      is_active: false,
    }), // inactive
    productRow({
      product_id: "badcat",
      product_name: "In Inactive Category",
      slug: "in-inactive-category",
      category_id: "cat_4",
      brand_id: "brand_1",
    }), // → error
    productRow({
      product_id: "badbrand",
      product_name: "Inactive Brand Item",
      slug: "inactive-brand-item",
      category_id: "cat_1",
      brand_id: "brand_3",
    }), // → error
  ];
  for (let i = 10; i <= 20; i++) {
    products.push(
      productRow({
        product_id: `x${i}`,
        product_name: `Extra Cement ${i}`,
        slug: `extra-cement-${i}`,
        category_id: "cat_1",
        brand_id: "brand_1",
        price: i * 10,
        unit: "BAG",
      }),
    );
  }
  return {
    Products: [PRODUCT_HEADERS, ...products],
    Categories: [
      CATEGORY_HEADERS,
      categoryRow({
        category_id: "cat_1",
        category_name: "Cement",
        slug: "cement",
        display_order: 1,
      }),
      categoryRow({
        category_id: "cat_2",
        category_name: "Steel & TMT",
        slug: "steel-tmt",
        display_order: 2,
      }),
      categoryRow({
        category_id: "cat_3",
        category_name: "Bricks & Blocks",
        slug: "bricks-blocks",
        display_order: 3,
        image_url: `${CLOUD}/bricks.jpg`,
      }),
      categoryRow({
        category_id: "cat_4",
        category_name: "Hardware",
        slug: "hardware",
        display_order: 4,
        is_active: false,
      }),
    ],
    Brands: [
      BRAND_HEADERS,
      brandRow({
        brand_id: "brand_1",
        brand_name: "Brand One",
        slug: "brand-one",
        logo_url: `${CLOUD}/b1.png`,
      }),
      brandRow({ brand_id: "brand_2", brand_name: "Brand Two", slug: "brand-two" }),
      brandRow({
        brand_id: "brand_3",
        brand_name: "Brand Three",
        slug: "brand-three",
        is_active: false,
      }),
    ],
    BusinessSettings: [
      ["setting_key", "setting_value"],
      ["business_name", "Test Traders"],
      ["tagline", "Test tagline for materials"],
      ["phone", "+1 555 010 1111"],
      ["whatsapp_number", "+1 555 010 9999"],
      ["email", "hello@example.test"],
      ["address", "1 Test Street, Testville"],
      ["business_hours", "Mon–Sat 9–6"],
      ["google_maps_url", "https://maps.example.test/place"],
      ["social_instagram", "https://social.example.test/test"],
      ["announcement_enabled", "TRUE"],
      ["announcement_text", "Test announcement"],
      ["why_choose_us_1_title", "Test advantage one"],
      ["why_choose_us_1_description", "Owner-written description one."],
      ["why_choose_us_2_title", "Test advantage two"],
      ["why_choose_us_2_description", "Owner-written description two."],
      ["why_choose_us_3_title", "Half-filled item"],
    ],
  };
}

export const EMPTY_SHEETS = (): Record<string, unknown[][]> => ({
  Products: [PRODUCT_HEADERS],
  Categories: [CATEGORY_HEADERS],
  Brands: [BRAND_HEADERS],
  BusinessSettings: [["setting_key", "setting_value"]],
});

/** What `loadCatalogue()` returns for the given spreadsheet contents (real validation, real public filtering). */
export async function loadFrom(
  sheets: Record<string, unknown[][]>,
): Promise<Extract<CatalogueLoad, { ok: true }>> {
  const snap = await fetchSheetsSnapshot(
    new FakeSheets(sheets),
    () => new Date("2026-11-18T12:00:00Z"),
  );
  return {
    ok: true,
    catalogue: toViewCatalogue(toPublicCatalogue(snap)),
    settings: toBusinessSettings(snap.settings),
    fetchedAt: snap.fetchedAt,
  };
}
