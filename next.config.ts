import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

/**
 * Pages and files that are private to one customer or to the administrator: never cached by a browser, CDN or the
 * service worker, never indexed, and never leak their URL (which can hold a secret) through the Referer header.
 * These rules come AFTER the global ones, so for the same header key they win.
 */
const privateHeaders = [
  { key: "Cache-Control", value: "private, no-store, max-age=0" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  { key: "Referrer-Policy", value: "no-referrer" },
];

const nextConfig: NextConfig = {
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  allowedDevOrigins: [
    "*.trycloudflare.com",
    "**.trycloudflare.com",
    "*.loca.lt",
    "*.ngrok-free.app",
    "*.ngrok.io",
  ],
  images: { remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }] },
  async redirects() {
    // Categories and Brands are one page with two tabs (see docs/PROJECT_BLUEPRINT.md §8).
    return [{ source: "/admin/brands", destination: "/admin/categories", permanent: false }];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/track-enquiry", headers: privateHeaders },
      { source: "/quotation/:path*", headers: privateHeaders },
      { source: "/api/quotation/:path*", headers: privateHeaders },
      { source: "/api/admin/:path*", headers: privateHeaders },
      // Rate-alert confirm / unsubscribe links carry their token in the URL fragment; keep these pages uncached, unindexed and referrer-free.
      { source: "/rate-alerts/confirm", headers: privateHeaders },
      { source: "/rate-alerts/unsubscribe", headers: privateHeaders },
      { source: "/admin/:path*", headers: privateHeaders },
    ];
  },
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
};

export default nextConfig;
