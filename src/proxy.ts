import { NextResponse, type NextRequest } from "next/server";
import { sanitizeReturnUrl } from "@/lib/auth/admin";
import { createSupabaseProxyClient } from "@/lib/supabase/proxy";

/**
 * Next.js Proxy for Sagar Traders:
 * 1. Product routes (/products/:slug): Returns a genuine HTTP 404 for products that do not exist.
 * 2. Admin routes (/admin/:path*): Refreshes Supabase session cookies and redirects unauthenticated visitors to /admin/login.
 */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CHECK_TIMEOUT_MS = 2500;
const MISSING_PATH = "/__product-not-found__";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Handle Admin routes
  if (pathname.startsWith("/admin")) {
    return handleAdminProxy(request);
  }

  // Handle Product routes
  let slug = "";
  try {
    slug = decodeURIComponent(pathname.split("/")[2] ?? "");
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

async function handleAdminProxy(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  try {
    const supabase = createSupabaseProxyClient(request, response);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // /admin/login route
    if (pathname === "/admin/login") {
      if (user) {
        const { data: profile } = await supabase
          .from("admin_profiles")
          .select("id, is_active")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.is_active) {
          const returnTo = sanitizeReturnUrl(request.nextUrl.searchParams.get("returnTo"));
          const destination = returnTo ?? "/admin/dashboard";
          return NextResponse.redirect(new URL(destination, request.url));
        }
      }
      return response;
    }

    // All other /admin/* routes are protected
    if (!user) {
      const returnTo = sanitizeReturnUrl(pathname + request.nextUrl.search);
      const loginUrl = new URL("/admin/login", request.url);
      if (returnTo) {
        loginUrl.searchParams.set("returnTo", returnTo);
      }
      return NextResponse.redirect(loginUrl);
    }

    return response;
  } catch {
    // If Supabase check fails on protected route, fail closed
    if (pathname !== "/admin/login") {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return response;
  }
}

function notFoundResponse(request: NextRequest) {
  return NextResponse.rewrite(new URL(MISSING_PATH, request.url));
}

export const config = { matcher: ["/products/:slug", "/admin/:path*"] };
