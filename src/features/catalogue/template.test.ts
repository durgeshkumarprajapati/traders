// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BRANDS,
  CATEGORIES,
  PRICE_HISTORY,
  PRODUCTS,
  SETTINGS,
  type WorksheetDef,
} from "@/lib/google-sheets/worksheets";
import { isSettingKey, parseSettings } from "./parse";
import { parseTable } from "@/lib/google-sheets/cells";

const dir = join(process.cwd(), "docs", "sheets-template");
const lines = (name: string) =>
  readFileSync(join(dir, `${name}.csv`), "utf8")
    .trim()
    .split("\n");

describe("spreadsheet template stays in sync with the code", () => {
  it.each([PRODUCTS, CATEGORIES, BRANDS, SETTINGS, PRICE_HISTORY] as WorksheetDef[])(
    "$name.csv headers match the worksheet contract",
    (def) => {
      const headers = lines(def.name)[0].split(",");
      expect(new Set(headers)).toEqual(new Set([...def.required, ...def.optional]));
      expect(() => parseTable([headers], def)).not.toThrow();
    },
  );

  it("BusinessSettings.csv lists only recognised keys and parses with no issues when blank", () => {
    const rows = lines("BusinessSettings")
      .slice(1)
      .map((l) => l.split(","));
    expect(rows.every(([k]) => isSettingKey(k))).toBe(true);
    const issues: Parameters<typeof parseSettings>[1] = [];
    parseSettings(parseTable([["setting_key", "setting_value"], ...rows], SETTINGS), issues);
    expect(issues).toEqual([]);
  });
});
