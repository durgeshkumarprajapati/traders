import "server-only";
import { revalidateTag, updateTag } from "next/cache";
import { logger } from "@/lib/logger";
import { SHEETS_CACHE_TAG } from "./constants";

/**
 * Drop the cached spreadsheet snapshot after a successful write.
 *  1. `updateTag` (Server Actions): expires immediately so the admin sees their own change.
 *  2. Fallback `revalidateTag(tag, { expire: 0 })` for Route Handlers (e.g. a future webhook/cron).
 * Never throws: if neither works (called outside a request) the cache simply expires on schedule
 * (≤ 30 min) and a warning is logged. Returns whether an invalidation was issued.
 */
export function invalidateSheetsCache(): boolean {
  try {
    updateTag(SHEETS_CACHE_TAG);
    return true;
  } catch {
    try {
      revalidateTag(SHEETS_CACHE_TAG, { expire: 0 });
      return true;
    } catch (error) {
      logger.warn("sheets_cache_invalidation_failed", { error });
      return false;
    }
  }
}

/** Mark stale (stale-while-revalidate): for background refreshes where a brief delay is fine. */
export function markSheetsCacheStale(): void {
  revalidateTag(SHEETS_CACHE_TAG, "max");
}
