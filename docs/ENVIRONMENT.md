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

## Block to append to `.env.example`

`.env.example` is a protected file in the agent sandbox and could not be edited there, so please append this yourself:

```dotenv
# ── Phase 4: Google Sheets (server-only; never prefix with NEXT_PUBLIC_) ───────
# Service-account e-mail, e.g. name@project-id.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_EMAIL=
# Service-account private key (PEM). Keep on ONE line with literal \n sequences,
# optionally wrapped in double quotes. Never log or commit it.
GOOGLE_PRIVATE_KEY=
# Spreadsheet ID: the long id in the sheet URL between /d/ and /edit
GOOGLE_SHEET_ID=
# Optional: "true" appends price changes to the PriceHistory worksheet (default: false)
GOOGLE_SHEETS_PRICE_HISTORY=false
```

## Phase 6 — Enquiries, email, rate limiting, indexing

| Variable                    | Required                            | Exposure                                             | Purpose / format                                                                                                                                                    |
| --------------------------- | ----------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`  | Yes (enquiries)                     | Public-safe (a project URL, not a secret)            | `https://<project-ref>.supabase.co` (https, or `http://localhost` for local Supabase). Read by server code only in Phase 6.                                         |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (enquiries)                     | **Server only — bypasses RLS; never `NEXT_PUBLIC_`** | Used by `src/lib/supabase/rest.ts` to call the locked-down `create_enquiry` / outbox / rate-limit functions.                                                        |
| `WEB3FORMS_ACCESS_KEY`      | No — enquiries are saved without it | Server only                                          | Email notifications. If missing, enquiries are still saved and the notification stays `PENDING` (visible, retryable).                                               |
| `RATE_LIMIT_SECRET`         | Yes (enquiries)                     | Server only                                          | ≥ 16 random chars; HMAC key for hashing IP / mobile before they are stored in the rate-limit table. Missing ⇒ submissions fail closed (generic "unavailable").      |
| `CRON_SECRET`               | Only to use the sweeper route       | Server only                                          | ≥ 16 random chars. `/api/notifications/process` answers 503 while unset and 401 for any other bearer token. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. |
| `SITE_INDEXING`             | No (default: not indexable)         | Server / build time                                  | Set to exactly `enabled` at launch. Anything else keeps `noindex, nofollow` and `Disallow: /`. Read at build, so **redeploy after changing it**.                    |

Names are reported by the loaders; values are never logged or returned to the browser (verified by tests and a grep of `.next/static`).

## Block to append to `.env.example`

`.env.example` is masked in the agent sandbox, so append this yourself (together with the Phase 4 block above):

```dotenv
# ── Phase 6: Enquiries (server-only unless noted) ──────────────────────────────
# Public-safe project URL, e.g. https://abcdefgh.supabase.co
NEXT_PUBLIC_SUPABASE_URL=
# Service-role key. Bypasses RLS. NEVER prefix with NEXT_PUBLIC_, never commit.
SUPABASE_SERVICE_ROLE_KEY=
# Web3Forms access key (server-side email notifications). Optional: without it
# enquiries are saved and their notification stays PENDING.
WEB3FORMS_ACCESS_KEY=
# Random string (>=16 chars) used to hash IPs/mobiles for rate limiting.
RATE_LIMIT_SECRET=
# Random string (>=16 chars) protecting /api/notifications/process.
CRON_SECRET=
# Leave unset until launch. Set to "enabled" (and redeploy) to allow indexing.
SITE_INDEXING=
```

## Other variables (later phases)

`NEXT_PUBLIC_SITE_URL` (used now), `NEXT_PUBLIC_SUPABASE_ANON_KEY` (admin auth, Phase 7), `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — see `PROJECT_BLUEPRINT.md` §25.2.
