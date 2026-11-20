import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import {
  emptyBusinessSettings,
  type BusinessSettings,
} from "@/features/settings/business-settings";
import { logger } from "@/lib/logger";
import { getSheetsSnapshot } from "./cache";
import { getStaticCatalogue, getStaticSettings } from "./data/static-catalogue";
import { toPublicCatalogue } from "./public";
import type { CatalogueSnapshot } from "./types";
import { toBusinessSettings, toViewCatalogue, type ViewCatalogue } from "./view";

export type CatalogueSource = "LIVE" | "STATIC";

export type CatalogueLoad =
  | {
      ok: true;
      catalogue: ViewCatalogue;
      settings: BusinessSettings;
      source: CatalogueSource;
      fetchedAt: string;
    }
  | { ok: false };

export type AdminCatalogueLoad =
  { ok: true; snapshot: CatalogueSnapshot } | { ok: false; error: string };

/**
 * The single centralized entry point customer-facing code uses to read catalogue data.
 *
 * Implements strict resolution priority:
 *  - Priority 1: Live Google Sheets catalogue when valid, successfully parsed products exist.
 *  - Priority 2: Static fallback catalogue when Google Sheets fails, cannot connect, has missing
 *    worksheets, returns API/auth errors, or contains no usable products.
 *
 * Guarantees the customer website never becomes empty or broken while preserving data integrity.
 */
export const loadCatalogue = cache(async (): Promise<CatalogueLoad> => {
  await connection();
  try {
    const snap = await getSheetsSnapshot();
    const publicCat = toPublicCatalogue(snap);
    const viewCat = toViewCatalogue(publicCat);

    // If live Google Sheets returned valid active products, use LIVE catalogue
    if (viewCat.products.length > 0) {
      return {
        ok: true,
        catalogue: viewCat,
        settings: toBusinessSettings(snap.settings),
        source: "LIVE",
        fetchedAt: snap.fetchedAt,
      };
    }

    // Live Google Sheets reached but returned no usable products (e.g. empty or default Sheet1)
    logger.warn("catalogue_live_empty_falling_back_to_static");
    const liveSettings = toBusinessSettings(snap.settings);
    return {
      ok: true,
      catalogue: getStaticCatalogue(),
      settings: liveSettings.name ? liveSettings : getStaticSettings(),
      source: "STATIC",
      fetchedAt: snap.fetchedAt,
    };
  } catch (error) {
    // Google Sheets failure: API error, auth error, missing worksheets, network timeout
    logger.warn("catalogue_unavailable_using_fallback", { error });
    return {
      ok: true,
      catalogue: getStaticCatalogue(),
      settings: getStaticSettings(),
      source: "STATIC",
      fetchedAt: new Date().toISOString(),
    };
  }
});

/** Business settings, or "nothing configured" when the spreadsheet is unavailable. */
export async function loadSettings(): Promise<BusinessSettings> {
  const r = await loadCatalogue();
  return r.ok && r.source === "LIVE" ? r.settings : emptyBusinessSettings();
}

/**
 * Admin entry point to load full catalogue snapshot (including inactive rows, all categories, brands, and issues).
 * Server components only; verifies request-time execution with connection().
 */
export const loadAdminCatalogue = cache(async (): Promise<AdminCatalogueLoad> => {
  await connection();
  try {
    const snapshot = await getSheetsSnapshot();
    return { ok: true, snapshot };
  } catch (error) {
    logger.warn("admin_catalogue_unavailable", { error });
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Google Sheets unavailable",
    };
  }
});
