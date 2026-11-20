import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadSupabaseConfig } from "./config";

let adminClient: SupabaseClient | undefined;

/**
 * Privileged server-only Supabase client using SUPABASE_SERVICE_ROLE_KEY.
 * BYPASSES Row Level Security.
 * Server-only; never import into client code. Never use as substitute for checking user identity.
 */
export function getSupabaseAdminClient(): SupabaseClient {
  if (!adminClient) {
    const config = loadSupabaseConfig();
    adminClient = createClient(config.url, config.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return adminClient;
}
