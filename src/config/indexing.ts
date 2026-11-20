/**
 * Search-engine indexing switch. Customer pages stay `noindex` (and robots.txt disallows everything)
 * until the owner sets SITE_INDEXING=enabled for the production deployment. Anything else — unset,
 * "disabled", a typo — means NOT indexable (fail safe). Admin and /dev routes are always noindex.
 *
 * NOTE: the value is read when the app is built/deployed (root metadata is static), so changing it
 * requires a redeploy.
 */
export function isIndexingEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.SITE_INDEXING === "enabled";
}

export function robotsMetadata(enabled = isIndexingEnabled()) {
  return enabled ? { index: true, follow: true } : { index: false, follow: false };
}
