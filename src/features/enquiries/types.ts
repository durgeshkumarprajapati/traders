import type { StockStatus } from "@/features/products/stock";

/**
 * Catalogue entry offered by the bulk-enquiry product picker. Built on the SERVER from the validated
 * catalogue; the browser only receives it for display and never sends names/prices/units back as truth.
 */
export type EnquiryCatalogueItem = {
  id: string;
  slug: string;
  name: string;
  brandName: string | null;
  sku: string | null;
  /** Display label of the product's real unit (custom label for CUSTOM). */
  unitLabel: string;
  stockStatus: StockStatus | null;
  /** Preformatted indicative rate, or null for "Rate on request". */
  rate: string | null;
};
