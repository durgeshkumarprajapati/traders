import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import {
  cellText,
  parseDateIso,
  parseNumber,
  type RawCell,
  type Table,
  type TableRow,
} from "@/lib/google-sheets/cells";
import { createSheetsClient, type CellUpdate, type SheetsClient } from "@/lib/google-sheets/client";
import { loadSheetsConfig, type SheetsConfig } from "@/lib/google-sheets/config";
import {
  SheetsConflictError,
  SheetsNotFoundError,
  SheetsStructureError,
} from "@/lib/google-sheets/errors";
import {
  BRANDS,
  CATEGORIES,
  PRICE_HISTORY,
  PRODUCTS,
  SETTINGS,
  type WorksheetDef,
} from "@/lib/google-sheets/worksheets";
import { parseTable } from "@/lib/google-sheets/cells";
import { logger } from "@/lib/logger";
import { STOCK_STATUSES } from "@/features/products/stock";
import { UNIT_CODES } from "@/features/products/units";
import { invalidateSheetsCache } from "./invalidate";
import { buildCatalogue, isSettingKey, parseSettingValue, type Tables } from "./parse";
import { displayOrderSchema, priceSchema, slugRe, specificationsSchema } from "./schemas";
import { readTables } from "./snapshot";
import type { CatalogueBrand, CatalogueCategory, CatalogueProduct, ValidationIssue } from "./types";
import { SheetsValidationError } from "./write-errors";

/**
 * Controlled writes to the spreadsheet (server-only).
 *
 * SECURITY: these functions perform NO authorisation. They must only be called from admin-gated
 * Server Actions / Route Handlers (Phase 7+). Nothing in the customer site may import this module.
 *
 * Safety rules:
 *  - Fresh read before every write; rows are located by stable ID, never by remembered row number.
 *  - The candidate row goes through the SAME validation as reads (formats, enums, units, uniqueness,
 *    category/brand references) and is rejected before any write if it has problems.
 *  - Only the changed cells are written (formulas and unknown columns are never overwritten).
 *  - RAW input mode: text such as "=1+1" is stored as text, never evaluated as a formula.
 *  - Google Sheets has no transactions or unique constraints; a concurrent manual edit between the read
 *    and the write cannot be excluded (optional `expectedUpdatedAt` narrows the window for products).
 */

export type WriteDeps = {
  client: SheetsClient;
  config: SheetsConfig;
  now: () => Date;
  newId: (prefix: string) => string;
  invalidate: () => boolean;
};

const randomId = (prefix: string) => `${prefix}_${randomBytes(6).toString("hex")}`;

function resolve(partial?: Partial<WriteDeps>): WriteDeps {
  const config = partial?.config ?? loadSheetsConfig();
  return {
    config,
    client: partial?.client ?? createSheetsClient({ config }),
    now: partial?.now ?? (() => new Date()),
    newId: partial?.newId ?? randomId,
    invalidate: partial?.invalidate ?? invalidateSheetsCache,
  };
}

// ── input contracts ────────────────────────────────────────────────────────────────────────────

const unitInput = z.object({
  code: z.enum(UNIT_CODES),
  customLabel: z.string().trim().max(40).optional(),
});
const optionalText = (max: number) => z.string().trim().max(max).nullish();

export const productInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().max(80).regex(slugRe),
  sku: optionalText(64),
  categoryId: z.string().trim().min(1).max(64),
  brandId: z.string().trim().min(1).max(64),
  description: z.string().max(10000).optional(),
  specifications: specificationsSchema.optional(),
  imageUrl: optionalText(500),
  price: priceSchema.nullish(),
  unit: unitInput,
  stockStatus: z.enum(STOCK_STATUSES),
  isFeatured: z.boolean(),
  isActive: z.boolean(),
});
export const productPatchSchema = productInputSchema.partial();
export type ProductInput = z.infer<typeof productInputSchema>;
export type ProductPatch = z.infer<typeof productPatchSchema>;

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().max(80).regex(slugRe),
  description: optionalText(1000),
  imageUrl: optionalText(500),
  displayOrder: displayOrderSchema.nullish(),
  isActive: z.boolean(),
});
export const categoryPatchSchema = categoryInputSchema.partial();
export type CategoryInput = z.infer<typeof categoryInputSchema>;
export type CategoryPatch = z.infer<typeof categoryPatchSchema>;

export const brandInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().max(80).regex(slugRe),
  logoUrl: optionalText(500),
  description: optionalText(1000),
  isActive: z.boolean(),
});
export const brandPatchSchema = brandInputSchema.partial();
export type BrandInput = z.infer<typeof brandInputSchema>;
export type BrandPatch = z.infer<typeof brandPatchSchema>;

// ── field → cell mapping ───────────────────────────────────────────────────────────────────────

type Cells = Record<string, RawCell>;

function productCells(p: ProductPatch): Cells {
  const c: Cells = {};
  if (p.name !== undefined) c.product_name = p.name;
  if (p.slug !== undefined) c.slug = p.slug;
  if (p.sku !== undefined) c.sku = p.sku ?? "";
  if (p.categoryId !== undefined) c.category_id = p.categoryId;
  if (p.brandId !== undefined) c.brand_id = p.brandId;
  if (p.description !== undefined) c.description = p.description;
  if (p.specifications !== undefined)
    c.specifications = p.specifications.length ? JSON.stringify(p.specifications) : "";
  if (p.imageUrl !== undefined) c.image_url = p.imageUrl ?? "";
  if (p.price !== undefined) c.price = p.price ?? "";
  if (p.unit !== undefined) {
    c.unit = p.unit.code;
    c.unit_custom = p.unit.code === "CUSTOM" ? (p.unit.customLabel ?? "") : "";
  }
  if (p.stockStatus !== undefined) c.stock_status = p.stockStatus;
  if (p.isFeatured !== undefined) c.is_featured = p.isFeatured;
  if (p.isActive !== undefined) c.is_active = p.isActive;
  return c;
}

function categoryCells(p: CategoryPatch): Cells {
  const c: Cells = {};
  if (p.name !== undefined) c.category_name = p.name;
  if (p.slug !== undefined) c.slug = p.slug;
  if (p.description !== undefined) c.description = p.description ?? "";
  if (p.imageUrl !== undefined) c.image_url = p.imageUrl ?? "";
  if (p.displayOrder !== undefined) c.display_order = p.displayOrder ?? "";
  if (p.isActive !== undefined) c.is_active = p.isActive;
  return c;
}

function brandCells(p: BrandPatch): Cells {
  const c: Cells = {};
  if (p.name !== undefined) c.brand_name = p.name;
  if (p.slug !== undefined) c.slug = p.slug;
  if (p.logoUrl !== undefined) c.logo_url = p.logoUrl ?? "";
  if (p.description !== undefined) c.description = p.description ?? "";
  if (p.isActive !== undefined) c.is_active = p.isActive;
  return c;
}

// ── generic engine ─────────────────────────────────────────────────────────────────────────────

type Entity = {
  label: string;
  def: WorksheetDef;
  key: keyof Tables;
  idColumn: string;
  idPrefix: string;
  stamps: boolean;
};
const PRODUCT: Entity = {
  label: "Product",
  def: PRODUCTS,
  key: "products",
  idColumn: "product_id",
  idPrefix: "prod",
  stamps: true,
};
const CATEGORY: Entity = {
  label: "Category",
  def: CATEGORIES,
  key: "categories",
  idColumn: "category_id",
  idPrefix: "cat",
  stamps: false,
};
const BRAND: Entity = {
  label: "Brand",
  def: BRANDS,
  key: "brands",
  idColumn: "brand_id",
  idPrefix: "brand",
  stamps: false,
};

const lc = (v: RawCell) => cellText(v).toLowerCase();

function withRow(tables: Tables, key: keyof Tables, row: TableRow, replace: boolean): Tables {
  const t = tables[key];
  const rows = replace
    ? t.rows.map((r) => (r.rowNumber === row.rowNumber ? row : r))
    : [...t.rows, row];
  return { ...tables, [key]: { ...t, rows } };
}

/** Header names → known cell map for candidate validation. */
function knownCells(def: WorksheetDef, cells: Cells): Cells {
  const known = new Set<string>([...def.required, ...def.optional]);
  return Object.fromEntries(Object.entries(cells).filter(([k]) => known.has(k)));
}

/** Refuse to write a non-empty value into a column the sheet does not have (e.g. optional unit_custom). */
function assertColumns(table: Table, cells: Cells) {
  const headers = new Set(table.headers.map((h) => h.toLowerCase()));
  const missing = Object.entries(cells)
    .filter(([k, v]) => !headers.has(k) && cellText(v) !== "")
    .map(([k]) => k);
  if (missing.length > 0) {
    throw new SheetsStructureError(
      table.worksheet,
      `cannot store a value because column(s) ${missing.join(", ")} do not exist in the sheet — add the column(s) first`,
      missing,
    );
  }
}

/** Errors always block; warnings block only for columns this write actually sets. */
function blocking(issues: ValidationIssue[], setColumns: Set<string>): ValidationIssue[] {
  return issues.filter(
    (i) => i.severity === "error" || (i.column !== null && setColumns.has(i.column)),
  );
}

const issueKey = (i: ValidationIssue) => `${i.worksheet}|${i.row}|${i.column}|${i.code}`;

/**
 * Validate a candidate change:
 *  1. the edited row must be valid (errors always block; warnings block only for columns being set);
 *  2. the change must not break OTHER rows (e.g. deactivating a category that active products use,
 *     or a slug that now collides) — any NEW error elsewhere rejects the write.
 */
function rowIssues(
  before: Tables,
  after: Tables,
  entity: Entity,
  rowNumber: number,
  setColumns: Set<string>,
) {
  const built = buildCatalogue(after);
  const mine = built.issues.filter((i) => i.worksheet === entity.def.name && i.row === rowNumber);
  const bad = blocking(mine, setColumns);
  if (bad.length > 0) throw new SheetsValidationError(bad);
  const known = new Set(buildCatalogue(before).issues.map(issueKey));
  const caused = built.issues.filter((i) => i.severity === "error" && !known.has(issueKey(i)));
  if (caused.length > 0) throw new SheetsValidationError(caused);
  return built;
}

async function createRow(entity: Entity, cells: Cells, deps: WriteDeps) {
  const tables = await readTables(deps.client);
  const table = tables[entity.key];
  const used = new Set(table.rows.map((r) => lc(r.cells[entity.idColumn])));
  let id = deps.newId(entity.idPrefix);
  while (used.has(id.toLowerCase())) id = deps.newId(entity.idPrefix);

  const stamp = deps.now().toISOString();
  const full: Cells = {
    ...cells,
    [entity.idColumn]: id,
    ...(entity.stamps ? { created_at: stamp, updated_at: stamp } : {}),
  };
  assertColumns(table, full);

  const rowNumber = Math.max(1, ...table.rows.map((r) => r.rowNumber)) + 1;
  const candidate = withRow(
    tables,
    entity.key,
    { rowNumber, cells: knownCells(entity.def, full), raw: [] },
    false,
  );
  const built = rowIssues(tables, candidate, entity, rowNumber, new Set(Object.keys(full)));

  const values = table.headers.map((h) => full[h.toLowerCase()] ?? "");
  const res = await deps.client.appendRow(entity.def.name, values);
  deps.invalidate();
  logger.info("sheets_row_created", { worksheet: entity.def.name, id });
  return { id, rowNumber: res.rowNumber, built };
}

async function updateRow(
  entity: Entity,
  id: string,
  changes: Cells,
  deps: WriteDeps,
  opts: { expectedUpdatedAt?: string | null } = {},
) {
  const tables = await readTables(deps.client);
  const table = tables[entity.key];
  const matches = table.rows.filter((r) => lc(r.cells[entity.idColumn]) === id.toLowerCase());
  if (matches.length === 0) throw new SheetsNotFoundError(`${entity.label} "${id}"`);
  if (matches.length > 1)
    throw new SheetsConflictError(
      `${entity.label} id "${id}" appears on rows ${matches.map((m) => m.rowNumber).join(", ")}; fix the duplicate in the sheet first`,
    );
  const existing = matches[0];

  if (entity.stamps && opts.expectedUpdatedAt !== undefined) {
    if (
      comparableDate(existing.cells.updated_at) !==
      comparableDate(opts.expectedUpdatedAt === null ? "" : opts.expectedUpdatedAt)
    ) {
      throw new SheetsConflictError(
        `${entity.label} "${id}" was modified after it was loaded (updated_at differs)`,
      );
    }
  }

  const set: Cells = {
    ...changes,
    ...(entity.stamps ? { updated_at: deps.now().toISOString() } : {}),
  };
  assertColumns(table, set);
  const merged = { ...existing.cells, ...knownCells(entity.def, set) };
  const candidate = withRow(tables, entity.key, { ...existing, cells: merged }, true);
  const built = rowIssues(
    tables,
    candidate,
    entity,
    existing.rowNumber,
    new Set(Object.keys(changes)),
  );

  const headerIndex = new Map(table.headers.map((h, i) => [h.toLowerCase(), i]));
  const updates: CellUpdate[] = [];
  for (const [col, value] of Object.entries(set)) {
    const idx = headerIndex.get(col);
    if (idx === undefined) continue; // empty value for a column the sheet lacks: nothing to store
    if (
      col !== "updated_at" &&
      cellText(existing.raw[idx]) === cellText(value) &&
      typeof existing.raw[idx] === typeof value
    )
      continue;
    updates.push({ rowNumber: existing.rowNumber, columnIndex: idx, value });
  }
  const real = updates.filter((u) => table.headers[u.columnIndex]?.toLowerCase() !== "updated_at");
  if (real.length === 0) return { built, existing, wrote: false };

  await deps.client.updateCells(entity.def.name, updates);
  deps.invalidate();
  logger.info("sheets_row_updated", { worksheet: entity.def.name, id, columns: real.length });
  return { built, existing, wrote: true };
}

/** Blank → null; valid ISO/serial date → ISO string; anything else → "invalid" (never equal to a real date). */
function comparableDate(v: RawCell): string | null {
  if (cellText(v) === "") return null;
  const d = parseDateIso(v);
  return d.ok ? d.value : "invalid";
}

// ── public API ─────────────────────────────────────────────────────────────────────────────────

export async function createProduct(
  input: ProductInput,
  partial?: Partial<WriteDeps>,
): Promise<CatalogueProduct> {
  const data = productInputSchema.parse(input);
  const deps = resolve(partial);
  const { id, built } = await createRow(PRODUCT, productCells(data), deps);
  return built.products.find((p) => p.id === id)!;
}

export type UpdateProductOptions = {
  /** Reject if the row's updated_at differs (someone changed it since it was loaded). */
  expectedUpdatedAt?: string | null;
  /** Required (non-empty) when price history is enabled and the price changes. */
  updatedBy?: string;
};

export async function updateProduct(
  id: string,
  patch: ProductPatch,
  options: UpdateProductOptions = {},
  partial?: Partial<WriteDeps>,
): Promise<{ product: CatalogueProduct; priceHistoryRecorded: boolean | null }> {
  const data = productPatchSchema.parse(patch);
  const deps = resolve(partial);

  // Price history is checked BEFORE the product write so a misconfigured history sheet cannot cause a partial write.
  let history: Table | null = null;
  const touchesPrice = data.price !== undefined;
  if (touchesPrice && deps.config.priceHistoryEnabled) {
    const who = options.updatedBy?.trim();
    if (!who || who.length > 100) {
      throw new SheetsValidationError([
        {
          worksheet: PRICE_HISTORY.name,
          row: null,
          column: "updated_by",
          severity: "error",
          code: "MISSING_REQUIRED",
          message: "updated_by is required to record a price change",
        },
      ]);
    }
    const raw = await deps.client.readWorksheets([PRICE_HISTORY.name]);
    history = parseTable(raw[PRICE_HISTORY.name], PRICE_HISTORY);
  }

  const result = await updateRow(PRODUCT, id, productCells(data), deps, {
    expectedUpdatedAt: options.expectedUpdatedAt,
  });
  const product = result.built.products.find((p) => p.id.toLowerCase() === id.toLowerCase())!;

  let priceHistoryRecorded: boolean | null = null;
  if (history) {
    const prevParsed = parseNumber(result.existing.cells.price);
    const previous = prevParsed.ok ? prevParsed.value : null;
    const next = data.price ?? null;
    if (previous !== next) {
      const now = deps.now().toISOString();
      const cells: Cells = {
        history_id: deps.newId("ph"),
        product_id: product.id,
        previous_price: previous ?? "",
        new_price: next ?? "",
        updated_at: now,
        updated_by: options.updatedBy!.trim(),
      };
      try {
        await deps.client.appendRow(
          PRICE_HISTORY.name,
          history.headers.map((h) => cells[h.toLowerCase()] ?? ""),
        );
        priceHistoryRecorded = true;
      } catch (error) {
        // The product update already succeeded; report the gap instead of pretending nothing happened.
        priceHistoryRecorded = false;
        logger.error("sheets_price_history_failed", { productId: product.id, error });
      }
    }
  }
  return { product, priceHistoryRecorded };
}

export async function createCategory(
  input: CategoryInput,
  partial?: Partial<WriteDeps>,
): Promise<CatalogueCategory> {
  const data = categoryInputSchema.parse(input);
  const { id, built } = await createRow(CATEGORY, categoryCells(data), resolve(partial));
  return built.categories.find((c) => c.id === id)!;
}

export async function updateCategory(
  id: string,
  patch: CategoryPatch,
  partial?: Partial<WriteDeps>,
): Promise<CatalogueCategory> {
  const data = categoryPatchSchema.parse(patch);
  const { built } = await updateRow(CATEGORY, id, categoryCells(data), resolve(partial));
  return built.categories.find((c) => c.id.toLowerCase() === id.toLowerCase())!;
}

export async function createBrand(
  input: BrandInput,
  partial?: Partial<WriteDeps>,
): Promise<CatalogueBrand> {
  const data = brandInputSchema.parse(input);
  const { id, built } = await createRow(BRAND, brandCells(data), resolve(partial));
  return built.brands.find((b) => b.id === id)!;
}

export async function updateBrand(
  id: string,
  patch: BrandPatch,
  partial?: Partial<WriteDeps>,
): Promise<CatalogueBrand> {
  const data = brandPatchSchema.parse(patch);
  const { built } = await updateRow(BRAND, id, brandCells(data), resolve(partial));
  return built.brands.find((b) => b.id.toLowerCase() === id.toLowerCase())!;
}

/** Set one business setting (creates the row when missing). Only recognised keys with valid values are accepted. */
export async function setBusinessSetting(
  key: string,
  value: string,
  partial?: Partial<WriteDeps>,
): Promise<void> {
  const k = key.trim().toLowerCase();
  const v = value.trim();
  const reject = (message: string): never => {
    throw new SheetsValidationError([
      {
        worksheet: SETTINGS.name,
        row: null,
        column: "setting_key",
        severity: "error",
        code: "INVALID_SETTING",
        message,
      },
    ]);
  };
  if (!isSettingKey(k)) reject(`"${k.slice(0, 40)}" is not a recognised setting`);
  const parsed = parseSettingValue(k, v);
  if (!parsed.ok) reject(`${k} ${parsed.message}`);

  const deps = resolve(partial);
  const tables = await readTables(deps.client);
  const rows = tables.settings.rows.filter((r) => lc(r.cells.setting_key) === k);
  if (rows.length > 1)
    throw new SheetsConflictError(
      `setting "${k}" appears on rows ${rows.map((r) => r.rowNumber).join(", ")}; fix the duplicate in the sheet first`,
    );

  const headers = tables.settings.headers.map((h) => h.toLowerCase());
  if (rows.length === 1) {
    await deps.client.updateCells(SETTINGS.name, [
      { rowNumber: rows[0].rowNumber, columnIndex: headers.indexOf("setting_value"), value: v },
    ]);
  } else {
    await deps.client.appendRow(
      SETTINGS.name,
      headers.map((h) => (h === "setting_key" ? k : h === "setting_value" ? v : "")),
    );
  }
  deps.invalidate();
  logger.info("sheets_setting_written", { key: k });
}
