/** Cache tag shared by every cached read of the spreadsheet. Writes invalidate it. */
export const SHEETS_CACHE_TAG = "sheets";

/** Hosts product/category/brand images may come from (matches `images.remotePatterns` in next.config.ts). */
export const IMAGE_HOSTS = ["res.cloudinary.com"] as const;

/**
 * Cache policy (see docs/PHASE_4_REPORT.md). Mirrored by the literal passed to `cacheLife` in
 * `cache.ts` (cacheLife must be called with a literal in the cached function) and asserted by a test.
 *  - stale 60 s: browsers may reuse the page without asking the server
 *  - revalidate 300 s: after 5 minutes the next request triggers a background refresh
 *  - expire 1800 s: maximum acceptable staleness — past 30 minutes the next request waits for fresh data
 */
export const SHEETS_CACHE_LIFE = { stale: 60, revalidate: 300, expire: 1800 } as const;
