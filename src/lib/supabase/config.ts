import "server-only";
import { z } from "zod";
import { SupabaseConfigError } from "./errors";

export type SupabaseConfig = {
  /** Project URL (public by design). */
  url: string;
  /** Service-role key: BYPASSES Row Level Security. Server-only; never log, serialise or expose. */
  serviceRoleKey: string;
};

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url().refine((u) => {
    const { protocol, hostname } = new URL(u);
    return (
      protocol === "https:" ||
      (protocol === "http:" && (hostname === "localhost" || hostname === "127.0.0.1"))
    );
  }),
  SUPABASE_SERVICE_ROLE_KEY: z.string().regex(/^[A-Za-z0-9._-]{20,}$/),
});

/** Validate Supabase configuration. Errors list variable NAMES only — never values. */
export function loadSupabaseConfig(
  env: Record<string, string | undefined> = process.env,
): SupabaseConfig {
  const names = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
  const missing = names.filter((n) => !env[n]?.trim());
  const parsed = schema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
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
  };
}
