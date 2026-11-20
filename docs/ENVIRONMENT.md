# Environment variables

Names only — **never put real values in this repository or its documentation.** Copy the block below into `.env.local` for development and into Vercel project settings for deployments.

## Phase 4 — Google Sheets (server-only)

| Variable                       | Required                 | Exposure                           | Purpose / format                                                                                                                                                      |
| ------------------------------ | ------------------------ | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Yes, when Sheets is used | Server only (never `NEXT_PUBLIC_`) | Service-account e-mail (`name@project-id.iam.gserviceaccount.com`).                                                                                                   |
| `GOOGLE_PRIVATE_KEY`           | Yes                      | Server only                        | PEM private key from the service-account JSON. In `.env` files keep it on **one line** with literal `\n` sequences (quotes optional). Vercel accepts the same format. |
| `GOOGLE_SHEET_ID`              | Yes                      | Server only                        | The id in the spreadsheet URL between `/d/` and `/edit` (≥ 20 chars, letters/digits/`_`/`-`).                                                                         |
| `GOOGLE_SHEETS_PRICE_HISTORY`  | No (default `false`)     | Server only                        | `true` appends price changes to the optional `PriceHistory` worksheet (requires `updated_by` on price writes).                                                        |

Validation happens in `src/lib/google-sheets/config.ts` (`loadSheetsConfig`). A problem is reported by **variable name only** (never the value). Missing or malformed configuration makes every Sheets read fail with a generic "product data is temporarily unavailable" message — it never produces fake data.

## Phase 6 — Enquiries, email, rate limiting, indexing

| Variable                    | Required                            | Exposure                                             | Purpose / format                                                                                                                                                    |
| --------------------------- | ----------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`  | Yes (enquiries, admin auth)         | Public-safe (a project URL, not a secret)            | `https://<project-ref>.supabase.co` (https, or `http://localhost:54321` for local Supabase). Used by both server and browser clients.                               |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (enquiries, server operations)  | **Server only — bypasses RLS; never `NEXT_PUBLIC_`** | Used by `src/lib/supabase/rest.ts` and `src/lib/supabase/admin.ts` to call locked-down functions and privileged operations.                                         |
| `WEB3FORMS_ACCESS_KEY`      | No — enquiries are saved without it | Server only                                          | Email notifications. If missing, enquiries are still saved and the notification stays `PENDING` (visible, retryable).                                               |
| `RATE_LIMIT_SECRET`         | Yes (enquiries)                     | Server only                                          | ≥ 16 random chars; HMAC key for hashing IP / mobile before they are stored in the rate-limit table. Missing ⇒ submissions fail closed (generic "unavailable").      |
| `CRON_SECRET`               | Only to use the sweeper route       | Server only                                          | ≥ 16 random chars. `/api/notifications/process` answers 503 while unset and 401 for any other bearer token. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. |
| `SITE_INDEXING`             | No (default: not indexable)         | Server / build time                                  | Set to exactly `enabled` at launch. Anything else keeps `noindex, nofollow` and `Disallow: /`. Read at build, so **redeploy after changing it**.                    |

## Phase 7 — Admin Authentication & Authorization

| Variable                        | Required                    | Exposure    | Purpose / format                                                                                                                                                                        |
| ------------------------------- | --------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes (admin login, SSR auth) | Public-safe | Supabase anon key (`sb-test-anon-...` or JWT). Used by `@supabase/ssr` (`createBrowserClient` and `createServerClient`) for session management. Subject to database Row Level Security. |

## Phase 9 — Live Credentials Status & Verification

In Phase 9, configured environment variables in local development were audited and verified:

- **Google Sheets:** `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, and `GOOGLE_SHEET_ID` are configured and validated. Service Account JWT was signed and OAuth 2.0 token successfully exchanged with Google endpoints (HTTP 200). The target spreadsheet was inspected, discovering the default `"Sheet1"`.
- **Web3Forms:** `WEB3FORMS_ACCESS_KEY` is configured and validated as a 36-character UUID string. Server-side payload generation and error classification were verified via unit tests; real outbound emails were suppressed per safety constraints.
- **Supabase:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` remain empty in `.env`. Supabase persistence, RLS policies, and admin session checks operate via automated tests with mock clients until project credentials are provided.

Names are reported by the loaders; values are never logged or returned to the browser (verified by automated tests and inspection of `.next/static`).

## Ready-to-copy `.env.example` Block

```dotenv
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# ── Phase 4: Google Sheets (server-only; never prefix with NEXT_PUBLIC_) ───────
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_SHEET_ID=
GOOGLE_SHEETS_PRICE_HISTORY=false

# ── Phase 6/7: Supabase ────────────────────────────────────────────────────────
# Public-safe project URL, e.g. https://abcdefgh.supabase.co
NEXT_PUBLIC_SUPABASE_URL=
# Public-safe anon key (used by browser client and SSR session handling; RLS enforced)
NEXT_PUBLIC_SUPABASE_ANON_KEY=
# Service-role key. Bypasses RLS. NEVER prefix with NEXT_PUBLIC_, never commit.
SUPABASE_SERVICE_ROLE_KEY=

# ── Phase 6: Enquiries, Web3Forms & Rate Limiting ──────────────────────────────
# Web3Forms access key (server-side email notifications). Optional.
WEB3FORMS_ACCESS_KEY=
# Random string (>=16 chars) used to hash IPs/mobiles for rate limiting.
RATE_LIMIT_SECRET=
# Random string (>=16 chars) protecting /api/notifications/process.
CRON_SECRET=
# Leave unset until launch. Set to "enabled" (and redeploy) to allow indexing.
SITE_INDEXING=

# ── Phase 10: Cloudinary (future) ──────────────────────────────────────────────
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_SECRET=
```
