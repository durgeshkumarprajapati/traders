import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { loadSupabaseAuthConfig } from "./config";

/**
 * Creates a Supabase client suitable for Next.js Proxy (middleware).
 * Automatically updates cookies on the request and response.
 */
export function createSupabaseProxyClient(request: NextRequest, response: NextResponse) {
  const config = loadSupabaseAuthConfig();

  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });
}
