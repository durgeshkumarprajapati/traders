/**
 * Test helpers only (never imported by application code): a fake in-memory spreadsheet that
 * implements the SheetsClient interface, a scripted fetch, an RSA key generator and fixtures.
 * All values are obviously fake test data.
 */
import { generateKeyPairSync } from "node:crypto";
import type { SheetsClient, CellUpdate } from "./client";
import type { SheetsConfig } from "./config";
import type { RawValues } from "./cells";
import type { HttpDeps } from "./http";
import { BRANDS, CATEGORIES, PRICE_HISTORY, PRODUCTS, SETTINGS } from "./worksheets";

export function makeKeyPair() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  return { privateKey, publicKey };
}

export const TEST_SHEET_ID = "test-sheet-id-0123456789abcdef";
export const TEST_EMAIL = "svc@test-project.iam.gserviceaccount.com";

export function testConfig(privateKey: string, over: Partial<SheetsConfig> = {}): SheetsConfig {
  return {
    clientEmail: TEST_EMAIL,
    privateKey,
    spreadsheetId: TEST_SHEET_ID,
    priceHistoryEnabled: false,
    ...over,
  };
}

// ── fixtures ───────────────────────────────────────────────────────────────────────────────────

export const PRODUCT_HEADERS = [...PRODUCTS.required, ...PRODUCTS.optional];
export const CATEGORY_HEADERS = [...CATEGORIES.required];
export const BRAND_HEADERS = [...BRANDS.required];

const pick = (
  headers: readonly string[],
  base: Record<string, unknown>,
  over: Record<string, unknown>,
) => headers.map((h) => ({ ...base, ...over })[h] ?? "");

export const productRow = (over: Record<string, unknown> = {}) =>
  pick(
    PRODUCT_HEADERS,
    {
      product_id: "prod_1",
      product_name: "Sample Product 1",
      slug: "sample-product-1",
      sku: "",
      category_id: "cat_1",
      brand_id: "brand_1",
      description: "Test description",
      specifications: "",
      image_url: "",
      price: 100,
      unit: "BAG",
      unit_custom: "",
      stock_status: "IN_STOCK",
      is_featured: false,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    over,
  );
export const categoryRow = (over: Record<string, unknown> = {}) =>
  pick(
    CATEGORY_HEADERS,
    {
      category_id: "cat_1",
      category_name: "Category 1",
      slug: "category-1",
      description: "",
      image_url: "",
      display_order: 1,
      is_active: true,
    },
    over,
  );
export const brandRow = (over: Record<string, unknown> = {}) =>
  pick(
    BRAND_HEADERS,
    {
      brand_id: "brand_1",
      brand_name: "Brand 1",
      slug: "brand-1",
      logo_url: "",
      description: "",
      is_active: true,
    },
    over,
  );

export function baseSheets(): Record<string, unknown[][]> {
  return {
    [PRODUCTS.name]: [PRODUCT_HEADERS, productRow()],
    [CATEGORIES.name]: [
      CATEGORY_HEADERS,
      categoryRow(),
      categoryRow({
        category_id: "cat_2",
        category_name: "Category 2",
        slug: "category-2",
        display_order: 2,
      }),
    ],
    [BRANDS.name]: [
      BRAND_HEADERS,
      brandRow(),
      brandRow({ brand_id: "brand_2", brand_name: "Brand 2", slug: "brand-2" }),
    ],
    [SETTINGS.name]: [
      ["setting_key", "setting_value"],
      ["business_name", "Test Business"],
    ],
  };
}

export const historySheet = (): unknown[][] => [[...PRICE_HISTORY.required]];

// ── fake spreadsheet (SheetsClient) ────────────────────────────────────────────────────────────

export class FakeSheets implements SheetsClient {
  calls: string[] = [];
  failOn: Partial<Record<"read" | "update" | "append", Error>> = {};
  constructor(public sheets: Record<string, unknown[][]> = baseSheets()) {}

  async readWorksheets(names: readonly string[]): Promise<Record<string, RawValues>> {
    this.calls.push("read");
    if (this.failOn.read) throw this.failOn.read;
    return Object.fromEntries(
      names.map((n) => [n, this.sheets[n] ? structuredClone(this.sheets[n]) : undefined]),
    );
  }
  async updateCells(worksheet: string, updates: CellUpdate[]): Promise<void> {
    this.calls.push("update");
    if (this.failOn.update) throw this.failOn.update;
    for (const u of updates) {
      const row = (this.sheets[worksheet][u.rowNumber - 1] ??= []);
      while (row.length <= u.columnIndex) row.push("");
      row[u.columnIndex] = u.value;
    }
  }
  async appendRow(worksheet: string, values: unknown[]): Promise<{ rowNumber: number | null }> {
    this.calls.push(`append:${worksheet}`);
    if (this.failOn.append) throw this.failOn.append;
    this.sheets[worksheet].push([...values]);
    return { rowNumber: this.sheets[worksheet].length };
  }
  /** Header-keyed view of a data row (1-based sheet row number). */
  row(worksheet: string, rowNumber: number): Record<string, unknown> {
    const [headers, ...rest] = this.sheets[worksheet];
    void rest;
    const r = this.sheets[worksheet][rowNumber - 1] ?? [];
    return Object.fromEntries((headers as string[]).map((h, i) => [h, r[i]]));
  }
}

// ── scripted fetch (HTTP level) ────────────────────────────────────────────────────────────────

export type Scripted =
  Response | Error | ((url: string, init: RequestInit) => Response | Promise<Response> | Error);

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

/** Fetch that answers from a queue, records requests, and honours AbortSignal (for timeout tests). */
export function scriptedHttp(script: Scripted[]) {
  const requests: { url: string; init: RequestInit }[] = [];
  const sleeps: number[] = [];
  let clock = 1_700_000_000_000;
  const deps: HttpDeps = {
    fetch: async (url, init = {}) => {
      requests.push({ url, init });
      const next = script.shift();
      if (next === undefined) throw new Error(`unexpected request to ${url}`);
      const r = typeof next === "function" ? next(url, init) : next;
      const res = await r;
      if (res instanceof Error) throw res;
      return res;
    },
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
    random: () => 0,
    now: () => clock,
  };
  return { deps, requests, sleeps, remaining: () => script.length };
}

/** A fetch that never settles until aborted (simulates a hung connection). */
export const hang: Scripted = (_url, init) =>
  new Promise<Response>((_resolve, reject) => {
    init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
  });
