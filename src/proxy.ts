import { NextResponse, type NextRequest } from "next/server";

/**
 * Returns a genuine HTTP 404 for product URLs that do not exist.
 *
 * Why Proxy: with Cache Components the page shell is sent (status 200) before the request-time
 * catalogue check can run, so `notFound()` inside the page can only render the not-found UI with a 200.
 * Proxy runs BEFORE rendering, so it can still decide the status (Next.js docs: "To return a request-time 404, use Proxy").
 *
 * Behaviour: malformed slug → 404. Otherwise ask the internal catalogue route whether an ACTIVE product has
 * this slug: 404 → 404; exists / unavailable / error / timeout → continue (FAIL OPEN, so a Google Sheets outage
 * shows the page's own "unavailable" state instead of turning every product URL into a 404).
 * Proxy cannot use `use cache` itself, hence the internal fetch to a route handler that does.
 */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CHECK_TIMEOUT_MS = 2500;
// A path no route matches: Next renders the app's not-found UI with a real 404 status.
const MISSING_PATH = "/__product-not-found__";

export async function proxy(request: NextRequest) {
  let slug = "";
  try {
    slug = decodeURIComponent(request.nextUrl.pathname.split("/")[2] ?? "");
  } catch {
    return notFoundResponse(request);
  }
  if (slug.length > 80 || !SLUG.test(slug)) return notFoundResponse(request);

  try {
    const res = await fetch(
      new URL(`/api/catalogue/product?slug=${encodeURIComponent(slug)}`, request.nextUrl.origin),
      {
        cache: "no-store",
        signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
      },
    );
    if (res.status === 404) return notFoundResponse(request);
  } catch {
    /* fail open */
  }
  return NextResponse.next();
}

function notFoundResponse(request: NextRequest) {
  return NextResponse.rewrite(new URL(MISSING_PATH, request.url));
}

// Single-segment product URLs only (/products/<slug>); the listing and everything else are untouched.
export const config = { matcher: ["/products/:slug"] };
