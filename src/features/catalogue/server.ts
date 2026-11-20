import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import {
  emptyBusinessSettings,
  type BusinessSettings,
} from "@/features/settings/business-settings";
import { logger } from "@/lib/logger";
import { getSheetsSnapshot } from "./cache";
import { toPublicCatalogue } from "./public";
import { toBusinessSettings, toViewCatalogue, type ViewCatalogue } from "./view";

export type CatalogueLoad =
  | { ok: true; catalogue: ViewCatalogue; settings: BusinessSettings; fetchedAt: string }
  | { ok: false };

/**
 * The ONLY entry point customer-facing code uses to read catalogue data (server components only).
 *
 *  - Reads the shared cached snapshot (`getSheetsSnapshot`): every page, layout slot and metadata call
 *    reuses the same cache entry, and React `cache()` additionally de-duplicates calls within one request
 *    (so a failing sheet is not retried once per layout slot).
 *  - Exposes only public data: active products, categories and brands. Write functions and Google
 *    clients are not reachable from here.
 *  - Deferred to request time with `connection()` (never read, and never cached as a failure, at build time).
 *  - On any failure returns `{ ok: false }` — callers show an honest "unavailable" state. It never
 *    falls back to sample data, and the error detail is logged (redacted), never returned.
 */
export const loadCatalogue = cache(async (): Promise<CatalogueLoad> => {
  // Defer to REQUEST time. Without this, the cached read can run during `next build` prerender: the build
  // would need credentials, and a failure could be baked into a static page as an "unavailable" message.
  // (At request time this resolves immediately; repeated reads are served by the shared remote cache.)
  await connection();
  try {
    const snap = await getSheetsSnapshot();
    return {
      ok: true,
      catalogue: toViewCatalogue(toPublicCatalogue(snap)),
      settings: toBusinessSettings(snap.settings),
      fetchedAt: snap.fetchedAt,
    };
  } catch (error) {
    logger.warn("catalogue_unavailable", { error });
    return { ok: false };
  }
});

/** Business settings, or "nothing configured" when the spreadsheet is unavailable. */
export async function loadSettings(): Promise<BusinessSettings> {
  const r = await loadCatalogue();
  return r.ok ? r.settings : emptyBusinessSettings();
}
