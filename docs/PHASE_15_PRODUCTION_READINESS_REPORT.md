# Phase 15 — Production readiness audit (Vercel)

Audit date: 2026-11-24 · Branch audited: `main` (HEAD `4143121` plus 20 uncommitted files) · Auditor: Claude (no production access, no Vercel access, no network to Google Fonts / Supabase / Google Sheets).

Status labels: **VERIFIED** (observed to be true), **PASS** (check run and passed), **FAIL**, **BLOCKED** (could not run here), **NOT VERIFIED** (not observed; do not assume), **OWNER ACTION REQUIRED**.

Nothing was committed, pushed, deployed or applied. No production migration, environment variable, branch or paid service was touched.

## 1. Overall production readiness

**NOT READY TO DEPLOY YET — close, with a short list of owner-side items.** The code passes every check that can run offline. Five things stop me from calling it production-ready:

1. The production `next build` could not run in this environment (**BLOCKED**: `next/font` cannot reach Google Fonts). The first real build will happen on Vercel; run `npm run build` locally first (§10).
2. `vercel.json` schedules a **10-minute** cron; Vercel **Hobby only allows daily crons** and rejects the deployment otherwise (**OWNER ACTION REQUIRED**, §7).
3. `NEXT_PUBLIC_SITE_URL` defaults to `http://localhost:3000` and is baked in at build time; it must be set **before the first build** (**OWNER ACTION REQUIRED**, §3, §9).
4. No live system (Supabase, Google Sheets, Web3Forms) was reachable, so RLS enforcement, live data, and email delivery are **NOT VERIFIED** (§5–§7).
5. `.env.example` shows as modified in git and I am not permitted to read it, so I could not confirm it holds only placeholders (**OWNER ACTION REQUIRED**).

## 2. Architecture verification

| Item                                                        | Status                                   | Evidence                                                                                                                                                                                                                                   |
| ----------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Single Next.js app, one Vercel project, no separate backend | **VERIFIED**                             | One `package.json`; API logic = route handlers + Server Actions; database via Supabase PostgREST                                                                                                                                           |
| Next.js 16.4.6 App Router, React 19.3.0, TypeScript strict  | **PASS**                                 | `tsc --noEmit` exit 0                                                                                                                                                                                                                      |
| Node requirement                                            | **VERIFIED**                             | `engines.node >=22.0.0`; set Vercel Node to 22.x                                                                                                                                                                                           |
| Cache Components (`cacheComponents: true`) prerender safety | **PASS** (fixed in this phase's lead-up) | New guard `src/app/prerender-safety.test.ts`: no customer page blocks on data outside `<Suspense>`                                                                                                                                         |
| Server-only modules / client-server boundary                | **PASS**                                 | `security.test.ts` + `phase13-security.test.ts` (import-boundary, `server-only` markers, every `"use server"` export async)                                                                                                                |
| Proxy (`src/proxy.ts`)                                      | **VERIFIED**                             | Admin session refresh + redirect to login; product-slug 404 pre-check (fails open on timeout)                                                                                                                                              |
| Route handlers                                              | **VERIFIED**                             | `/api/health`, `/api/catalogue/product`, `/api/notifications/{process,test}`, `/api/rate-alerts/process`, `/api/qr/product/[slug]`, `/api/quotation/[token]/pdf`, `/api/admin/{session,quotations/[id]/pdf}` — allow-list enforced by test |
| Error handling / secret redaction                           | **PASS**                                 | `lib/errors`, `lib/logger` (redaction tests)                                                                                                                                                                                               |
| Security headers                                            | **PASS (partial)**                       | `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS on all routes; private routes add `no-store` + `noindex` + `no-referrer`                                                                  |
| **Content-Security-Policy**                                 | **NOT IMPLEMENTED**                      | No CSP header exists. Adding one blind could break hydration (inline scripts) and I cannot test in a browser. Recommendation: ship first, then trial `Content-Security-Policy-Report-Only`. Not a blocker.                                 |
| Image optimisation                                          | **PASS**                                 | `images.remotePatterns` = `res.cloudinary.com` only                                                                                                                                                                                        |
| PWA                                                         | **PASS (automated)**                     | allow-list service worker tested in a Node VM; dev mode now unregisters the worker; real-browser/installed-PWA behaviour **NOT VERIFIED**                                                                                                  |
| Serverless filesystem writes                                | **PASS**                                 | No `writeFile`/`mkdir` in app code                                                                                                                                                                                                         |

Changes made in this phase (all small, tested): rate-alert confirm/unsubscribe pages added to the private-route headers (`next.config.ts`) with test coverage; offline page set `noindex`; `docs/GOOGLE_SHEETS_SETUP.md` now lists the `delivery_*` settings; Prettier fixed on three docs.

## 3. Environment-variable checklist (names only; never put values in git or logs)

Source of truth: `src/lib/env/server.ts`, `src/lib/env/public.ts`, `src/lib/google-sheets/config.ts`, `docs/ENVIRONMENT.md`. **`.env.example` could not be read by me**; compare it against this table.

| Variable                                                     | Required?                                    | Scope                        | Set in Vercel?                                                        | Used by                                                                                  |
| ------------------------------------------------------------ | -------------------------------------------- | ---------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                                       | **Yes** (defaults to localhost otherwise)    | Public, **inlined at build** | Yes — Production + Preview; **redeploy after any change**             | metadataBase, canonical, sitemap, OG, QR codes, visiting-card QR, rate-alert email links |
| `NEXT_PUBLIC_SUPABASE_URL`                                   | Yes                                          | Public                       | Yes                                                                   | all DB access, admin login                                                               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                              | Yes                                          | Public (RLS-protected)       | Yes                                                                   | admin session client                                                                     |
| `SUPABASE_SERVICE_ROLE_KEY`                                  | Yes                                          | **Server only**              | Yes (never `NEXT_PUBLIC_`)                                            | enquiry RPCs, cron, tracking, quotations                                                 |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`                               | Yes                                          | Server only                  | Yes                                                                   | Sheets read/write                                                                        |
| `GOOGLE_PRIVATE_KEY`                                         | Yes                                          | Server only                  | Yes (paste with `\n` escapes; code normalises them and validates PEM) | Sheets                                                                                   |
| `GOOGLE_SHEET_ID`                                            | Yes                                          | Server only                  | Yes                                                                   | Sheets                                                                                   |
| `RATE_LIMIT_SECRET` (≥16 chars)                              | **Yes** — submissions fail closed without it | Server only                  | Yes                                                                   | rate limits, tracking-token derivation, rate-alert tokens                                |
| `CRON_SECRET` (≥16 chars)                                    | **Yes** for cron                             | Server only                  | Yes — Vercel then sends it as the cron bearer token                   | `/api/notifications/process`, `/api/rate-alerts/process`, `/api/notifications/test`      |
| `WEB3FORMS_ACCESS_KEY`                                       | Optional                                     | Server only                  | Only if you want owner emails (see §7)                                | owner notification email                                                                 |
| `SITE_INDEXING`                                              | Optional (default: not indexable)            | Server/build                 | Set to exactly `enabled` **at launch**, then redeploy                 | robots + meta robots                                                                     |
| `GOOGLE_SHEETS_PRICE_HISTORY`                                | Optional (`true`/`false`)                    | Server only                  | Only if used                                                          | PriceHistory worksheet                                                                   |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_SECRET` | Optional (declared; no route uses upload)    | Public / server              | Not needed                                                            | none today                                                                               |

- **VERIFIED:** no secret has a `NEXT_PUBLIC_` name (`security.test.ts`); `.env*` is git-ignored (only `.env.example` is tracked); no JWT/key literals in source.
- **FAIL → OWNER ACTION:** `git status` shows `.env.example` modified and uncommitted. Confirm it contains placeholders only before committing.
- A real `.env` exists locally (ignored). Not read.

## 4. Migrations

Repository sequence (**VERIFIED**, all applied together in the local PostgreSQL harness, **PASS**, 27 migration tests):

| #   | File                                             | Status in production                                                                           |
| --- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| 1   | `20261118000000_enquiries.sql`                   | **NOT VERIFIED**                                                                               |
| 2   | `20261120000000_admin_auth.sql`                  | **NOT VERIFIED**                                                                               |
| 3   | `20261123000000_customer_features.sql`           | **NOT VERIFIED**                                                                               |
| 4   | `20261124000000_customer_features_hardening.sql` | **NOT VERIFIED**                                                                               |
| 5   | `20261125000000_enquiry_metadata.sql`            | **VERIFIED (owner, indirectly):** `create_enquiry` accepted metadata; `anon` cannot execute it |
| 6   | `20261126000000_rate_alerts.sql`                 | **VERIFIED (owner):** all three tables exist with RLS on                                       |

Important:

- 1–4 are very likely applied (5 builds on them) but were never shown to me. Run the check below.
- The owner applied migrations through the **SQL editor**, so `supabase_migrations.schema_migrations` will not list them. If you later use `supabase db push`, it would try to re-apply them and fail. Mark each as applied first: `supabase migration repair --status applied <version>` for each of the six versions.
- Never run `supabase/tests/*.sql` in the editor (they need the local test stub).

**Owner: read-only verification (safe to run in the SQL editor):**

```sql
-- 1. Tables present (expect all true)
select
  to_regclass('public.enquiries') is not null          as enquiries,
  to_regclass('public.enquiry_items') is not null      as items,
  to_regclass('public.notification_outbox') is not null as outbox,
  to_regclass('public.rate_limits') is not null        as rate_limits,
  to_regclass('public.admin_profiles') is not null     as admin_profiles,
  to_regclass('public.enquiry_status_history') is not null as status_history,
  to_regclass('public.enquiry_callbacks') is not null  as callbacks,
  to_regclass('public.quotations') is not null         as quotations,
  to_regclass('public.quotation_items') is not null    as quotation_items,
  to_regclass('public.enquiry_metadata') is not null   as metadata,
  to_regclass('public.rate_alert_subscriptions') is not null as ra_subs,
  to_regclass('public.product_price_snapshots') is not null  as ra_snaps,
  to_regclass('public.rate_alert_notifications') is not null as ra_notifs;

-- 2. RLS on every public table (expect no rows)
select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;

-- 3. Functions anon/authenticated must NOT execute (expect all false)
select p.proname,
       has_function_privilege('anon', p.oid, 'execute') as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in ('create_enquiry','check_rate_limit','get_tracked_enquiry','get_tracked_quotation',
                    'subscribe_rate_alert','confirm_rate_alert','unsubscribe_rate_alert',
                    'record_price_snapshots','queue_rate_alert_notifications',
                    'list_rate_alerts_due','record_rate_alert_result');

-- 4. Reference format is the random one (function body)
select position('ENQ-' in pg_get_functiondef('public.create_enquiry(jsonb)'::regprocedure)) > 0 as has_ref_logic;

-- 5. No leftover test data from earlier mistaken runs (expect 0 and 0)
select count(*) from public.enquiries where customer_name in ('Freight Tester','Plain Tester','Expert Tester');
select count(*) from public.rate_alert_subscriptions where email like '%@example.com';

-- 6. At least one active admin exists
select count(*) from public.admin_profiles where is_active;
```

## 5. Supabase, RLS and admin security

| Item                                                                                                                                                                        | Status                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Every admin Server Action guarded (`withAdminAction`: 15/15 in `features/admin/actions.ts`, 4/4 in `features/quotations/actions.ts`) and DB functions re-check `is_admin()` | **VERIFIED** (code)                                                                                                                                                                                                                                                      |
| Admin pages: `requireAdminSession()` in the console layout + proxy redirect                                                                                                 | **VERIFIED** (code)                                                                                                                                                                                                                                                      |
| No sign-up code path in the app                                                                                                                                             | **VERIFIED** (code)                                                                                                                                                                                                                                                      |
| Supabase "Allow new users to sign up" is **OFF**                                                                                                                            | **OWNER ACTION REQUIRED** (Dashboard → Authentication → Providers → Email). Even if on, nobody gains admin without an `admin_profiles` row, but disable it.                                                                                                              |
| Service-role key server-only                                                                                                                                                | **VERIFIED** (import-boundary tests; no `NEXT_PUBLIC_` secret)                                                                                                                                                                                                           |
| RLS enabled on all tables, policies, grants                                                                                                                                 | **PASS** in the local harness; **owner-confirmed** for rate-alert tables; **NOT VERIFIED** for the rest in production                                                                                                                                                    |
| **RLS enforcement** with a restricted identity                                                                                                                              | **NOT VERIFIED.** The test harness runs as superuser, so it cannot prove enforcement. Run the probes below with the **anon key** (do not use the service key).                                                                                                           |
| Public rate limiting                                                                                                                                                        | **VERIFIED** (code + tests) on bulk/contact/callback/freight/expert/rate-alert submissions and tracking lookups. Not rate-limited: the public read-only product-resolve action and `/api/qr/...` (CPU-light, size-clamped, cached 1 h) and `/api/health` (see Findings). |
| Sensitive responses `no-store`                                                                                                                                              | **PASS** (header test) for tracking, quotations, admin, rate-alert token pages                                                                                                                                                                                           |

**Owner: anon-key RLS probes** (expect `[]`, `401` or `permission denied` — never a row):

```bash
URL=https://<project>.supabase.co ; KEY=<anon key>   # run in your own terminal
for t in enquiries enquiry_items enquiry_metadata quotations quotation_items admin_profiles \
         rate_alert_subscriptions rate_alert_notifications product_price_snapshots notification_outbox rate_limits; do
  echo "== $t"; curl -s "$URL/rest/v1/$t?select=*&limit=1" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"; echo
done
echo "== rpc create_enquiry as anon (expect permission denied)"
curl -s -X POST "$URL/rest/v1/rpc/create_enquiry" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" -d '{"p_payload":{}}'; echo
```

### Findings (not blockers)

- **`/api/health` is public and performs live Google Sheets and Supabase calls on each request** (quota and abuse surface; reveals which integrations are up). Consider restricting it or caching. Not changed, to avoid breaking an uptime monitor.
- Built-in fallback catalogue (shown when Sheets is unreachable) has category/product names and generic descriptions but **no prices and no stock** (verified in source); a visible notice marks it. Owner review of those descriptions is advisable.

## 6. Google Sheets

| Item                                                                                                                                         | Status                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Worksheets documented (`Products`, `Categories`, `Brands`, `BusinessSettings`, optional `PriceHistory`), columns, validation, quota, caching | **VERIFIED** (docs; `delivery_*` settings added this phase)                                 |
| Invalid rows excluded / fields dropped with typed issues; no fabricated data                                                                 | **PASS** (tests)                                                                            |
| Fallback when Sheets unavailable                                                                                                             | **PASS** (tests); live outage behaviour **NOT VERIFIED**                                    |
| Cache policy and tag invalidation after admin writes                                                                                         | **PASS** (tests)                                                                            |
| Live Google Sheets access with the production service account                                                                                | **NOT VERIFIED** (no credentials/network here)                                              |
| Service account has **Editor** access to the sheet                                                                                           | **OWNER ACTION REQUIRED** (read-only works for the site; admin product editing needs write) |
| `BusinessSettings` filled in (phone, address, hours, GSTIN, WhatsApp, `delivery_*`, `logo_url`)                                              | **OWNER ACTION REQUIRED** — the site hides anything not configured                          |

## 7. Email, notifications and cron

| Item                                                                                                                      | Status                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/notifications/process` bearer auth: 503 when `CRON_SECRET` missing/short, 401 on wrong token, constant-time compare | **VERIFIED** (code + tests)                                                                                                                                                                                                                                                                                                                                                  |
| Retry/backoff, idempotency (outbox + idempotency keys + unique `(subscription, day)`), 20 s execution guard               | **PASS** (tests)                                                                                                                                                                                                                                                                                                                                                             |
| `/api/rate-alerts/process`: same auth; snapshots daily, never snapshots the fallback catalogue                            | **PASS** (tests)                                                                                                                                                                                                                                                                                                                                                             |
| Cron config                                                                                                               | **FAIL for Hobby / OWNER ACTION REQUIRED.** `*/10 * * * *` needs **Vercel Pro**. On Hobby the deployment is rejected. Options: upgrade, or change to once a day (`0 3 * * *`; first delivery attempts still run right after each submission, only retries slow down), or use an external scheduler. I did not change it (it is your intended frequency and a cost decision). |
| `/api/rate-alerts/process` schedule `30 2 * * *` (daily, 08:00 IST)                                                       | **PASS** on any plan                                                                                                                                                                                                                                                                                                                                                         |
| Crons run only for the **Production** deployment after a successful deploy with `CRON_SECRET` set                         | **NOT VERIFIED** until deployed                                                                                                                                                                                                                                                                                                                                              |
| Owner notification email (Web3Forms)                                                                                      | **NOT VERIFIED / likely BLOCKED.** `docs/EMAIL_SETUP.md`: Web3Forms server-side use needs a paid plan **and IP allow-listing**, impractical on Vercel. Enquiries are always saved and visible in `/admin/enquiries`; the notification stays `PENDING`/retryable. Run `POST /api/notifications/test` after deploy to learn the truth. **No email delivery is claimed.**       |
| Customer email / rate alerts                                                                                              | **BLOCKED by design.** `loadCustomerEmailProvider()` returns `null`; `/rate-alerts` says "not available"; nothing is stored or confirmed. Leave as is until a provider is approved and verified.                                                                                                                                                                             |

## 8. Business information and customer pages

| Item                                                                                                                           | Status                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Demo GSTIN / phone / email / address / hours                                                                                   | **PASS** — `demo-content-gate.test.ts` scans all of `src` (incl. the visiting-card reference's demo GSTIN and address); fabricated header location/hours removed in Phase 13 |
| Admin settings placeholder `e.g. +91 91234 56789`                                                                              | Input placeholder only, never customer-visible; change if you wish                                                                                                           |
| No fabricated prices/stock/reviews/delivery promises                                                                           | **PASS** (tests; static fallback has `price: null`, `stockStatus: null`; delivery wording never guarantees)                                                                  |
| Business Settings used consistently (phone → one validator; card; footer; WhatsApp separate)                                   | **PASS** (placement tests)                                                                                                                                                   |
| Feature set (card PNG, QR, `tel:`, WhatsApp, compare, calculator, planner, lists, freight, expert, bulk, tracking, quotations) | **PASS in automated tests**; **owner-tested on mobile and desktop** per your note; **not re-verified by me in a browser**                                                    |

## 9. SEO and domain

| Item                                       | Status                                                                                                                                                                                                                                             |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `metadataBase` from `NEXT_PUBLIC_SITE_URL` | **PASS**, but **FAIL if unset** (falls back to localhost) → **OWNER ACTION REQUIRED**: set it to the Vercel URL (or custom domain) before the first build. It is inlined at build: changing it requires a redeploy.                                |
| Canonicals                                 | **PASS** — every public page sets its own; private/noindex pages (`my-material-lists`, `offline`, quotation, rate-alert tokens) are `noindex`                                                                                                      |
| Sitemap / robots                           | **PASS** — sitemap lists public pages and active products; robots disallows admin, API, tracking, quotations, lists and token pages                                                                                                                |
| Indexing                                   | **PASS (safe default)** — everything `noindex` + `Disallow: /` until `SITE_INDEXING=enabled`. Set it only after smoke tests, then redeploy.                                                                                                        |
| Open Graph / Twitter / JSON-LD             | **VERIFIED** (root OG/Twitter; product JSON-LD) — not validated with an external tester                                                                                                                                                            |
| Admin and private pages not indexable      | **PASS** (header + meta tests)                                                                                                                                                                                                                     |
| Production domain in links and QR          | Derived from `NEXT_PUBLIC_SITE_URL`; the visiting-card QR is omitted unless it is a valid public `https` URL. If you start on `*.vercel.app` and later add a domain: change the variable, **redeploy**, regenerate/reprint QR labels and the card. |

## 10. Build and test results (this audit)

| Check                                   | Result                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsc --noEmit`                          | **PASS**                                                                                                                                                                                                                                                                                                                                          |
| `eslint src`                            | **PASS** (0 problems)                                                                                                                                                                                                                                                                                                                             |
| `prettier --check .`                    | **PASS** (after formatting three docs)                                                                                                                                                                                                                                                                                                            |
| `vitest run`                            | **PASS — 1,828 tests, 97 files** (includes the real-PostgreSQL migration suite with all six migrations)                                                                                                                                                                                                                                           |
| `npm audit`                             | **PASS — 0 vulnerabilities**                                                                                                                                                                                                                                                                                                                      |
| `next build`                            | **BLOCKED** — `next/font` could not fetch Inter from Google Fonts (sandbox network allow-list); a font-mock attempt failed under Turbopack and was abandoned. Last successful full build: end of Phase 13. Since then: Phase 14 + hydration/Suspense fixes (typechecked, linted, tested). **Run `npm run build` on your machine before pushing.** |
| Client-bundle secret scan / bundle size | **NOT VERIFIED for the current code** (needs a build). Static guards pass (no `NEXT_PUBLIC_` secrets, `qrcode` server-only, import-boundary tests). Phase 13 build scan: clean. Re-run after your build: `grep -rlE "CRON_SECRET\|RATE_LIMIT_SECRET\|SERVICE_ROLE\|service_role\|sb_secret_\|PRIVATE_KEY" .next/static` (expect no output).       |

## 11. Blocking issues

| #   | Issue                                                                        | Status                                                                             |
| --- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| B1  | Production build not run in this environment                                 | **BLOCKED** — run `npm run build` locally; Vercel's build is the true test         |
| B2  | 10-minute cron rejected on Vercel Hobby                                      | **OWNER ACTION REQUIRED**                                                          |
| B3  | `NEXT_PUBLIC_SITE_URL` must be set before first build                        | **OWNER ACTION REQUIRED**                                                          |
| B4  | `.env.example` modified/uncommitted and unreadable to me                     | **OWNER ACTION REQUIRED** (confirm placeholders only)                              |
| B5  | Production RLS enforcement, migrations 1–4, Sheets and email unverified live | **NOT VERIFIED** — run §4/§5 checks                                                |
| B6  | Owner email via Web3Forms probably not workable from Vercel on the free plan | **NOT VERIFIED / likely BLOCKED** (enquiries still saved; non-blocking for launch) |

## 12. Owner actions required (in order)

1. Decide the Vercel plan / cron frequency (B2) and edit `vercel.json` if needed.
2. Run `npm run build` locally; fix anything it reports.
3. Check `.env.example` contains no real values; commit with the 20 pending files when you are ready (I will not push).
4. Run the §4 SQL; run the §5 anon-key probes; confirm Supabase sign-ups are OFF; confirm at least one active admin.
5. `supabase migration repair --status applied …` for the six versions if you will use the CLI later.
6. Share the Google Sheet with the service account as **Editor**; fill `BusinessSettings` (and `delivery_*` if wanted).
7. Generate `RATE_LIMIT_SECRET` and `CRON_SECRET` (`openssl rand -hex 32`); never reuse them elsewhere.
8. Create the Vercel project and variables (§13). Decide the production URL; set `NEXT_PUBLIC_SITE_URL` first.
9. After the first deploy: run the smoke tests (§14). Only then set `SITE_INDEXING=enabled` and redeploy.
10. Email: approve a transactional provider before enabling rate alerts; test Web3Forms with `POST /api/notifications/test`.

## 13. Exact Vercel deployment instructions (do not execute until you approve)

1. **Import** the GitHub repository in Vercel (New Project). Select the repo; leave **Root Directory** as `./`.
2. **Framework Preset:** Next.js (auto-detected). **Build Command:** `next build` (default / `npm run build`). **Install Command:** `npm install` (default). **Output Directory:** leave default (do not set).
3. **Node.js Version:** 22.x (Project Settings → General).
4. **Production Branch:** `main` (Settings → Git). Do not change it.
5. **Environment Variables** (Settings → Environment Variables), for **Production** and **Preview** (use separate Supabase/Sheet for Preview if you prefer isolation): the variables in §3. Mark the server secrets as **Sensitive**. Do not set anything `NEXT_PUBLIC_` that is a secret. Keep `SITE_INDEXING` unset for the first deploy.
6. **Cron:** `vercel.json` registers `/api/notifications/process` (see B2) and `/api/rate-alerts/process`. With `CRON_SECRET` set, Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically. Crons run only on the Production deployment.
7. **Deploy.** First URL will be `https://<project>.vercel.app`. If `NEXT_PUBLIC_SITE_URL` pointed elsewhere, fix it and **redeploy** (build-time value).
8. **Domain (later):** Settings → Domains → add the domain, follow DNS instructions, then update `NEXT_PUBLIC_SITE_URL`, redeploy, regenerate QR labels/visiting card.
9. **Supabase:** Authentication → URL configuration → set Site URL to the production URL and add it to Redirect URLs (admin login). Keep sign-ups disabled.
10. **Rollback:** Vercel → Deployments → previous deployment → Promote to Production. Database changes are forward-only (see `docs/DATABASE_MIGRATIONS.md`).

Supabase note: projects on the **Free** plan pause after about a week of inactivity, which would take the site's enquiry saving offline. Consider a paid plan or a periodic keep-alive for a production business site.

## 14. Post-deployment smoke tests

Run on the production URL, on a phone and a desktop.

1. `GET /api/health` → 200/`healthy` (note which checks are `degraded`).
2. `/` loads; no console errors; categories, rates and the visiting card render with **your** business details (no demo values).
3. `/products`, a product page, product QR share, `/compare`, `/tools/*`, `/delivery-check`, `/ask-expert`, `/rate-alerts` ("not available"), `/my-material-lists`.
4. Tap each **Call** link (header, menu, footer, contact page): the dialer opens with the right number; WhatsApp opens the right chat.
5. Download the visiting card; open the PNG; scan its QR → opens the production URL.
6. Submit a **bulk enquiry**, a contact enquiry, a callback, a freight and an expert enquiry; each returns an `ENQ-XXXX-XXXX-XXXX` reference; open the tracking link from the confirmation.
7. Admin: sign in; confirm the enquiries appear (with freight/expert badges); change status; create and issue a quotation; open the customer quotation link and the PDF; check Business Settings edit writes to the sheet and the site updates.
8. Anonymous access: while signed out, `/admin/...` redirects to login; the anon-key probes (§5) return nothing.
9. `curl -i https://<url>/api/notifications/process` → **401/503** without the bearer token; with `-H "Authorization: Bearer $CRON_SECRET"` → 200.
10. `POST /api/notifications/test` (with the bearer token) → note whether the owner email arrives.
11. Check headers: `curl -I https://<url>/track-enquiry` shows `cache-control: private, no-store`; `/` has HSTS and `x-frame-options`.
12. View `/robots.txt` (expect `Disallow: /`), `/sitemap.xml` (production URLs).
13. Install the PWA; go offline; visit a visited public page (served from cache) and confirm `/admin` and `/track-enquiry` are never served offline.
14. Wait for/trigger the cron in Vercel (Deployments → Cron Jobs → Run) and check the logs show a 200.
15. When satisfied: set `SITE_INDEXING=enabled`, redeploy, and re-check `robots.txt`.

## 15. Stop

Awaiting explicit approval before any Git push, production migration, or deployment.
