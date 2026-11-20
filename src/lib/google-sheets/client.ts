import "server-only";
import { z } from "zod";
import { createTokenProvider, type TokenProvider } from "./auth";
import type { SheetsConfig } from "./config";
import { SheetsApiError, SheetsStructureError } from "./errors";
import {
  APPEND_POLICY,
  IDEMPOTENT_WRITE_POLICY,
  READ_POLICY,
  defaultHttpDeps,
  fetchWithPolicy,
  type HttpDeps,
  type RequestPolicy,
} from "./http";
import type { RawValues } from "./cells";
import { MAX_ROWS } from "./worksheets";

const API = "https://sheets.googleapis.com/v4/spreadsheets";
const LAST_COLUMN = "Z"; // all worksheets are well under 26 columns

const batchResponse = z.object({
  valueRanges: z.array(
    z.object({ range: z.string().optional(), values: z.array(z.array(z.unknown())).optional() }),
  ),
});
const updateResponse = z.object({ totalUpdatedCells: z.number().optional() });
const appendResponse = z.object({
  updates: z
    .object({ updatedRange: z.string().optional(), updatedRows: z.number().optional() })
    .optional(),
});
const googleError = z.object({
  error: z.object({ status: z.string().optional(), message: z.string().optional() }).optional(),
});

export type SheetsReader = Pick<SheetsClient, "readWorksheets">;

export type SheetsClient = {
  /** Read several worksheets in ONE request. Resolves worksheet name → raw values (undefined when the sheet is blank). */
  readWorksheets(names: readonly string[]): Promise<Record<string, RawValues>>;
  /** Write ONLY the listed cells (idempotent batch update); other cells in the row — formulas, unknown columns — are never touched. */
  updateCells(worksheet: string, updates: CellUpdate[]): Promise<void>;
  /** Append one row (NOT retried on timeout/5xx — may already have been applied). Returns the new row number when reported. */
  appendRow(worksheet: string, values: unknown[]): Promise<{ rowNumber: number | null }>;
};

export type CellUpdate = { rowNumber: number; columnIndex: number; value: unknown };

/** 0-based column index → A1 letters (0 → A, 25 → Z). Columns beyond Z are not supported. */
export function columnLetter(index: number): string {
  if (!Number.isInteger(index) || index < 0 || index > 25)
    throw new SheetsApiError(`Column index ${index} is outside A–Z`, null, false);
  return String.fromCharCode(65 + index);
}

const quote = (sheet: string) => `'${sheet.replace(/'/g, "''")}'`;

export type SheetsClientOptions = {
  config: SheetsConfig;
  deps?: HttpDeps;
  tokens?: TokenProvider;
};

function createTransport({ config, deps = defaultHttpDeps, tokens }: SheetsClientOptions) {
  const auth = tokens ?? createTokenProvider(config, deps);
  const base = `${API}/${encodeURIComponent(config.spreadsheetId)}`;

  async function call(
    url: string,
    init: RequestInit,
    scope: "read" | "write",
    policy: RequestPolicy,
  ): Promise<unknown> {
    const token = await auth.getAccessToken(scope);
    const res = await fetchWithPolicy(
      url,
      {
        ...init,
        headers: {
          ...(init.headers as Record<string, string> | undefined),
          authorization: `Bearer ${token}`,
          accept: "application/json",
        },
      },
      policy,
      deps,
    );
    const body: unknown = await res.json().catch(() => null);
    if (res.ok) return body;

    const g = googleError.safeParse(body);
    const message = (g.success ? g.data.error?.message : undefined)?.slice(0, 200) ?? "";
    const missing = /Unable to parse range: '?([^'!]+)'?!/.exec(message);
    if (res.status === 400 && missing) {
      throw new SheetsStructureError(
        missing[1],
        "the worksheet (tab) does not exist or is misnamed",
      );
    }
    if (res.status === 401 || res.status === 403) {
      throw new SheetsApiError(
        `Google denied access (HTTP ${res.status}). Share the spreadsheet with the service-account e-mail (Viewer for reads, Editor for writes) and enable the Google Sheets API`,
        res.status,
        false,
      );
    }
    if (res.status === 404)
      throw new SheetsApiError("The spreadsheet was not found. Check GOOGLE_SHEET_ID", 404, false);
    if (res.status === 429)
      throw new SheetsApiError(
        "Google Sheets API quota exceeded (HTTP 429) after retries",
        429,
        true,
      );
    throw new SheetsApiError(
      `Google Sheets API error (HTTP ${res.status}${message ? `: ${message}` : ""})`,
      res.status,
      res.status >= 500,
    );
  }

  return { base, call };
}

type Transport = ReturnType<typeof createTransport>;

/**
 * Read-only client: has NO write methods, so code that only reads (the customer-facing cache) does not
 * even bundle the write calls. Uses the read-only OAuth scope.
 */
export function createSheetsReader(
  opts: SheetsClientOptions,
  transport: Transport = createTransport(opts),
): SheetsReader {
  const { base, call } = transport;
  return {
    async readWorksheets(names) {
      const params = new URLSearchParams({
        majorDimension: "ROWS",
        valueRenderOption: "UNFORMATTED_VALUE",
        dateTimeRenderOption: "SERIAL_NUMBER",
      });
      for (const n of names)
        params.append("ranges", `${quote(n)}!A1:${LAST_COLUMN}${MAX_ROWS + 1}`);
      const body = await call(
        `${base}/values:batchGet?${params}`,
        { method: "GET" },
        "read",
        READ_POLICY,
      );
      const parsed = batchResponse.safeParse(body);
      if (!parsed.success || parsed.data.valueRanges.length !== names.length) {
        throw new SheetsApiError(
          "Google Sheets returned an unexpected response shape",
          null,
          false,
        );
      }
      const out: Record<string, RawValues> = {};
      names.forEach((n, i) => {
        const values = parsed.data.valueRanges[i].values;
        if (values && values.length > MAX_ROWS + 1) {
          throw new SheetsStructureError(
            n,
            `has more than ${MAX_ROWS} data rows, which exceeds the supported limit`,
          );
        }
        out[n] = values;
      });
      return out;
    },
  };
}

/** Read-write client for admin-gated code only (write.ts). Writes use the full-access OAuth scope. */
export function createSheetsClient(opts: SheetsClientOptions): SheetsClient {
  const transport = createTransport(opts);
  const { base, call } = transport;
  return {
    ...createSheetsReader(opts, transport),
    async updateCells(worksheet, updates) {
      if (updates.length === 0) return;
      const data = updates.map((u) => ({
        range: `${quote(worksheet)}!${columnLetter(u.columnIndex)}${u.rowNumber}`,
        majorDimension: "ROWS",
        values: [[u.value]],
      }));
      const body = await call(
        `${base}/values:batchUpdate`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ valueInputOption: "RAW", data }),
        },
        "write",
        IDEMPOTENT_WRITE_POLICY,
      );
      const parsed = updateResponse.safeParse(body);
      if (!parsed.success || (parsed.data.totalUpdatedCells ?? 0) < updates.length) {
        throw new SheetsApiError("Google Sheets did not confirm every cell update", null, false);
      }
    },

    async appendRow(worksheet, values) {
      const range = `${quote(worksheet)}!A:${LAST_COLUMN}`;
      const body = await call(
        `${base}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ majorDimension: "ROWS", values: [values] }),
        },
        "write",
        APPEND_POLICY,
      );
      const parsed = appendResponse.safeParse(body);
      if (!parsed.success || !parsed.data.updates?.updatedRows) {
        throw new SheetsApiError("Google Sheets did not confirm the appended row", null, false);
      }
      const match = /!?[A-Z]+(\d+):/.exec(parsed.data.updates.updatedRange ?? "");
      return { rowNumber: match ? Number(match[1]) : null };
    },
  };
}
