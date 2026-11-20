import "server-only";
import { z } from "zod";
import { SheetsConfigError } from "./errors";

export const SHEETS_SCOPES = {
  /** Least privilege for reads: works when the sheet is shared with the service account as Viewer. */
  read: "https://www.googleapis.com/auth/spreadsheets.readonly",
  /** Needed only for writes: the sheet must be shared with the service account as Editor. */
  write: "https://www.googleapis.com/auth/spreadsheets",
} as const;
export type SheetsScope = keyof typeof SHEETS_SCOPES;

export type SheetsConfig = {
  clientEmail: string;
  /** PEM private key. Server-only; never log, serialise or expose. */
  privateKey: string;
  spreadsheetId: string;
  priceHistoryEnabled: boolean;
};

/**
 * Turn an env-provided key into a PEM string: accepts literal "\n" sequences (typical in .env and
 * Vercel), real newlines, and surrounding quotes.
 */
export function normalisePrivateKey(raw: string): string {
  let key = raw.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, "\n").trim();
}

const PEM = /^-----BEGIN (?:RSA )?PRIVATE KEY-----\n[\s\S]+\n-----END (?:RSA )?PRIVATE KEY-----$/;

const schema = z.object({
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.email(),
  GOOGLE_PRIVATE_KEY: z.string().transform(normalisePrivateKey).pipe(z.string().regex(PEM)),
  GOOGLE_SHEET_ID: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{20,}$/),
  GOOGLE_SHEETS_PRICE_HISTORY: z.enum(["true", "false"]).optional(),
});

const REQUIRED = ["GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_PRIVATE_KEY", "GOOGLE_SHEET_ID"] as const;

/**
 * Read and validate Sheets configuration. Errors list variable NAMES only — never values — so a
 * misconfiguration can be logged and displayed without leaking a secret.
 */
export function loadSheetsConfig(
  env: Record<string, string | undefined> = process.env,
): SheetsConfig {
  const missing = REQUIRED.filter((k) => !env[k]?.trim());
  const parsed = schema.safeParse({
    GOOGLE_SERVICE_ACCOUNT_EMAIL: env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim(),
    GOOGLE_PRIVATE_KEY: env.GOOGLE_PRIVATE_KEY,
    GOOGLE_SHEET_ID: env.GOOGLE_SHEET_ID,
    GOOGLE_SHEETS_PRICE_HISTORY: env.GOOGLE_SHEETS_PRICE_HISTORY?.trim() || undefined,
  });
  if (missing.length > 0 || !parsed.success) {
    const invalid = parsed.success
      ? []
      : [...new Set(parsed.error.issues.map((i) => String(i.path[0])))].filter(
          (n) => !(missing as string[]).includes(n),
        );
    throw new SheetsConfigError([...missing], invalid);
  }
  return {
    clientEmail: parsed.data.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: parsed.data.GOOGLE_PRIVATE_KEY,
    spreadsheetId: parsed.data.GOOGLE_SHEET_ID,
    priceHistoryEnabled: parsed.data.GOOGLE_SHEETS_PRICE_HISTORY === "true",
  };
}
