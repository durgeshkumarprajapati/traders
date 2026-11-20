import { z } from "zod";
import { STOCK_STATUSES, type StockStatus } from "@/components/ui/status-badge";
import type { Brand, Category, Product } from "./types";

export const PAGE_SIZE = 8;
export const SORT_OPTIONS = ["featured", "price-asc", "price-desc", "updated"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];
export const SORT_LABELS: Record<SortOption, string> = {
  featured: "Featured first",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  updated: "Recently updated",
};

export type ListingParams = {
  q: string;
  category: string | null;
  brands: string[];
  stock: StockStatus[];
  sort: SortOption;
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;
const many = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(80);

/** Parse untrusted URL parameters into bounded, valid listing parameters. Invalid parts fall back to defaults. */
export function parseListingParams(raw: RawParams): ListingParams {
  const q = (first(raw.q) ?? "").trim().slice(0, 100);
  const cat = slug.safeParse(first(raw.category));
  const sort = z.enum(SORT_OPTIONS).safeParse(first(raw.sort));
  const page = z.coerce.number().int().min(1).max(1000).safeParse(first(raw.page));
  return {
    q,
    category: cat.success ? cat.data : null,
    brands: many(raw.brand)
      .filter((b) => slug.safeParse(b).success)
      .slice(0, 20),
    stock: many(raw.stock).filter((s): s is StockStatus =>
      (STOCK_STATUSES as readonly string[]).includes(s),
    ),
    sort: sort.success ? sort.data : "featured",
    page: page.success ? page.data : 1,
  };
}

export type Catalogue = { products: Product[]; categories: Category[]; brands: Brand[] };

/** Case-insensitive search over name, SKU, brand, category and description. */
function matches(p: Product, q: string, cat: Category | undefined, brand: Brand | undefined) {
  if (!q) return true;
  const hay = [p.name, p.sku ?? "", brand?.name ?? "", cat?.name ?? "", p.description]
    .join(" ")
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((term) => hay.includes(term));
}

export function filterAndSort(data: Catalogue, params: ListingParams): Product[] {
  const catById = new Map(data.categories.map((c) => [c.id, c]));
  const brandById = new Map(data.brands.map((b) => [b.id, b]));
  const category = params.category
    ? data.categories.find((c) => c.slug === params.category)
    : undefined;
  const brandIds = new Set(
    data.brands.filter((b) => params.brands.includes(b.slug)).map((b) => b.id),
  );

  const filtered = data.products.filter((p) => {
    if (params.category && p.categoryId !== category?.id) return false;
    if (params.brands.length && (!p.brandId || !brandIds.has(p.brandId))) return false;
    if (params.stock.length && (!p.stockStatus || !params.stock.includes(p.stockStatus)))
      return false;
    return matches(
      p,
      params.q,
      catById.get(p.categoryId),
      p.brandId ? brandById.get(p.brandId) : undefined,
    );
  });

  // Products without a price (or timestamp) always sort last; they are never treated as 0.
  const byNullable = (a: number | null, b: number | null, dir: 1 | -1) =>
    a === null ? (b === null ? 0 : 1) : b === null ? -1 : (a - b) * dir;
  const time = (p: Product) => (p.updatedAt ? Date.parse(p.updatedAt) : null);
  const sorted = [...filtered];
  sorted.sort((a, b) => {
    switch (params.sort) {
      case "price-asc":
        return byNullable(a.price, b.price, 1);
      case "price-desc":
        return byNullable(a.price, b.price, -1);
      case "updated":
        return byNullable(time(a), time(b), -1); // newest first, unknown last
      default:
        return Number(b.isFeatured) - Number(a.isFeatured) || a.name.localeCompare(b.name);
    }
  });
  return sorted;
}

export function paginate<T>(items: T[], page: number, size = PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * size;
  return {
    items: items.slice(start, start + size),
    page: current,
    pageCount,
    total: items.length,
    start,
  };
}

/** Build a listing URL query string from params (omits defaults). */
export function listingQuery(
  params: Partial<ListingParams>,
  overrides: Partial<ListingParams> = {},
): string {
  const p = { ...params, ...overrides };
  const sp = new URLSearchParams();
  if (p.q) sp.set("q", p.q);
  if (p.category) sp.set("category", p.category);
  p.brands?.forEach((b) => sp.append("brand", b));
  p.stock?.forEach((s) => sp.append("stock", s));
  if (p.sort && p.sort !== "featured") sp.set("sort", p.sort);
  if (p.page && p.page > 1) sp.set("page", String(p.page));
  const s = sp.toString();
  return s ? `?${s}` : "";
}
