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
};

export type SnapshotResult =
  { ok: true; snapshots: ItemSnapshot[] } | { ok: false; invalidProductIds: string[] };

/**
 * Resolve requested items against the AUTHORITATIVE public catalogue (active products with active
 * categories/brands). Anything the browser claimed besides id + quantity is irrelevant: names, brands,
 * units, prices and availability all come from here. Unknown or inactive ids reject the whole enquiry
 * (customers must not silently get a different order than they asked for).
 */
export function buildItemSnapshots(
  items: { productId: string; quantity: number }[],
  catalogue: ViewCatalogue,
): SnapshotResult {
  const products = new Map(catalogue.products.map((p) => [p.id, p]));
  const brands = new Map(catalogue.brands.map((b) => [b.id, b.name]));
  const invalid: string[] = [];
  const snapshots: ItemSnapshot[] = [];
  for (const item of items) {
    const p = products.get(item.productId);
    if (!p) {
      invalid.push(item.productId);
      continue;
    }
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
  }
  return invalid.length > 0 ? { ok: false, invalidProductIds: invalid } : { ok: true, snapshots };
}
