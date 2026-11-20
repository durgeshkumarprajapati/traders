// @vitest-environment node
import { cellText, parseBoolean, parseDateIso, parseNumber, parseTable } from "./cells";
import { SheetsStructureError } from "./errors";
import { BRANDS, PRODUCTS, SETTINGS } from "./worksheets";
import { PRODUCT_HEADERS, productRow } from "./test-utils";

describe("parseTable (worksheet mapping)", () => {
  it("maps columns by header NAME (any order, any case), skipping blank rows, with real row numbers", () => {
    const headers = ["Setting_Value", "SETTING_KEY", "notes"]; // reordered, mixed case, extra column
    const t = parseTable([headers, ["v1", "k1", "n"], ["", "", ""], ["v2", "k2"]], SETTINGS);
    expect(t.rows.map((r) => [r.rowNumber, r.cells.setting_key, r.cells.setting_value])).toEqual([
      [2, "k1", "v1"],
      [4, "k2", "v2"], // blank row 3 skipped; row numbers are sheet rows
    ]);
    expect(t.headers).toEqual(headers);
    expect(t.rows[0].cells.notes).toBeUndefined(); // unknown columns are not mapped...
    expect(t.rows[0].raw).toEqual(["v1", "k1", "n"]); // ...but preserved in the raw row
  });

  it("treats a header-only worksheet as valid and empty", () => {
    const t = parseTable([["setting_key", "setting_value"]], SETTINGS);
    expect(t.rows).toEqual([]);
  });

  it("treats a completely blank worksheet as a structure error, not 'zero products'", () => {
    for (const v of [undefined, [], [[]], [["", " "]]]) {
      expect(() => parseTable(v, PRODUCTS)).toThrow(SheetsStructureError);
    }
  });

  it("reports missing required columns by name", () => {
    try {
      parseTable([["brand_id", "brand_name"]], BRANDS);
      expect.unreachable();
    } catch (e) {
      expect((e as SheetsStructureError).missingColumns).toEqual([
        "slug",
        "logo_url",
        "description",
        "is_active",
      ]);
      expect((e as SheetsStructureError).worksheet).toBe("Brands");
    }
  });

  it("rejects duplicate headers and allows optional columns to be absent", () => {
    let thrown: unknown;
    try {
      parseTable([["setting_key", "setting_value", "Setting_Key"]], SETTINGS);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(SheetsStructureError);
    expect((thrown as SheetsStructureError).detail).toMatch(/duplicate header/);
    const withoutCustom = PRODUCT_HEADERS.filter((h) => h !== "unit_custom");
    expect(() => parseTable([withoutCustom], PRODUCTS)).not.toThrow();
  });

  it("pads short rows (Sheets omits trailing blanks)", () => {
    const t = parseTable([PRODUCT_HEADERS, productRow().slice(0, 3)], PRODUCTS);
    expect(t.rows[0].cells.price).toBeUndefined();
    expect(t.rows[0].raw).toHaveLength(PRODUCT_HEADERS.length);
  });
});

describe("cell coercion", () => {
  it("cellText stringifies and trims", () => {
    expect([
      cellText(null),
      cellText(undefined),
      cellText(" a "),
      cellText(12),
      cellText(true),
      cellText(false),
    ]).toEqual(["", "", "a", "12", "TRUE", "FALSE"]);
  });
  it("parseBoolean accepts checkbox/boolean/text forms only", () => {
    for (const t of [true, "TRUE", "true", "yes", "1", 1])
      expect(parseBoolean(t)).toEqual({ ok: true, value: true });
    for (const f of [false, "FALSE", "no", "0", 0])
      expect(parseBoolean(f)).toEqual({ ok: true, value: false });
    for (const bad of ["", "maybe", 2, "y"]) expect(parseBoolean(bad).ok).toBe(false);
  });
  it("parseNumber is strict (no currency, no separators, no NaN)", () => {
    expect(parseNumber(385)).toEqual({ ok: true, value: 385 });
    expect(parseNumber("385.50")).toEqual({ ok: true, value: 385.5 });
    for (const bad of ["₹385", "1,234", "385/-", "abc", "", Number.NaN, Infinity, "1e3"])
      expect(parseNumber(bad).ok).toBe(false);
  });
  it("parseDateIso accepts ISO strings and Sheets serial dates, rejects the rest", () => {
    expect(parseDateIso("2026-11-18T10:30:00Z")).toEqual({
      ok: true,
      value: "2026-11-18T10:30:00.000Z",
    });
    expect(parseDateIso("2026-11-18")).toEqual({ ok: true, value: "2026-11-18T00:00:00.000Z" });
    expect(parseDateIso(46344)).toEqual({ ok: true, value: "2026-11-18T00:00:00.000Z" }); // serial 46344 = 2026-11-18
    for (const bad of ["18/11/2026", "not a date", "2026-13-45", "", 0, -4])
      expect(parseDateIso(bad).ok).toBe(false);
  });
});
