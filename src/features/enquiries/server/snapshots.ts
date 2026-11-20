import { getStaticCatalogue } from "@/features/catalogue/data/static-catalogue";
import type { ViewCatalogue } from "@/features/catalogue/view";
import type { StockStatus } from "@/features/products/stock";
import { unitLabel, type UnitCode } from "@/features/products/units";

/** One enquiry item exactly as it is stored (snake_case = database payload). Built ONLY from the server-side catalogue. */
export type ItemSnapshot = {
  product_id: string;
  sku: string | null;
  product_name: string;
  brand_name: string | null;
  unit_code: UnitCode;
  unit_label: string;
  quantity: number;
  /** null = the product had no valid listed price. Never 0. */
  listed_price: number | null;
  stock_status: StockStatus;
  catalogue_source?: "LIVE" | "STATIC";
};

export type SnapshotResult =
  { ok: true; snapshots: ItemSnapshot[] } | { ok: false; invalidProductIds: string[] };

/**
 * Resolve requested items against the AUTHORITATIVE public catalogue (active products with active
 * categories/brands). Anything the browser claimed besides id + quantity is irrelevant: names, brands,
 * units, prices and availability all come from here.
 *
 * Implements fallback resolution:
 *  1. Checks the primary resolved catalogue first (live or active static).
 *  2. If an item is not found in the primary catalogue (e.g. selected while sheets were degraded),
 *     resolves against the static fallback catalogue.
 *  3. Unknown product ids in neither source reject the whole enquiry.
 */
export function buildItemSnapshots(
  items: { productId: string; quantity: number }[],
  catalogue: ViewCatalogue,
  staticFallback: ViewCatalogue = getStaticCatalogue(),
): SnapshotResult {
  const products = new Map(catalogue.products.map((p) => [p.id, p]));
  const brands = new Map(catalogue.brands.map((b) => [b.id, b.name]));
  const staticProducts = new Map(staticFallback.products.map((p) => [p.id, p]));
  const staticBrands = new Map(staticFallback.brands.map((b) => [b.id, b.name]));

  const invalid: string[] = [];
  const snapshots: ItemSnapshot[] = [];

  for (const item of items) {
    const p = products.get(item.productId);
    if (p) {
      snapshots.push({
        product_id: p.id,
        sku: p.sku,
        product_name: p.name,
        brand_name: brands.get(p.brandId) ?? null,
        unit_code: p.unit.code,
        unit_label: unitLabel(p.unit),
        quantity: Math.round(item.quantity * 1000) / 1000,
        listed_price:
          typeof p.price === "number" && Number.isFinite(p.price) && p.price > 0 ? p.price : null,
        stock_status: p.stockStatus,
      });
      continue;
    }

    // Secondary fallback resolution
    const staticP = staticProducts.get(item.productId);
    if (staticP) {
      snapshots.push({
        product_id: staticP.id,
        sku: staticP.sku,
        product_name: staticP.name,
        brand_name: staticBrands.get(staticP.brandId) ?? null,
        unit_code: staticP.unit.code,
        unit_label: unitLabel(staticP.unit),
        quantity: Math.round(item.quantity * 1000) / 1000,
        listed_price: null, // static fallback products never store fabricated prices
        stock_status: staticP.stockStatus,
        catalogue_source: "STATIC",
      });
      continue;
    }

    invalid.push(item.productId);
  }

  return invalid.length > 0 ? { ok: false, invalidProductIds: invalid } : { ok: true, snapshots };
}
