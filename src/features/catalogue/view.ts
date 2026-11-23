import type { EnquiryCatalogueItem } from "@/features/enquiries/types";
import { formatRate } from "@/features/products/format";
import type { Brand, Category, Product } from "@/features/products/types";
import { unitLabel } from "@/features/products/units";
import {
  DEFAULT_BUSINESS_NAME,
  type BusinessSettings,
} from "@/features/settings/business-settings";
import type { PublicCatalogue } from "./public";
import { slugRe } from "./schemas";
import type { BusinessSettingsRecord, CatalogueProduct } from "./types";

/** The catalogue shaped for the customer UI (active products/categories/brands only). */
export type ViewCatalogue = { products: Product[]; categories: Category[]; brands: Brand[] };

/**
 * Category icon is presentation only (not a sheet column): chosen by keyword, falling back to a
 * generic icon. It never changes which products a category contains.
 */
export function iconForCategory(slug: string, name: string): Category["icon"] {
  const t = `${slug} ${name}`.toLowerCase();
  if (/cement/.test(t)) return "cement";
  if (/steel|tmt|rebar|iron/.test(t)) return "steel";
  if (/brick|block/.test(t)) return "bricks";
  if (/sand|aggregate|stone|gravel/.test(t)) return "sand";
  if (/hardware|plumb|pipe|fitting/.test(t)) return "hardware";
  return "other";
}

function toProduct(p: CatalogueProduct): Product {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    sku: p.sku,
    categoryId: p.categoryId,
    brandId: p.brandId,
    description: p.description,
    specifications: p.specifications,
    imageUrl: p.imageUrl,
    price: p.price,
    unit: p.unit,
    stockStatus: p.stockStatus,
    isFeatured: p.isFeatured,
    updatedAt: p.updatedAt,
  };
}

/** Public catalogue → UI types. Order of categories (display_order) is already applied upstream. */
export function toViewCatalogue(pub: PublicCatalogue): ViewCatalogue {
  return {
    products: pub.products.map(toProduct),
    categories: pub.categories.map((c, i) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      icon: iconForCategory(c.slug, c.name),
      displayOrder: c.displayOrder ?? i + 1,
      imageUrl: c.imageUrl,
    })),
    brands: pub.brands.map((b) => ({ id: b.id, slug: b.slug, name: b.name, logoUrl: b.logoUrl })),
  };
}

/** Settings record → UI settings. Missing values stay null; only the name falls back to the brand default. */
export function toBusinessSettings(r: BusinessSettingsRecord): BusinessSettings {
  return {
    name: r.businessName ?? DEFAULT_BUSINESS_NAME,
    tagline: r.tagline,
    phone: r.phone,
    whatsappNumber: r.whatsappNumber,
    email: r.email,
    address: r.address,
    businessHours: r.businessHours,
    gstNumber: r.gstNumber,
    googleMapsUrl: r.googleMapsUrl,
    deliveryCoverage: r.deliveryCoverage,
    announcement: r.announcement.enabled ? r.announcement.text : null,
    social: r.social,
    whyChooseUs: r.whyChooseUs,
  };
}

/** Resolve a public product by slug. Untrusted input: must look like a slug; inactive products are not in the view. */
export function findProductBySlug(c: ViewCatalogue, slug: string): Product | undefined {
  if (slug.length > 80 || !slugRe.test(slug)) return undefined;
  return c.products.find((p) => p.slug === slug);
}

/**
 * Related products for a detail page — catalogue data only, nothing invented. Same category (never the product itself);
 * ranked by the same brand first, then by how many specification label/value pairs they share; ties keep catalogue order
 * so the result is deterministic. The catalogue passed in contains active products only.
 */
export function relatedProducts(c: ViewCatalogue, product: Product, limit = 4): Product[] {
  const spec = (p: Product) =>
    new Set(p.specifications.map((s) => `${s.label}:${s.value}`.toLowerCase()));
  const mine = spec(product);
  return c.products
    .map((p, index) => ({ p, index }))
    .filter(({ p }) => p.categoryId === product.categoryId && p.id !== product.id)
    .map(({ p, index }) => {
      let shared = 0;
      for (const key of spec(p)) if (mine.has(key)) shared++;
      const sameBrand = product.brandId !== null && p.brandId === product.brandId ? 2 : 0;
      return { p, index, score: sameBrand + Math.min(shared, 2) };
    })
    .sort((x, y) => y.score - x.score || x.index - y.index)
    .slice(0, limit)
    .map(({ p }) => p);
}

/** Server-side construction of the bulk-enquiry picker entries (real unit labels, real availability). */
export function toEnquiryItems(c: ViewCatalogue): EnquiryCatalogueItem[] {
  const brands = new Map(c.brands.map((b) => [b.id, b.name]));
  return c.products.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    brandName: p.brandId ? (brands.get(p.brandId) ?? null) : null,
    sku: p.sku,
    unitLabel: unitLabel(p.unit),
    stockStatus: p.stockStatus,
    rate: formatRate(p.price, p.unit),
  }));
}
