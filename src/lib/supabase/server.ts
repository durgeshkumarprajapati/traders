import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadSupabaseAuthConfig } from "./config";

/**
 * Creates a Supabase client for Server Components, Server Actions, and Route Handlers.
 * Persists session using Next.js request cookies.
 * In Server Components, cookie writes are safely caught and ignored if response streaming has started.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const config = loadSupabaseAuthConfig();
  const cookieStore = await cookies();

  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if proxy/middleware refreshes user sessions.
        }
      },
    },
  });
}
