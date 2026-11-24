"use server";

import { z } from "zod";
import { loadCatalogue } from "@/features/catalogue/server";
import { formatRate } from "@/features/products/format";
import type { StockStatus } from "@/features/products/stock";
import { unitLabel } from "@/features/products/units";
import { PRODUCT_ID } from "./types";

/**
 * Public, read-only: re-reads the CURRENT catalogue facts for product ids a customer saved earlier. Saved lists never store
 * prices or stock, so this is how they get fresh, authoritative values. Returns only fields that are already public on the
 * product pages; an id that is unknown or inactive comes back as null (the customer sees "no longer available").
 */
export type ResolvedProduct = {
  name: string;
  brandName: string | null;
  unitLabel: string;
  /** Indicative rate text, or null when no valid price is listed. */
  rate: string | null;
  stockStatus: StockStatus | null;
  updatedAt: string | null;
  slug: string;
};
export type ResolveResult =
  | {
      ok: true;
      /** STATIC = the built-in fallback catalogue, not live data. */ source: "LIVE" | "STATIC";
      products: Record<string, ResolvedProduct | null>;
    }
  | { ok: false; message: string };

const idsSchema = z.array(z.string().regex(PRODUCT_ID)).max(100);

export async function resolveMaterialItemsAction(input: unknown): Promise<ResolveResult> {
  const parsed = idsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That list could not be checked." };
  const ids = [...new Set(parsed.data)];
  const load = await loadCatalogue();
  if (!load.ok)
    return {
      ok: false,
      message: "Product information is temporarily unavailable. Please try again shortly.",
    };
  const brands = new Map(load.catalogue.brands.map((b) => [b.id, b.name]));
  const byId = new Map(load.catalogue.products.map((p) => [p.id, p]));
  const products: Record<string, ResolvedProduct | null> = {};
  for (const id of ids) {
    const p = byId.get(id);
    products[id] = p
      ? {
          name: p.name,
          brandName: p.brandId ? (brands.get(p.brandId) ?? null) : null,
          unitLabel: unitLabel(p.unit),
          rate: formatRate(p.price, p.unit),
          stockStatus: p.stockStatus,
          updatedAt: p.updatedAt,
          slug: p.slug,
        }
      : null;
  }
  return { ok: true, source: load.source === "STATIC" ? "STATIC" : "LIVE", products };
}
