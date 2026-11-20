import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createSheetsReader } from "@/lib/google-sheets/client";
import { loadSheetsConfig } from "@/lib/google-sheets/config";
import { SHEETS_CACHE_TAG } from "./constants";
import { fetchSheetsSnapshot } from "./snapshot";
import type { CatalogueSnapshot } from "./types";

/**
 * Cached read of the spreadsheet — the ONLY way server components should obtain catalogue data.
 *
 * `use cache: remote` stores the entry in the platform's shared cache handler (Vercel provides one),
 * so it is shared across serverless instances and does not rely on process memory — plain `use cache`
 * is per-instance in-memory on serverless and would hit the Sheets API far more often (quota!).
 * Self-hosting needs a `cacheHandlers` configuration for the same guarantee.
 *
 * Failures THROW and are therefore never cached; callers must treat a throw as "data unavailable"
 * and must not substitute invented data. Policy: stale 60 s / revalidate 300 s / expire 1800 s
 * (= maximum acceptable staleness). Invalidate with `invalidateSheetsCache()` after writes.
 */
export async function getSheetsSnapshot(): Promise<CatalogueSnapshot> {
  "use cache: remote";
  cacheLife({ stale: 60, revalidate: 300, expire: 1800 });
  cacheTag(SHEETS_CACHE_TAG);
  return fetchSheetsSnapshot(createSheetsReader({ config: loadSheetsConfig() }));
}
