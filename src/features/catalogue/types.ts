import type { Product, SpecRow } from "@/features/products/types";

export type IssueSeverity = "error" | "warning";

export type IssueCode =
  | "MISSING_REQUIRED"
  | "INVALID_FORMAT"
  | "INVALID_ENUM"
  | "INVALID_UNIT"
  | "INVALID_BOOLEAN"
  | "INVALID_NUMBER"
  | "INVALID_PRICE"
  | "INVALID_URL"
  | "INVALID_DATE"
  | "INVALID_JSON"
  | "DUPLICATE_ID"
  | "DUPLICATE_SLUG"
  | "DUPLICATE_SKU"
  | "UNKNOWN_CATEGORY"
  | "UNKNOWN_BRAND"
  | "INACTIVE_CATEGORY"
  | "INACTIVE_BRAND"
  | "UNKNOWN_SETTING"
  | "DUPLICATE_SETTING"
  | "INVALID_SETTING";

/**
 * A data problem found in the spreadsheet, with enough context to fix it (worksheet, row, column).
 * `error` ⇒ the row is excluded from the catalogue. `warning` ⇒ the row is kept but the named field
 * is dropped (set to null / ignored) — never replaced with an invented value.
 * Messages never contain credentials; they quote only short catalogue identifiers.
 */
export type ValidationIssue = {
  worksheet: string;
  /** 1-based spreadsheet row (header = 1); null for worksheet-level issues. For reporting only. */
  row: number | null;
  column: string | null;
  severity: IssueSeverity;
  code: IssueCode;
  message: string;
};

export type CatalogueProduct = Product & {
  isActive: boolean;
  createdAt: string | null;
};

export type CatalogueCategory = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  /** null = unspecified; sorted after explicitly ordered categories. */
  displayOrder: number | null;
  isActive: boolean;
};

export type CatalogueBrand = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
  isActive: boolean;
};

/** Business settings from the BusinessSettings worksheet. Every missing value is null — nothing is invented. */
export type BusinessSettingsRecord = {
  businessName: string | null;
  tagline: string | null;
  logoUrl: string | null;
  phone: string | null;
  /** Digits only (country code included). */
  whatsappNumber: string | null;
  email: string | null;
  address: string | null;
  businessHours: string | null;
  gstNumber: string | null;
  googleMapsUrl: string | null;
  deliveryCoverage: string | null;
  social: Record<string, string>;
  announcement: { enabled: boolean; text: string | null };
  /** Owner-written "Why choose us" statements (complete title+description pairs only). */
  whyChooseUs: { title: string; description: string }[];
};

export type WorksheetStats = { rows: number; valid: number };

/** JSON-serialisable result of one successful read of the spreadsheet. */
export type CatalogueSnapshot = {
  /** ISO timestamp of when the data was read from Google Sheets. */
  fetchedAt: string;
  products: CatalogueProduct[];
  categories: CatalogueCategory[];
  brands: CatalogueBrand[];
  settings: BusinessSettingsRecord;
  issues: ValidationIssue[];
  stats: {
    products: WorksheetStats;
    categories: WorksheetStats;
    brands: WorksheetStats;
    settings: WorksheetStats;
  };
};

export type { SpecRow };
