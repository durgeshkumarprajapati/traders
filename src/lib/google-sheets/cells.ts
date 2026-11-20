import { SheetsStructureError } from "./errors";
import type { WorksheetDef } from "./worksheets";

export type RawValues = unknown[][] | undefined;
export type RawCell = unknown;

export type TableRow = {
  /** 1-based spreadsheet row number (header = 1). For reporting only — never an identifier. */
  rowNumber: number;
  cells: Record<string, RawCell>;
  /** The complete original row (all columns, including unknown ones). */
  raw: RawCell[];
};

export type Table = {
  worksheet: string;
  /** Header names exactly as they appear in the sheet, in sheet order. */
  headers: string[];
  rows: TableRow[];
};

/** Cell → trimmed text. Numbers/booleans are stringified; null/undefined → "". */
export function cellText(v: RawCell): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return String(v).trim();
}

/**
 * Map a worksheet's raw values to rows keyed by header name.
 *  - `values` undefined/empty ⇒ the sheet has no header row at all (structure error, NOT "zero products").
 *  - header-only sheet ⇒ valid, zero rows.
 */
export function parseTable(values: RawValues, def: WorksheetDef): Table {
  if (!values || values.length === 0 || values[0].every((h) => cellText(h) === "")) {
    throw new SheetsStructureError(def.name, "the worksheet is empty — the header row is missing", [
      ...def.required,
    ]);
  }
  const rawHeaders = values[0].map((h) => cellText(h));
  const normalised = rawHeaders.map((h) => h.toLowerCase());

  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const h of normalised) {
    if (!h) continue;
    if (seen.has(h)) dupes.add(h);
    seen.add(h);
  }
  if (dupes.size > 0) {
    throw new SheetsStructureError(def.name, `duplicate header(s): ${[...dupes].join(", ")}`);
  }
  const missing = def.required.filter((c) => !seen.has(c));
  if (missing.length > 0) {
    throw new SheetsStructureError(
      def.name,
      `missing required column(s): ${missing.join(", ")}`,
      missing,
    );
  }

  const known = new Set<string>([...def.required, ...def.optional]);
  const rows: TableRow[] = [];
  for (let i = 1; i < values.length; i++) {
    const raw = values[i] ?? [];
    if (raw.every((c) => cellText(c) === "")) continue; // blank row
    const cells: Record<string, RawCell> = {};
    normalised.forEach((h, col) => {
      if (known.has(h)) cells[h] = raw[col];
    });
    rows.push({ rowNumber: i + 1, cells, raw: normalised.map((_, col) => raw[col]) });
  }
  return { worksheet: def.name, headers: rawHeaders, rows };
}

export type Parsed<T> = { ok: true; value: T } | { ok: false };

export function parseBoolean(v: RawCell): Parsed<boolean> {
  if (typeof v === "boolean") return { ok: true, value: v };
  if (typeof v === "number")
    return v === 1
      ? { ok: true, value: true }
      : v === 0
        ? { ok: true, value: false }
        : { ok: false };
  switch (cellText(v).toLowerCase()) {
    case "true":
    case "yes":
    case "1":
      return { ok: true, value: true };
    case "false":
    case "no":
    case "0":
      return { ok: true, value: false };
    default:
      return { ok: false };
  }
}

/** Strict number: a number cell, or a plain decimal string. No currency symbols or thousands separators. */
export function parseNumber(v: RawCell): Parsed<number> {
  if (typeof v === "number") return Number.isFinite(v) ? { ok: true, value: v } : { ok: false };
  const t = cellText(v);
  if (!/^-?\d+(\.\d+)?$/.test(t)) return { ok: false };
  const n = Number(t);
  return Number.isFinite(n) ? { ok: true, value: n } : { ok: false };
}

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);

/** ISO date/time string or a Sheets serial date → ISO-8601 UTC string. */
export function parseDateIso(v: RawCell): Parsed<string> {
  if (typeof v === "number") {
    if (v < 1 || v > 2_958_465) return { ok: false };
    return { ok: true, value: new Date(EXCEL_EPOCH_MS + Math.round(v * 86_400_000)).toISOString() };
  }
  const t = cellText(v);
  if (!/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(t))
    return { ok: false };
  const ms = Date.parse(t.includes("T") || !t.includes(" ") ? t : t.replace(" ", "T"));
  return Number.isNaN(ms) ? { ok: false } : { ok: true, value: new Date(ms).toISOString() };
}
