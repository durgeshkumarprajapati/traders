// Sagar Traders Service Worker — Production Grade PWA
// Safe caching strategy: Precache core static assets, Stale-While-Revalidate for images,
// Network-First for public product pages with offline fallback,
// STRICT Network-Only for admin routes, enquiry tracking, quotations, and mutations.

const CACHE_NAME = "sagar-traders-v1";
const PRECACHE_ASSETS = [
  "/",
  "/products",
  "/contact",
  "/offline",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// URLs and paths that must NEVER be cached or intercepted by service worker
function isStrictNetworkOnly(url, request) {
  if (request.method !== "GET") return true;

  const path = url.pathname;
  if (path.startsWith("/admin")) return true;
  if (path.startsWith("/track-enquiry")) return true;
  if (path.startsWith("/quotation")) return true;
  if (path.startsWith("/api/quotation")) return true;
  if (url.searchParams.has("token")) return true;
  if (url.hostname.includes("supabase.co")) return true;

  return false;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Strict Exclusions: Pass directly through to network with no cache involvement
  if (isStrictNetworkOnly(url, request)) {
    return;
  }

  // 2. Static Assets (Next.js JS/CSS chunks, icons, images): Cache-First
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".jpeg") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".webp") ||
    url.pathname.endsWith(".svg")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        });
      }),
    );
    return;
  }

  // 3. Public Web Pages: Network-First with cache fallback and offline page
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offlinePage = await caches.match("/offline");
          if (offlinePage) return offlinePage;
          return new Response("Offline mode", {
            status: 503,
            headers: { "Content-Type": "text/plain" },
          });
        }),
    );
    return;
  }
});
