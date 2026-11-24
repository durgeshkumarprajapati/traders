// Sagar Traders service worker.
//
// Goal: let a customer re-open public catalogue pages they have already visited when offline, WITHOUT ever storing
// anything private. Policy is an explicit ALLOWLIST; everything not listed is passed straight to the network and never
// touched by this worker.
//
//   NEVER intercepted / cached: /admin, /api (every API route incl. health, session, quotation PDFs), /track-enquiry,
//   /quotation, /_next/data, RSC/prefetch requests, non-GET requests, cross-origin requests, requests carrying
//   Authorization or Range headers, and any URL with a secret-looking query parameter (token, ref, key, code, otp…).
//
//   Cached (same-origin, GET, HTTP 200, not `Cache-Control: no-store|private`):
//     - public pages:  /  /products  /products/<slug>  /contact  /bulk-enquiry  /offline  /tools(/material-calculator|/project-planner)
//                      /compare  /delivery-check  /ask-expert  /rate-alerts   (network-first, 4 s timeout)
//     - build assets:  /_next/static/**                                                    (cache-first, content-hashed)
//     - public images: /images/**  /icons/**  *.jpeg|jpg|png|webp|svg|ico under the site    (cache-first)
//
// Caches are versioned, size-bounded, and every cached page is stamped with the time it was saved so the page can tell the
// customer how old the offline copy is. Prices and stock in a cached page are NEVER live.

const VERSION = "v2";
const PAGE_CACHE = `sagar-pages-${VERSION}`;
const ASSET_CACHE = `sagar-assets-${VERSION}`;
const CURRENT_CACHES = [PAGE_CACHE, ASSET_CACHE];
const MAX_PAGES = 40;
const MAX_ASSETS = 120;
const NAVIGATION_TIMEOUT_MS = 4000;
const CACHED_AT_HEADER = "x-sw-cached-at";
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png"];

const NEVER_PREFIXES = [
  "/admin",
  "/api",
  "/track-enquiry",
  "/quotation",
  "/_next/data",
  // Private or token-bearing: the customer's saved lists (their own device data) and the rate-alert confirm/unsubscribe links.
  "/my-material-lists",
  "/rate-alerts/confirm",
  "/rate-alerts/unsubscribe",
];
// Secret-looking parameters, plus anything a customer types (search text, contact details): such URLs are never stored.
const SECRET_PARAMS = [
  "token",
  "ref",
  "key",
  "code",
  "otp",
  "auth",
  "session",
  "access_token",
  "id_token",
  "q",
  "search",
  "email",
  "phone",
  "mobile",
  "name",
];
const PUBLIC_PAGE =
  /^\/(?:$|products\/?$|products\/[a-z0-9][a-z0-9-]*\/?$|contact\/?$|bulk-enquiry\/?$|offline\/?$|tools\/?$|tools\/(?:material-calculator|project-planner)\/?$|compare\/?$|delivery-check\/?$|ask-expert\/?$|rate-alerts\/?$)/;
const IMAGE_EXT = /\.(?:jpe?g|png|webp|svg|ico)$/i;

/** True when this request must bypass the worker entirely (no respondWith, no caching, no reading). */
function mustBypass(request, url) {
  if (request.method !== "GET") return true;
  if (url.origin !== self.location.origin) return true;
  if (request.headers.has("authorization") || request.headers.has("range")) return true;
  if (
    request.headers.get("rsc") ||
    request.headers.get("next-router-prefetch") ||
    url.searchParams.has("_rsc")
  )
    return true;
  const path = url.pathname;
  if (NEVER_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return true;
  for (const name of url.searchParams.keys())
    if (SECRET_PARAMS.includes(name.toLowerCase())) return true;
  return false;
}

/** A response may be stored only if it is a plain successful same-origin response that did not forbid storing. */
function isCacheable(response) {
  if (!response || response.status !== 200 || response.type !== "basic") return false;
  const cc = (response.headers.get("cache-control") || "").toLowerCase();
  return !/(no-store|private)/.test(cc);
}

async function stamp(response) {
  const headers = new Headers(response.headers);
  headers.set(CACHED_AT_HEADER, new Date().toISOString());
  return new Response(await response.blob(), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function put(cacheName, max, request, response) {
  const cache = await caches.open(cacheName);
  await cache.put(request, response);
  await trim(cacheName, max);
}

self.addEventListener("install", (event) => {
  // No skipWaiting here: an open page keeps its matching assets until the customer chooses to refresh (see SKIP_WAITING).
  event.waitUntil(caches.open(ASSET_CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("sagar-") && !CURRENT_CACHES.includes(k))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  const type = event.data && event.data.type;
  if (type === "SKIP_WAITING") self.skipWaiting();
  if (type === "CLEAR_CACHES")
    event.waitUntil(
      caches
        .keys()
        .then((keys) =>
          Promise.all(keys.filter((k) => k.startsWith("sagar-")).map((k) => caches.delete(k))),
        ),
    );
});

function offlineResponse() {
  return new Response("You are offline.", {
    status: 503,
    headers: { "Content-Type": "text/plain" },
  });
}

function networkFirstWithTimeout(request) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (r) => {
      if (!settled) {
        settled = true;
        resolve(r);
      }
    };
    const network = fetch(request)
      .then(async (response) => {
        if (isCacheable(response)) {
          const copy = await stamp(response.clone());
          put(PAGE_CACHE, MAX_PAGES, request, copy).catch(() => undefined);
        }
        finish(response);
        return response;
      })
      .catch(() => null);
    // Slow network: serve the saved copy (if any) while the network request carries on and refreshes the cache.
    setTimeout(async () => {
      const cached = await caches.match(request);
      if (cached) finish(cached);
    }, NAVIGATION_TIMEOUT_MS);
    network
      .then(async (response) => {
        if (response) return;
        const cached = await caches.match(request);
        if (cached) return finish(cached);
        const offline = await caches.match(OFFLINE_URL);
        finish(offline || offlineResponse());
      })
      // Whatever goes wrong, the navigation must always settle with SOMETHING (never hang the page load).
      .catch(() => finish(offlineResponse()));
  });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (mustBypass(request, url)) return;

  // Public pages: network-first, saved copy when offline or slow.
  if (request.mode === "navigate") {
    if (!PUBLIC_PAGE.test(url.pathname)) return; // anything else is network-only
    event.respondWith(networkFirstWithTimeout(request));
    return;
  }

  // Build assets and public images: cache-first.
  const isAsset = url.pathname.startsWith("/_next/static/");
  const isImage =
    (url.pathname.startsWith("/images/") ||
      url.pathname.startsWith("/icons/") ||
      IMAGE_EXT.test(url.pathname)) &&
    !url.pathname.startsWith("/_next/image");
  if (isAsset || isImage) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (isCacheable(response))
              put(ASSET_CACHE, MAX_ASSETS, request, response.clone()).catch(() => undefined);
            return response;
          }),
      ),
    );
  }
  // Everything else: not handled (browser default, network only).
});
