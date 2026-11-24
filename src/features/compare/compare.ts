import type { ViewCatalogue } from "@/features/catalogue/view";
import { formatRate } from "@/features/products/format";
import type { StockStatus } from "@/features/products/stock";
import { unitLabel, type UnitCode } from "@/features/products/units";

/**
 * Product comparison (up to three catalogue products). Pure functions over the validated, active-only catalogue.
 * What this deliberately does NOT do: rank, score or call anything "best"/"cheapest"/"strongest" (no verified method exists),
 * convert units, or fill a missing value — an unavailable attribute stays null and is shown as "Not specified".
 */
export const MAX_COMPARE = 3;
const ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Parses `?ids=a,b,c` (or repeated params) into at most three distinct, well-formed ids. */
export function parseCompareIds(raw: string | string[] | undefined): string[] {
  const parts = (Array.isArray(raw) ? raw : raw ? [raw] : []).flatMap((r) => r.split(","));
  const out: string[] = [];
  for (const p of parts) {
    const id = p.trim();
    if (ID.test(id) && !out.includes(id)) out.push(id);
    if (out.length >= MAX_COMPARE) break;
  }
  return out;
}

export function compareHref(ids: string[]): string {
  const valid = ids.filter((i) => ID.test(i)).slice(0, MAX_COMPARE);
  return valid.length ? `/compare?ids=${valid.map(encodeURIComponent).join(",")}` : "/compare";
}

export type CompareColumn = {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  brand: string | null;
  category: string | null;
  sku: string | null;
  unitCode: UnitCode;
  unit: string;
  /** Indicative rate text ("₹385.00 / Bag") or null when no valid price is listed. */
  rate: string | null;
  stockStatus: StockStatus | null;
  updatedAt: string | null;
  specs: Array<{ label: string; value: string }>;
};

export type Comparison = {
  columns: CompareColumn[];
  /** Requested ids that are not (or no longer) active catalogue products. */
  missing: string[];
  /** Spec labels across all columns (first-seen order, case-insensitive), each with one value per column or null. */
  specRows: Array<{ label: string; values: Array<string | null> }>;
  /** Plain-language notes the page must show (e.g. units differ). Never a recommendation. */
  notes: string[];
};

export function buildComparison(c: ViewCatalogue, ids: string[]): Comparison {
  const brands = new Map(c.brands.map((b) => [b.id, b.name]));
  const cats = new Map(c.categories.map((x) => [x.id, x.name]));
  const byId = new Map(c.products.map((p) => [p.id, p]));
  const columns: CompareColumn[] = [];
  const missing: string[] = [];
  for (const id of ids.slice(0, MAX_COMPARE)) {
    const p = byId.get(id);
    if (!p) {
      missing.push(id);
      continue;
    }
    columns.push({
      id: p.id,
      slug: p.slug,
      name: p.name,
      imageUrl: p.imageUrl,
      brand: p.brandId ? (brands.get(p.brandId) ?? null) : null,
      category: cats.get(p.categoryId) ?? null,
      sku: p.sku,
      unitCode: p.unit.code,
      unit: unitLabel(p.unit),
      rate: formatRate(p.price, p.unit),
      stockStatus: p.stockStatus,
      updatedAt: p.updatedAt,
      specs: p.specifications.map((s) => ({ label: s.label, value: s.value })),
    });
  }

  const order: string[] = [];
  const display = new Map<string, string>();
  for (const col of columns)
    for (const s of col.specs) {
      const key = s.label.trim().toLowerCase();
      if (!key) continue;
      if (!display.has(key)) {
        display.set(key, s.label.trim());
        order.push(key);
      }
    }
  const specRows = order.map((key) => ({
    label: display.get(key)!,
    values: columns.map(
      (col) => col.specs.find((s) => s.label.trim().toLowerCase() === key)?.value?.trim() || null,
    ),
  }));

  const notes: string[] = [];
  const unitCodes = new Set(columns.map((x) => x.unitCode));
  if (unitCodes.size > 1) {
    notes.push(
      unitCodes.has("TON") && unitCodes.has("METRIC_TON")
        ? "These products use different units — including Ton and Metric Ton, which are not the same. Rates are per unit and cannot be compared directly."
        : "These products are sold in different units, so their rates are per unit and cannot be compared directly.",
    );
  }
  return { columns, missing, specRows, notes };
}
