// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseTable } from "@/lib/google-sheets/cells";
import { BRANDS, CATEGORIES, PRODUCTS, SETTINGS } from "@/lib/google-sheets/worksheets";
import { buildCatalogue } from "./parse";

/** Simple RFC 4180 CSV parser for testing demo CSV files. */
function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentField);
        currentField = "";
      } else if (char === "\r" && nextChar === "\n") {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = "";
        i++;
      } else if (char === "\n") {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = "";
      } else {
        currentField += char;
      }
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows.filter((r) => r.length > 0 && r.some((c) => c.trim() !== ""));
}

describe("demo data CSV validation", () => {
  const dir = join(process.cwd(), "docs", "sheets-template", "demo-data");

  const categoriesRaw = parseCsv(readFileSync(join(dir, "categories-demo.csv"), "utf8"));
  const brandsRaw = parseCsv(readFileSync(join(dir, "brands-demo.csv"), "utf8"));
  const productsRaw = parseCsv(readFileSync(join(dir, "products-demo.csv"), "utf8"));
  const settingsRaw = parseCsv(readFileSync(join(dir, "business-settings-demo.csv"), "utf8"));

  it("matches worksheet column definitions", () => {
    expect(() => parseTable(categoriesRaw, CATEGORIES)).not.toThrow();
    expect(() => parseTable(brandsRaw, BRANDS)).not.toThrow();
    expect(() => parseTable(productsRaw, PRODUCTS)).not.toThrow();
    expect(() => parseTable(settingsRaw, SETTINGS)).not.toThrow();
  });

  it("builds a 100% valid catalogue with 0 validation errors", () => {
    const tables = {
      categories: parseTable(categoriesRaw, CATEGORIES),
      brands: parseTable(brandsRaw, BRANDS),
      products: parseTable(productsRaw, PRODUCTS),
      settings: parseTable(settingsRaw, SETTINGS),
    };

    const built = buildCatalogue(tables);
    const errors = built.issues.filter((i) => i.severity === "error");

    expect(errors).toEqual([]);
    expect(built.stats.categories.valid).toBe(6);
    expect(built.stats.brands.valid).toBe(6);
    expect(built.stats.products.valid).toBe(22);
    expect(built.settings.whyChooseUs.length).toBe(6);
    expect(built.settings.businessName).toBe("Sagar Traders");
    expect(built.settings.phone).toBe("+91 91234 56789");
  });
});
