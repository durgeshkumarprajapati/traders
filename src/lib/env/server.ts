import "server-only";
import { z } from "zod";

/**
 * Server-only environment. Integration variables are optional until their
 * phase lands (Sheets P4, Web3Forms P6, Supabase P7, Cloudinary P10), then
 * move to required. Never import this from client code.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().optional(),
  GOOGLE_PRIVATE_KEY: z.string().optional(),
  GOOGLE_SHEET_ID: z.string().optional(),
  /** "enabled" allows search engines to index customer pages (default: not indexable). */
  SITE_INDEXING: z.enum(["enabled", "disabled"]).optional(),
  /** "true" records price changes in the optional PriceHistory worksheet. */
  GOOGLE_SHEETS_PRICE_HISTORY: z.enum(["true", "false"]).optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  /** Secret for HMAC-hashing rate-limit identifiers (≥ 16 chars). Required for public enquiry submission. */
  RATE_LIMIT_SECRET: z.string().optional(),
  /** Bearer secret protecting the notification sweeper route (≥ 16 chars). Without it the route refuses all requests. */
  CRON_SECRET: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  WEB3FORMS_ACCESS_KEY: z.string().optional(),
});

let cached: z.infer<typeof schema> | undefined;

export function serverEnv() {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const names = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
      throw new Error(`Invalid server environment: ${names}`);
    }
    cached = parsed.data;
  }
  return cached;
}
