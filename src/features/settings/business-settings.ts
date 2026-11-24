import type { DeliveryConfig } from "@/features/catalogue/types";

/**
 * Business settings as the customer UI consumes them. They come from the Google Sheets
 * `BusinessSettings` worksheet (see `features/catalogue/view.ts: toBusinessSettings`). Every value
 * except the name is null when not configured: no phone numbers, addresses, GSTIN, hours or
 * WhatsApp number are ever invented, and the UI omits what is missing.
 */
export type BusinessSettings = {
  name: string;
  tagline: string | null;
  phone: string | null;
  /** Digits with country code. */
  whatsappNumber: string | null;
  email: string | null;
  address: string | null;
  businessHours: string | null;
  gstNumber: string | null;
  googleMapsUrl: string | null;
  deliveryCoverage: string | null;
  /** Owner-configured delivery coverage (PIN codes etc.). Undefined / disabled = not configured. */
  delivery?: DeliveryConfig;
  announcement: string | null;
  /** Social profile links keyed by network (e.g. `instagram`). */
  social: Record<string, string>;
  /** Owner-written "Why choose us" statements; empty = the section is not shown. */
  whyChooseUs: { title: string; description: string }[];
};

/** Brand name used only when the `business_name` setting is not configured (or the sheet is unreachable). */
export const DEFAULT_BUSINESS_NAME = "Sagar Traders";

/** Settings with nothing configured — used while loading and when the spreadsheet is unavailable. */
export function emptyBusinessSettings(): BusinessSettings {
  return {
    name: DEFAULT_BUSINESS_NAME,
    tagline: null,
    phone: null,
    whatsappNumber: null,
    email: null,
    address: null,
    businessHours: null,
    gstNumber: null,
    googleMapsUrl: null,
    deliveryCoverage: null,
    delivery: { enabled: false, pincodes: [], localities: null, notes: null, terms: null },
    announcement: null,
    social: {},
    whyChooseUs: [],
  };
}

/** True when at least one customer-facing contact detail is configured. */
export function hasContactData(s: BusinessSettings): boolean {
  return Boolean(
    s.phone || s.whatsappNumber || s.email || s.address || s.businessHours || s.deliveryCoverage,
  );
}
