# Phase 6 report — Enquiry workflows and persistence

Date: 2026-11-18 · Scope: Phase 6 only (Phase 7+ not started) · No Git/GitHub activity.

**Headline:** the enquiry workflows, schema, outbox, rate limiting and security controls are implemented and pass 760 automated tests (including SQL executed on a real PostgreSQL 16 instance). **Nothing was verified against live Supabase, live Web3Forms or live Google Sheets, and no browser testing was possible.** Those items are listed under "Remaining blockers".

## 0. Phase 5 outstanding items

| Item                                | Result                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Configurable "Why Choose Us"        | Keys `why_choose_us_{1..6}_{title,description}` (80/300 chars) parsed in `features/catalogue/parse.ts`; shown only for complete pairs; half-filled pair → `INVALID_SETTING` warning; section hidden when empty. Template CSV updated.                                                                                                                                                   |
| Indexing control                    | `SITE_INDEXING=enabled` is the only way to allow indexing (`src/config/indexing.ts`, `app/layout.tsx`, `app/robots.ts`). Default: `noindex, nofollow` + `Disallow: /`. Admin/dev routes always noindex. Read at build time ⇒ redeploy after changing.                                                                                                                                   |
| G36 true HTTP 404                   | Root cause: with Cache Components the page streams, so `notFound()` after the shell starts yields status 200. Fix: `src/proxy.ts` validates the slug and asks `/api/catalogue/product`; 404 ⇒ rewrite to a non-existent route (real 404); catalogue unavailable ⇒ fail open. Unit-tested. **The status code was not observed on a running server** (servers cannot run in the sandbox). |
| Sheets live-connectivity limitation | Documented in `docs/GOOGLE_SHEETS_SETUP.md` §7 and the blueprint. Live Sheets integration remains **unverified**.                                                                                                                                                                                                                                                                       |

## 1. Database schema and migrations

`supabase/migrations/20261118000000_enquiries.sql`:

- `enquiries` (type `BULK|GENERAL` check; status `NEW|CONTACTED|QUOTATION_SENT|CONFIRMED|COMPLETED|CANCELLED`; `reference` from a sequence; `UNIQUE(idempotency_key)`; bounded text checks; timestamps), indexes on status/created, created, mobile, lower(name).
- `enquiry_items` (FK cascade, `position`, product snapshot: id, sku, name, brand, unit code/label, quantity > 0, `listed_price` nullable with `check (listed_price is null or listed_price > 0)` — a missing price is never 0; stock status snapshot).
- `enquiry_notes` (schema only; no UI — Phase 9).
- `notification_outbox` (state on the row) and `notification_attempts` (audit table, one row per attempt) — **attempts are a separate table _and_ the outbox row carries the current state**.
- `rate_limits` (hashed key, window start, count).
- Functions: `create_enquiry`, `claim_notification`, `record_notification_attempt`, `list_due_notifications`, `retry_notification`, `check_rate_limit`, `purge_rate_limits`.
- `admin_profiles` is **not created** — it is only needed with admin authentication (Phase 7).
- RLS enabled on all tables, **no policies** (default deny), privileges revoked from `anon`/`authenticated`; functions `SECURITY DEFINER`, fixed `search_path`, `EXECUTE` to `service_role` only.
- Transaction boundary = the Postgres function: enquiry + items + outbox row commit together or not at all.

## 2. Enquiry workflows

- **Single-product WhatsApp:** message built from authoritative product data; no DB record; no "sent" claim; missing WhatsApp number handled safely. There is **no PRODUCT enquiry type** anywhere (asserted by a source scan and a migration check).
- **Bulk:** browser sends only `productId` + `quantity` (unknown keys stripped by Zod). The server loads the catalogue (`loadCatalogue`) and builds snapshots (name, brand, unit, listed price, stock status). Unknown/inactive ids → `INVALID_PRODUCTS` with names, nothing saved. `AVAILABLE_ON_ORDER` supported. Missing price → `NULL`.
- **General:** saved with no items; no product selection required.
- **UI:** existing forms/design reused; honeypot field, pending state, reference shown on success, no claim that email or WhatsApp was sent; typed data kept on error; enquiry list cleared only on success.

## 3. Notification outbox

1. `create_enquiry` inserts the outbox row in the same transaction.
2. After the response, `after()` calls `processNotification`: atomic `claim_notification` (lease), one Web3Forms call (8 s timeout), `record_notification_attempt`.
3. Failures never lose the enquiry. Retryable failures back off 60 s doubling to a 6 h cap; permanent failures (`'infinity'`) stay `FAILED` and visible.
4. Stale-writer protection and `SENT`-rows-never-reclaimed prevent duplicate sends in normal operation. **Semantics: at-least-once** — a duplicate email is possible only if a send succeeds but recording its result fails.
5. Retry mechanism: opportunistic sweep (3 due rows) after each submission; protected route `/api/notifications/process` (bearer `CRON_SECRET`); manual `retry_notification`. **No worker/cron is configured** and no `vercel.json` exists; the owner must schedule the route (see `docs/SUPABASE_SETUP.md` §5).

## 4. Rate limiting and idempotency

- **Rate limit store:** Postgres (`check_rate_limit`, fixed window, atomic upsert) — shared across serverless instances. Keys are HMAC-SHA256 of IP / mobile with `RATE_LIMIT_SECRET`; raw values are not stored. Limits: IP 8 per 10 min, mobile 3 per hour (**provisional**, owner to confirm). **Fails closed** if the store is unreachable. IP comes from the first `x-forwarded-for` entry (validated), then `x-real-ip`, else `unknown`.
- **Idempotency:** browser generates a UUID per form, reuses it after failures, rotates it after success; `UNIQUE(idempotency_key)`; repeat or racing submits return the original reference.
- **Honeypot:** `website` field checked on raw input first; bots get a fake success and nothing is stored.
- Other controls: Zod validation of every field with bounds, mobile normalisation (+91/0/spaces), generic error messages only, provider/DB errors never returned or logged with customer data.

## 5. Files

**New** — `supabase/migrations/20261118000000_enquiries.sql`, `supabase/tests/00_stub.sql`, `supabase/tests/01_enquiries.sql`; `src/lib/supabase/{errors,config,rest,test-utils}.ts` (+ `migration.test.ts`, `supabase.test.ts`); `src/lib/email/web3forms.ts` (+ test); `src/features/enquiries/{result,submission-schemas,actions}.ts`; `src/features/enquiries/server/{snapshots,rate-limit,submit,notifications,email-template,deps,test-helpers}.ts` (+ tests); `src/features/enquiries/security.test.ts`; `src/app/api/notifications/process/route.ts`; `src/app/api/catalogue/product/route.ts`; `src/proxy.ts`; `src/config/indexing.ts`; `src/features/products/stock.ts`; `src/components/common/honeypot-field.tsx`; `src/components/website/{use-enquiry-submit.ts,enquiry-received.tsx}`; tests `actions.test.ts`, `proxy.test.ts`, route tests, `indexing.test.ts`, `enquiry-forms.test.tsx`; docs `PHASE_6_REPORT.md`, `SUPABASE_SETUP.md`.

**Modified** — `src/lib/env/server.ts`; `src/features/enquiries/schemas.ts`; `src/features/catalogue/{parse,types,view,test-catalogue}.ts` (+ tests); `src/features/settings/business-settings.ts`; `src/components/website/{contact-form,bulk-enquiry-form,home-sections,home-content}.tsx`; `src/components/ui/status-badge.tsx`; `src/app/{layout,robots,not-found}.tsx|ts`; `src/components/website/{pages,website}.test.tsx`; `docs/{ENVIRONMENT,GOOGLE_SHEETS_SETUP,PROJECT_BLUEPRINT}.md`; `docs/sheets-template/BusinessSettings.csv`.

**Deleted** — `src/components/website/enquiry-not-connected-notice.tsx`.

(No Git repository exists, so this list is from my working notes rather than a diff.)

## 6. Environment variables

`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RATE_LIMIT_SECRET` (required for enquiries); `WEB3FORMS_ACCESS_KEY` (optional — enquiries save without it); `CRON_SECRET` (only for the sweeper route); `SITE_INDEXING` (launch switch). Details and a ready-to-append `.env.example` block: `docs/ENVIRONMENT.md`. `.env.example` itself is masked in the sandbox and **was not updated**.

## 7. Supabase live connectivity — NOT TESTED

No credentials were available. The migration and functions **were** executed on a real local PostgreSQL 16 (single-user mode) with self-asserting SQL covering transaction rollback, idempotency, outbox claim/lease/backoff/retry, stale writers, rate limiter and privileges. That is not a test of Supabase itself.
**RLS enforcement is untested** (the test backend is a superuser and bypasses RLS); only "RLS enabled, no policies, privileges revoked, functions locked to `service_role`" are asserted.

## 8. Web3Forms live delivery — NOT TESTED

No access key. The client is tested with mocked `fetch` (success, provider rejection, HTTP errors, timeout, malformed response, secret not leaked). **No real email was sent.** Web3Forms' terms for server-side use on the free plan need to be verified with the provider.

## 9. Tests and build

Run on 2026-11-18, after the final code change:

- `npx tsc --noEmit` — clean.
- `npx eslint .` — clean.
- `npx prettier --check` — see final run below.
- `npx vitest run` — **37 files, 760 tests passed**.
- `npm run build` — succeeded; routes `/api/catalogue/product`, `/api/notifications/process` dynamic; `ƒ Proxy (Middleware)` compiled; customer pages still partially prerendered.
- Bundle check: none of `SUPABASE_SERVICE_ROLE`, `rest/v1/rpc`, `api.web3forms.com`, `RATE_LIMIT_SECRET`, `CRON_SECRET`, `WEB3FORMS_ACCESS_KEY`, `create_enquiry`, `notification_outbox`, `service_role` appear in `.next/static`.
- Coverage of the requested list: bulk/general validation; WhatsApp message without persistence; multiple snapshots; authoritative lookup; invalid ids; inactive products; `AVAILABLE_ON_ORDER`; missing/invalid prices; transaction rollback (SQL); duplicate submissions; outbox creation; email success/failure; retry + idempotency; rate limiting; honeypot; secret protection and import boundaries; privilege boundaries (static + SQL).

## 10. Browser testing — NOT PERFORMED

The sandbox cannot start a server or browser. Form behaviour was tested with Testing Library (jsdom) only. No real browser, device or viewport was checked, and the real HTTP 404 for unknown products was **not observed**.

## 11. Remaining blockers / owner actions

1. Create the Supabase project, apply the migration, set the env vars, run the checklist in `docs/SUPABASE_SETUP.md` §4 (includes confirming RLS with the anon key).
2. Provide a Web3Forms key and send a real test enquiry; confirm delivery.
3. Provide Google credentials and verify live Sheets reads (`docs/GOOGLE_SHEETS_SETUP.md` §7).
4. Schedule `/api/notifications/process` if automatic retries are wanted.
5. Append the Phase 6 block to `.env.example`.
6. Confirm the provisional rate limits and the sequential reference-number format.
7. Browser pass: forms, success/error states, 404 status for an unknown product slug, mobile layout.
8. Set `SITE_INDEXING=enabled` only at launch.

## 12. Phase 7+

Not started. No admin authentication, dashboard, enquiry-management screens, product management or Cloudinary work was done.

## 13. Git / GitHub

No commits, pushes or GitHub operations were performed.
