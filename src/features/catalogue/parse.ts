import { z } from "zod";
import {
  cellText,
  parseBoolean,
  parseDateIso,
  parseNumber,
  type RawCell,
  type Table,
} from "@/lib/google-sheets/cells";
import { BRANDS, CATEGORIES, PRODUCTS, SETTINGS } from "@/lib/google-sheets/worksheets";
import { normalizeWhatsAppNumber } from "@/lib/whatsapp";
import type { UnitCode } from "@/features/products/units";
import type { SpecRow } from "@/features/products/types";
import { IMAGE_HOSTS } from "./constants";
import {
  REQUIRED,
  brandRowSchema,
  categoryRowSchema,
  displayOrderSchema,
  priceSchema,
  productRowSchema,
  specificationsSchema,
} from "./schemas";
import type {
  BusinessSettingsRecord,
  CatalogueBrand,
  CatalogueCategory,
  CatalogueProduct,
  CatalogueSnapshot,
  IssueCode,
  IssueSeverity,
  ValidationIssue,
  WorksheetStats,
} from "./types";

export type Tables = { products: Table; categories: Table; brands: Table; settings: Table };
type Sourced<T> = { rowNumber: number; value: T };
type Bag = ValidationIssue[];

function push(
  bag: Bag,
  worksheet: string,
  row: number | null,
  column: string | null,
  severity: IssueSeverity,
  code: IssueCode,
  message: string,
) {
  bag.push({ worksheet, row, column, severity, code, message });
}

const excerpt = (s: string, n = 40) => (s.length > n ? `${s.slice(0, n)}…` : s);

// ── shared helpers ─────────────────────────────────────────────────────────────────────────────

function codeFor(column: string, message: string): IssueCode {
  if (message === REQUIRED || message.endsWith("is required when unit is CUSTOM"))
    return "MISSING_REQUIRED";
  if (column === "unit" || column === "unit_custom") return "INVALID_UNIT";
  if (column === "stock_status") return "INVALID_ENUM";
  if (column.startsWith("is_")) return "INVALID_BOOLEAN";
  return "INVALID_FORMAT";
}

/** Run a hard Zod contract; each failed field becomes an `error` issue with worksheet/row/column. */
function hardParse<S extends z.ZodType>(
  schema: S,
  input: Record<string, unknown>,
  worksheet: string,
  row: number,
  bag: Bag,
): z.output<S> | null {
  const r = schema.safeParse(input);
  if (r.success) return r.data;
  const seen = new Set<string>();
  for (const issue of r.error.issues) {
    const column = String(issue.path[0] ?? "row");
    if (seen.has(column)) continue; // one message per column is enough
    seen.add(column);
    const raw = input[column];
    const found =
      typeof raw === "string" &&
      raw !== "" &&
      issue.message !== REQUIRED &&
      column !== "description"
        ? ` (found "${excerpt(raw)}")`
        : "";
    push(
      bag,
      worksheet,
      row,
      column,
      "error",
      codeFor(column, issue.message),
      `${column} ${issue.message}${found}`,
    );
  }
  return null;
}

/** Boolean input for the Zod schema: parsed value, `undefined` when blank, `"invalid"` otherwise. */
function boolInput(v: RawCell): boolean | undefined | "invalid" {
  const p = parseBoolean(v);
  if (p.ok) return p.value;
  return cellText(v) === "" ? undefined : "invalid";
}

function softUrl(
  v: RawCell,
  worksheet: string,
  row: number,
  column: string,
  bag: Bag,
  hosts: readonly string[] | null,
): string | null {
  const t = cellText(v);
  if (!t) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== "https:" || (hosts && !hosts.includes(u.hostname))) throw new Error("bad");
    return u.toString();
  } catch {
    const where = hosts ? ` on an allowed host (${hosts.join(", ")})` : "";
    push(
      bag,
      worksheet,
      row,
      column,
      "warning",
      "INVALID_URL",
      `${column} must be an https URL${where}; the value was ignored`,
    );
    return null;
  }
}

function softDate(
  v: RawCell,
  worksheet: string,
  row: number,
  column: string,
  bag: Bag,
): string | null {
  if (cellText(v) === "") return null;
  const d = parseDateIso(v);
  if (d.ok) return d.value;
  push(
    bag,
    worksheet,
    row,
    column,
    "warning",
    "INVALID_DATE",
    `${column} is not a valid date (use ISO format, e.g. 2026-11-18T10:30:00Z); the value was ignored`,
  );
  return null;
}

const emptyToNull = (s: string): string | null => (s === "" ? null : s);

// ── Products ───────────────────────────────────────────────────────────────────────────────────

export function parseProducts(table: Table, bag: Bag): Sourced<CatalogueProduct>[] {
  const ws = PRODUCTS.name;
  const out: Sourced<CatalogueProduct>[] = [];
  for (const { rowNumber, cells: c } of table.rows) {
    const hard = hardParse(
      productRowSchema,
      {
        product_id: cellText(c.product_id),
        product_name: cellText(c.product_name),
        slug: cellText(c.slug),
        sku: cellText(c.sku),
        category_id: cellText(c.category_id),
        brand_id: cellText(c.brand_id),
        description: cellText(c.description),
        unit: cellText(c.unit),
        unit_custom: cellText(c.unit_custom),
        stock_status: cellText(c.stock_status),
        is_featured: boolInput(c.is_featured),
        is_active: boolInput(c.is_active),
      },
      ws,
      rowNumber,
      bag,
    );
    if (!hard) continue;

    // Soft fields: a problem drops only that field (to null/[]), is reported, and never becomes 0 or a guess.
    let price: number | null = null;
    const priceText = cellText(c.price);
    if (priceText !== "") {
      const n = parseNumber(c.price);
      if (n.ok && priceSchema.safeParse(n.value).success) price = n.value;
      else {
        push(
          bag,
          ws,
          rowNumber,
          "price",
          "warning",
          "INVALID_PRICE",
          `price must be a positive plain number such as 385 or 385.50 (found "${excerpt(priceText)}"); the product is shown as "Rate on request"`,
        );
      }
    }

    let specifications: SpecRow[] = [];
    const specText = cellText(c.specifications);
    if (specText !== "") {
      let parsed: unknown;
      try {
        parsed = JSON.parse(specText);
      } catch {
        parsed = undefined;
      }
      const ok = specificationsSchema.safeParse(parsed);
      if (ok.success) specifications = ok.data;
      else
        push(
          bag,
          ws,
          rowNumber,
          "specifications",
          "warning",
          "INVALID_JSON",
          'specifications must be JSON like [{"label":"Grade","value":"43"}]; the value was ignored',
        );
    }

    const unit = hard.unit as UnitCode;
    out.push({
      rowNumber,
      value: {
        id: hard.product_id,
        slug: hard.slug,
        name: hard.product_name,
        sku: emptyToNull(hard.sku),
        categoryId: hard.category_id,
        brandId: hard.brand_id,
        description: hard.description,
        specifications,
        imageUrl: softUrl(c.image_url, ws, rowNumber, "image_url", bag, IMAGE_HOSTS),
        price,
        unit: unit === "CUSTOM" ? { code: unit, customLabel: hard.unit_custom } : { code: unit },
        stockStatus: hard.stock_status,
        isFeatured: hard.is_featured,
        isActive: hard.is_active,
        createdAt: softDate(c.created_at, ws, rowNumber, "created_at", bag),
        updatedAt: softDate(c.updated_at, ws, rowNumber, "updated_at", bag),
      },
    });
  }
  return out;
}

// ── Categories & Brands ────────────────────────────────────────────────────────────────────────

export function parseCategories(table: Table, bag: Bag): Sourced<CatalogueCategory>[] {
  const ws = CATEGORIES.name;
  const out: Sourced<CatalogueCategory>[] = [];
  for (const { rowNumber, cells: c } of table.rows) {
    const hard = hardParse(
      categoryRowSchema,
      {
        category_id: cellText(c.category_id),
        category_name: cellText(c.category_name),
        slug: cellText(c.slug),
        description: cellText(c.description),
        is_active: boolInput(c.is_active),
      },
      ws,
      rowNumber,
      bag,
    );
    if (!hard) continue;
    let displayOrder: number | null = null;
    if (cellText(c.display_order) !== "") {
      const n = parseNumber(c.display_order);
      if (n.ok && displayOrderSchema.safeParse(n.value).success) displayOrder = n.value;
      else
        push(
          bag,
          ws,
          rowNumber,
          "display_order",
          "warning",
          "INVALID_NUMBER",
          `display_order must be a whole number ≥ 0 (found "${excerpt(cellText(c.display_order))}"); the category sorts last`,
        );
    }
    out.push({
      rowNumber,
      value: {
        id: hard.category_id,
        slug: hard.slug,
        name: hard.category_name,
        description: emptyToNull(hard.description),
        imageUrl: softUrl(c.image_url, ws, rowNumber, "image_url", bag, IMAGE_HOSTS),
        displayOrder,
        isActive: hard.is_active,
      },
    });
  }
  return out;
}

export function parseBrands(table: Table, bag: Bag): Sourced<CatalogueBrand>[] {
  const ws = BRANDS.name;
  const out: Sourced<CatalogueBrand>[] = [];
  for (const { rowNumber, cells: c } of table.rows) {
    const hard = hardParse(
      brandRowSchema,
      {
        brand_id: cellText(c.brand_id),
        brand_name: cellText(c.brand_name),
        slug: cellText(c.slug),
        description: cellText(c.description),
        is_active: boolInput(c.is_active),
      },
      ws,
      rowNumber,
      bag,
    );
    if (!hard) continue;
    out.push({
      rowNumber,
      value: {
        id: hard.brand_id,
        slug: hard.slug,
        name: hard.brand_name,
        logoUrl: softUrl(c.logo_url, ws, rowNumber, "logo_url", bag, IMAGE_HOSTS),
        description: emptyToNull(hard.description),
        isActive: hard.is_active,
      },
    });
  }
  return out;
}

// ── Business settings ──────────────────────────────────────────────────────────────────────────

type SettingResult = { ok: true; value: string | boolean | null } | { ok: false; message: string };
const str =
  (max: number) =>
  (v: string): SettingResult =>
    v.length <= max
      ? { ok: true, value: v || null }
      : { ok: false, message: `must be at most ${max} characters` };
const httpsUrl =
  (hosts: readonly string[] | null) =>
  (v: string): SettingResult => {
    if (!v) return { ok: true, value: null };
    try {
      const u = new URL(v);
      if (u.protocol === "https:" && (!hosts || hosts.includes(u.hostname)))
        return { ok: true, value: u.toString() };
    } catch {
      /* fall through */
    }
    return { ok: false, message: `must be an https URL${hosts ? ` on ${hosts.join(", ")}` : ""}` };
  };

const SETTING_PARSERS: Record<string, (v: string) => SettingResult> = {
  business_name: str(100),
  tagline: str(200),
  logo_url: httpsUrl(IMAGE_HOSTS),
  phone: (v) =>
    !v
      ? { ok: true, value: null }
      : /^[+()\d\s-]{7,25}$/.test(v) && v.replace(/\D/g, "").length >= 7
        ? { ok: true, value: v }
        : { ok: false, message: "must be a phone number (digits, spaces, + - ( ))" },
  whatsapp_number: (v) => {
    if (!v) return { ok: true, value: null };
    const n = normalizeWhatsAppNumber(v);
    return n
      ? { ok: true, value: n }
      : { ok: false, message: "must contain 8–15 digits including the country code" };
  },
  email: (v) =>
    !v
      ? { ok: true, value: null }
      : z.email().safeParse(v).success && v.length <= 254
        ? { ok: true, value: v }
        : { ok: false, message: "must be a valid e-mail address" },
  address: str(500),
  business_hours: str(300),
  gst_number: (v) => {
    if (!v) return { ok: true, value: null };
    const g = v.toUpperCase();
    return /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)
      ? { ok: true, value: g }
      : { ok: false, message: "must be a valid 15-character GSTIN" };
  },
  google_maps_url: httpsUrl(null),
  delivery_coverage: str(500),
  announcement_text: str(300),
  announcement_enabled: (v) => {
    const p = parseBoolean(v);
    return p.ok
      ? { ok: true, value: p.value }
      : v === ""
        ? { ok: true, value: null }
        : { ok: false, message: "must be TRUE or FALSE" };
  },
};

export const SETTING_KEYS = [...Object.keys(SETTING_PARSERS)] as const;
/** Structured "Why choose us" content: up to 6 items, each a `_title` + `_description` pair. */
export const WHY_MAX_ITEMS = 6;
const WHY_KEY = /^why_choose_us_([1-6])_(title|description)$/;

export const isSettingKey = (key: string) =>
  key in SETTING_PARSERS || /^social_[a-z0-9_]+$/.test(key) || WHY_KEY.test(key);

/** Validate one setting value (used by reads and by writes). */
export function parseSettingValue(key: string, value: string): SettingResult {
  if (/^social_[a-z0-9_]+$/.test(key)) return httpsUrl(null)(value);
  const why = WHY_KEY.exec(key);
  if (why) return str(why[2] === "title" ? 80 : 300)(value);
  const p = SETTING_PARSERS[key];
  return p ? p(value) : { ok: false, message: "is not a recognised setting" };
}

export function emptySettings(): BusinessSettingsRecord {
  return {
    businessName: null,
    tagline: null,
    logoUrl: null,
    phone: null,
    whatsappNumber: null,
    email: null,
    address: null,
    businessHours: null,
    gstNumber: null,
    googleMapsUrl: null,
    deliveryCoverage: null,
    social: {},
    announcement: { enabled: false, text: null },
    whyChooseUs: [],
  };
}

export function parseSettings(
  table: Table,
  bag: Bag,
): { settings: BusinessSettingsRecord; validRows: number } {
  const ws = SETTINGS.name;
  const groups = new Map<string, { rowNumber: number; value: string }[]>();
  for (const { rowNumber, cells } of table.rows) {
    const key = cellText(cells.setting_key).toLowerCase();
    if (!key) {
      push(
        bag,
        ws,
        rowNumber,
        "setting_key",
        "warning",
        "MISSING_REQUIRED",
        "setting_key is required; the row was ignored",
      );
      continue;
    }
    groups.set(key, [
      ...(groups.get(key) ?? []),
      { rowNumber, value: cellText(cells.setting_value) },
    ]);
  }

  const values = new Map<string, string | boolean | null>();
  const rowOf = new Map<string, number>();
  let validRows = 0;
  for (const [key, rows] of groups) {
    if (rows.length > 1) {
      for (const r of rows) {
        push(
          bag,
          ws,
          r.rowNumber,
          "setting_key",
          "error",
          "DUPLICATE_SETTING",
          `setting "${excerpt(key)}" appears on rows ${rows.map((x) => x.rowNumber).join(", ")}; all are ignored until it is unique`,
        );
      }
      continue;
    }
    const { rowNumber, value } = rows[0];
    if (!isSettingKey(key)) {
      push(
        bag,
        ws,
        rowNumber,
        "setting_key",
        "warning",
        "UNKNOWN_SETTING",
        `unrecognised setting "${excerpt(key)}" was ignored`,
      );
      continue;
    }
    const r = parseSettingValue(key, value);
    if (!r.ok) {
      push(
        bag,
        ws,
        rowNumber,
        "setting_value",
        "warning",
        "INVALID_SETTING",
        `${key} ${r.message}; the value was ignored`,
      );
      continue;
    }
    values.set(key, r.value);
    rowOf.set(key, rowNumber);
    validRows++;
  }

  const s = emptySettings();
  const get = (k: string) => (typeof values.get(k) === "string" ? (values.get(k) as string) : null);
  s.businessName = get("business_name");
  s.tagline = get("tagline");
  s.logoUrl = get("logo_url");
  s.phone = get("phone");
  s.whatsappNumber = get("whatsapp_number");
  s.email = get("email");
  s.address = get("address");
  s.businessHours = get("business_hours");
  s.gstNumber = get("gst_number");
  s.googleMapsUrl = get("google_maps_url");
  s.deliveryCoverage = get("delivery_coverage");
  for (const [k, v] of values)
    if (k.startsWith("social_") && typeof v === "string") s.social[k.slice(7)] = v;
  // "Why choose us": an item needs BOTH a title and a description; half-filled items are ignored and reported.
  for (let n = 1; n <= WHY_MAX_ITEMS; n++) {
    const title = get(`why_choose_us_${n}_title`);
    const description = get(`why_choose_us_${n}_description`);
    if (title && description) s.whyChooseUs.push({ title, description });
    else if (title || description) {
      push(
        bag,
        ws,
        rowOf.get(`why_choose_us_${n}_${title ? "title" : "description"}`) ?? null,
        "setting_value",
        "warning",
        "INVALID_SETTING",
        `why_choose_us_${n} needs both a title and a description; the item was ignored`,
      );
    }
  }
  const enabled = values.get("announcement_enabled") === true;
  const text = get("announcement_text");
  if (enabled && !text) {
    push(
      bag,
      ws,
      null,
      "announcement_text",
      "warning",
      "INVALID_SETTING",
      "announcement_enabled is TRUE but announcement_text is empty; no banner is shown",
    );
  }
  s.announcement = { enabled: enabled && Boolean(text), text: enabled ? text : null };
  return { settings: s, validRows };
}

// ── Cross-row validation ───────────────────────────────────────────────────────────────────────

/**
 * Exclude EVERY row in a duplicate group (which one is "right" is unknowable) and report each of them.
 */
function dropDuplicates<T>(
  items: Sourced<T>[],
  key: (t: T) => string | null,
  worksheet: string,
  column: string,
  code: IssueCode,
  bag: Bag,
): Sourced<T>[] {
  const groups = new Map<string, Sourced<T>[]>();
  for (const it of items) {
    const k = key(it.value);
    if (k) groups.set(k.toLowerCase(), [...(groups.get(k.toLowerCase()) ?? []), it]);
  }
  const bad = new Set<Sourced<T>>();
  for (const [k, members] of groups) {
    if (members.length < 2) continue;
    for (const m of members) {
      bad.add(m);
      push(
        bag,
        worksheet,
        m.rowNumber,
        column,
        "error",
        code,
        `${column} "${excerpt(k)}" is used on rows ${members.map((x) => x.rowNumber).join(", ")}; all of them are excluded until it is unique`,
      );
    }
  }
  return items.filter((it) => !bad.has(it));
}

const byOrderThenName = (a: CatalogueCategory, b: CatalogueCategory) =>
  (a.displayOrder ?? Number.MAX_SAFE_INTEGER) - (b.displayOrder ?? Number.MAX_SAFE_INTEGER) ||
  a.name.localeCompare(b.name);

export type BuiltCatalogue = Omit<CatalogueSnapshot, "fetchedAt"> & {
  rowNumbers: Map<string, number>;
};

/**
 * Validate and join the four worksheets. One malformed record never corrupts the rest:
 * it is excluded (or has a field dropped) and reported with worksheet + row + column.
 * Structural problems (missing worksheet/headers) are thrown earlier by `parseTable`.
 */
export function buildCatalogue(tables: Tables): BuiltCatalogue {
  const issues: Bag = [];

  let categories = parseCategories(tables.categories, issues);
  categories = dropDuplicates(
    categories,
    (c) => c.id,
    CATEGORIES.name,
    "category_id",
    "DUPLICATE_ID",
    issues,
  );
  categories = dropDuplicates(
    categories,
    (c) => c.slug,
    CATEGORIES.name,
    "slug",
    "DUPLICATE_SLUG",
    issues,
  );

  let brands = parseBrands(tables.brands, issues);
  brands = dropDuplicates(brands, (b) => b.id, BRANDS.name, "brand_id", "DUPLICATE_ID", issues);
  brands = dropDuplicates(brands, (b) => b.slug, BRANDS.name, "slug", "DUPLICATE_SLUG", issues);

  let products = parseProducts(tables.products, issues);
  products = dropDuplicates(
    products,
    (p) => p.id,
    PRODUCTS.name,
    "product_id",
    "DUPLICATE_ID",
    issues,
  );
  products = dropDuplicates(
    products,
    (p) => p.slug,
    PRODUCTS.name,
    "slug",
    "DUPLICATE_SLUG",
    issues,
  );
  products = dropDuplicates(products, (p) => p.sku, PRODUCTS.name, "sku", "DUPLICATE_SKU", issues);

  const catById = new Map(categories.map((c) => [c.value.id.toLowerCase(), c.value]));
  const brandById = new Map(brands.map((b) => [b.value.id.toLowerCase(), b.value]));
  const valid: Sourced<CatalogueProduct>[] = [];
  for (const p of products) {
    const cat = catById.get(p.value.categoryId.toLowerCase());
    const brandKey = p.value.brandId?.toLowerCase() ?? "";
    const brand = brandKey ? brandById.get(brandKey) : undefined;
    let ok = true;
    if (!cat) {
      push(
        issues,
        PRODUCTS.name,
        p.rowNumber,
        "category_id",
        "error",
        "UNKNOWN_CATEGORY",
        `category_id "${excerpt(p.value.categoryId)}" does not match any valid category (it may be missing, invalid or duplicated)`,
      );
      ok = false;
    } else if (p.value.isActive && !cat.isActive) {
      push(
        issues,
        PRODUCTS.name,
        p.rowNumber,
        "category_id",
        "error",
        "INACTIVE_CATEGORY",
        `active product references inactive category "${excerpt(cat.name)}"; activate the category or deactivate the product`,
      );
      ok = false;
    }
    if (!brand) {
      push(
        issues,
        PRODUCTS.name,
        p.rowNumber,
        "brand_id",
        "error",
        "UNKNOWN_BRAND",
        `brand_id "${excerpt(p.value.brandId ?? "")}" does not match any valid brand (it may be missing, invalid or duplicated)`,
      );
      ok = false;
    } else if (p.value.isActive && !brand.isActive) {
      push(
        issues,
        PRODUCTS.name,
        p.rowNumber,
        "brand_id",
        "error",
        "INACTIVE_BRAND",
        `active product references inactive brand "${excerpt(brand.name)}"; activate the brand or deactivate the product`,
      );
      ok = false;
    }
    if (ok && cat && brand)
      valid.push({
        rowNumber: p.rowNumber,
        value: { ...p.value, categoryId: cat.id, brandId: brand.id },
      });
  }

  const { settings, validRows } = parseSettings(tables.settings, issues);

  const order = [PRODUCTS.name, CATEGORIES.name, BRANDS.name, SETTINGS.name];
  issues.sort(
    (a, b) =>
      order.indexOf(a.worksheet) - order.indexOf(b.worksheet) ||
      (a.row ?? 0) - (b.row ?? 0) ||
      (a.column ?? "").localeCompare(b.column ?? ""),
  );

  const rowNumbers = new Map<string, number>();
  for (const p of valid) rowNumbers.set(`${PRODUCTS.name}:${p.value.id}`, p.rowNumber);
  for (const c of categories) rowNumbers.set(`${CATEGORIES.name}:${c.value.id}`, c.rowNumber);
  for (const b of brands) rowNumbers.set(`${BRANDS.name}:${b.value.id}`, b.rowNumber);

  const stats = (rows: number, ok: number): WorksheetStats => ({ rows, valid: ok });
  return {
    products: valid.map((p) => p.value),
    categories: categories.map((c) => c.value).sort(byOrderThenName),
    brands: brands.map((b) => b.value).sort((a, b) => a.name.localeCompare(b.name)),
    settings,
    issues,
    stats: {
      products: stats(tables.products.rows.length, valid.length),
      categories: stats(tables.categories.rows.length, categories.length),
      brands: stats(tables.brands.rows.length, brands.length),
      settings: stats(tables.settings.rows.length, validRows),
    },
    rowNumbers,
  };
}
