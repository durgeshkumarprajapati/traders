import "server-only";
import { parseTable } from "@/lib/google-sheets/cells";
import type { SheetsReader } from "@/lib/google-sheets/client";
import { BRANDS, CATEGORIES, PRODUCTS, SETTINGS } from "@/lib/google-sheets/worksheets";
import { logger } from "@/lib/logger";
import { buildCatalogue, type Tables } from "./parse";
import type { CatalogueSnapshot } from "./types";

/** One batched request for all four worksheets, then structural validation of each header row. */
export async function readTables(client: SheetsReader): Promise<Tables> {
  const raw = await client.readWorksheets([
    PRODUCTS.name,
    CATEGORIES.name,
    BRANDS.name,
    SETTINGS.name,
  ]);
  return {
    products: parseTable(raw[PRODUCTS.name], PRODUCTS),
    categories: parseTable(raw[CATEGORIES.name], CATEGORIES),
    brands: parseTable(raw[BRANDS.name], BRANDS),
    settings: parseTable(raw[SETTINGS.name], SETTINGS),
  };
}

/**
 * Read + validate the whole spreadsheet.
 *  - API/auth/config/structure failure ⇒ THROWS (never an empty or invented catalogue).
 *  - A worksheet with only a header row ⇒ valid, empty arrays (distinct from a failure).
 *  - Malformed rows ⇒ excluded/degraded and listed in `issues`; the rest of the catalogue is intact.
 */
export async function fetchSheetsSnapshot(
  client: SheetsReader,
  now: () => Date = () => new Date(),
): Promise<CatalogueSnapshot> {
  const started = Date.now();
  try {
    const { rowNumbers: _rows, ...built } = buildCatalogue(await readTables(client));
    void _rows;
    const errors = built.issues.filter((i) => i.severity === "error").length;
    logger.info("sheets_snapshot_loaded", {
      durationMs: Date.now() - started,
      products: built.stats.products,
      categories: built.stats.categories,
      brands: built.stats.brands,
      errors,
      warnings: built.issues.length - errors,
    });
    if (built.issues.length > 0)
      logger.warn("sheets_data_issues", {
        count: built.issues.length,
        sample: built.issues.slice(0, 20),
      });
    return { fetchedAt: now().toISOString(), ...built };
  } catch (error) {
    logger.error("sheets_snapshot_failed", { durationMs: Date.now() - started, error });
    throw error;
  }
}
