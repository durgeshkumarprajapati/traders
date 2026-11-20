import "server-only";
import { z } from "zod";
import { SupabaseConfigError } from "./errors";

export type SupabaseConfig = {
  /** Project URL (public by design). */
  url: string;
  /** Service-role key: BYPASSES Row Level Security. Server-only; never log, serialise or expose. */
  serviceRoleKey: string;
  /** Anon key: public-safe API key for client & SSR auth operations. */
  anonKey?: string;
};

export type SupabaseAuthConfig = {
  /** Project URL (public by design). */
  url: string;
  /** Anon key: public-safe API key for client & SSR auth operations. */
  anonKey: string;
  /** Service-role key: optional for auth client. */
  serviceRoleKey?: string;
};

const urlValidator = z.url().refine((u) => {
  const { protocol, hostname } = new URL(u);
  return (
    protocol === "https:" ||
    (protocol === "http:" && (hostname === "localhost" || hostname === "127.0.0.1"))
  );
});

const keyValidator = z.string().regex(/^[A-Za-z0-9._-]{20,}$/);

const rpcSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: urlValidator,
  SUPABASE_SERVICE_ROLE_KEY: keyValidator,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: keyValidator.optional(),
});

const authSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: urlValidator,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: keyValidator,
  SUPABASE_SERVICE_ROLE_KEY: keyValidator.optional(),
});

/** Validate Supabase RPC configuration (service role). Errors list variable NAMES only — never values. */
export function loadSupabaseConfig(
  env: Record<string, string | undefined> = process.env,
): SupabaseConfig {
  const names = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
  const missing = names.filter((n) => !env[n]?.trim());
  const parsed = rpcSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || undefined,
  });
  if (missing.length > 0 || !parsed.success) {
    const invalid = parsed.success
      ? []
      : [...new Set(parsed.error.issues.map((i) => String(i.path[0])))].filter(
          (n) => !(missing as string[]).includes(n),
        );
    throw new SupabaseConfigError([...missing], invalid);
  }
  return {
    url: parsed.data.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, ""),
    serviceRoleKey: parsed.data.SUPABASE_SERVICE_ROLE_KEY,
    anonKey: parsed.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

/** Validate Supabase Auth configuration (SSR client). Errors list variable NAMES only — never values. */
export function loadSupabaseAuthConfig(
  env: Record<string, string | undefined> = process.env,
): SupabaseAuthConfig {
  const names = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;
  const missing = names.filter((n) => !env[n]?.trim());
  const parsed = authSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY?.trim() || undefined,
  });
  if (missing.length > 0 || !parsed.success) {
    const invalid = parsed.success
      ? []
      : [...new Set(parsed.error.issues.map((i) => String(i.path[0])))].filter(
          (n) => !(missing as string[]).includes(n),
        );
    throw new SupabaseConfigError([...missing], invalid);
  }
  return {
    url: parsed.data.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, ""),
    anonKey: parsed.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: parsed.data.SUPABASE_SERVICE_ROLE_KEY,
  };
}
