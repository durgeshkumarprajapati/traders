# Phase 13 — Advanced customer features, construction tools, material planning & engagement

Status: **implemented and verified by automated checks; NOT deployed, NOT browser-tested, NO migration applied, NO live integration verified.**
Nothing was committed, pushed or deployed. No production environment variable was changed. No service was purchased.

## 1. Summary by feature

| #   | Feature                                          | Status                                                                                     | What is true today                                                                                                                                                                                                                                                                                                                                                                                |
| --- | ------------------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Material calculator `/tools/material-calculator` | **IMPLEMENTED** (unit-tested, not browser-tested)                                          | Concrete, cement/sand/aggregate by mix, brick/block, conservative steel. Assumptions in `features/calculator/config.ts`; formulas and steps shown; theoretical vs rounded purchase quantities; disclaimers incl. the required steel wording. "Add to enquiry" goes through the existing bulk flow, which re-validates on the server.                                                              |
| 2   | Project planner `/tools/project-planner`         | **IMPLEMENTED** (not browser-tested)                                                       | Local, versioned, multiple projects, no login. Prefills the bulk enquiry; nothing is sent until the customer submits there.                                                                                                                                                                                                                                                                       |
| 3   | Product comparison `/compare`                    | **IMPLEMENTED** (not browser-tested)                                                       | Max 3, "Not specified" for gaps, no ranking, unit differences flagged, local persistence, inactive products dropped, shareable URL.                                                                                                                                                                                                                                                               |
| 4   | Saved material lists `/my-material-lists`        | **IMPLEMENTED** (not browser-tested)                                                       | Local and versioned (corrupt/future data backed up, never destroyed); prices and stock refreshed from the catalogue; "Send this list as enquiry" uses the bulk flow with review. Never cached by the service worker.                                                                                                                                                                              |
| 5   | Delivery check `/delivery-check`                 | **IMPLEMENTED; empty until the owner configures it**                                       | PIN coverage comes from the BusinessSettings sheet (`delivery_*` rows). Six-digit validation. Wording never guarantees delivery, a time or a price. Freight enquiry = existing GENERAL enquiry + `enquiry_metadata` (kind DELIVERY), coverage recomputed on the server at submission. Metadata is stored only after migration `20261125000000`; before it, the enquiry is still saved without it. |
| 6   | Rate alerts `/rate-alerts`                       | **FOUNDATION ONLY — BLOCKED on an email provider**                                         | Database, daily cron, detection, consent, double opt-in, hashed tokens, unsubscribe and admin page are built and tested. `loadCustomerEmailProvider()` returns `null`, so the public page says "not available", nothing is stored, and no subscription is ever falsely confirmed.                                                                                                                 |
| 7   | QR product sharing                               | **IMPLEMENTED** (tests decode the QR with an independent reader; not scanned with a phone) | `/api/qr/product/[slug]` (PNG/SVG, canonical public URL only, active products only), share panel on product pages, admin print labels `/admin/qr-labels`.                                                                                                                                                                                                                                         |
| 8   | Ask a Materials Expert `/ask-expert`             | **IMPLEMENTED without photo upload**                                                       | Structured GENERAL enquiry + metadata (kind EXPERT). No AI. Photo upload is **BLOCKED** (no safe upload path exists — see §9); the page offers WhatsApp for photos.                                                                                                                                                                                                                               |

## 2. Rules kept

No login, payments, separate backend, shadcn/ui, AI answers, invented prices/stock/delivery promises/specs/GST. Google Sheets remains the catalogue source of truth. No test was weakened or deleted (existing assertions were only updated where the product behaviour deliberately changed — see §10).

## 3. Architecture

- Client-side state: `features/material-lists` (shared by planner, saved lists and the calculator hand-off) and `features/compare` use `useSyncExternalStore` stores over versioned localStorage with recovery, backup and size limits. Only product ids and quantities are stored; prices come from the server on every load (`resolveMaterialItemsAction`, public, read-only, ≤100 ids).
- Enquiries: freight and expert reuse `persistAndNotify` (exported from `submit.ts`) so they get the same rate limiting, honeypot, idempotency, tracking token, outbox/notification and admin inbox. New services live in `features/enquiries/server/requests.ts`; actions in `features/enquiries/request-actions.ts`.
- Rate alerts: `features/rate-alerts/` (types, `server/service.ts`, actions), `lib/email/provider.ts` (the only place a provider can be added), `app/api/rate-alerts/process/route.ts` (CRON_SECRET), `vercel.json` cron `30 2 * * *` (08:00 IST, daily).
- QR: `features/qr/qr.ts` (server-only, `qrcode` library).

## 4. Database (not applied)

- `20261125000000_enquiry_metadata.sql` — `enquiry_metadata` table (kinds DELIVERY, EXPERT; size-limited jsonb; admin read via RLS) and a `create_enquiry` that stores metadata atomically with the enquiry. Tests: `supabase/tests/05_enquiry_metadata.sql`.
- `20261126000000_rate_alerts.sql` — `rate_alert_subscriptions`, `product_price_snapshots`, `rate_alert_notifications` and seven service-role-only functions. Prices are integer paise (bigint) so comparison is exact; one notification per subscription per day (unique constraint); token hashes are not readable by admins (column-level grant). Tests: `supabase/tests/06_rate_alerts.sql`.
- Both run in the real-PostgreSQL single-user harness (`migration.test.ts`) together with every earlier migration. **Limitation:** that harness runs as superuser, so RLS _enforcement_ is not exercised (a canary test shows this); structural checks cover privileges, grants, RLS enabled and policies on every table.

### Applying (owner, in order; this repo applied nothing)

1. Back up / confirm a restore point. 2. `supabase db push` (or run files in order) for `20261124000000` (if not yet applied), `20261125000000`, `20261126000000`. 3. Run the verification SQL in `DATABASE_MIGRATIONS.md`. 4. Deploy the code. The code tolerates a missing `20261125000000` (enquiries save without metadata; the admin badge simply does not appear) but rate-alert admin data needs `20261126000000`.

## 5. Security

- Public actions validate with zod on the server, strip unknown keys, rate-limit by HMAC-hashed IP/mobile/email, honeypot silently ignored, idempotency keys prevent duplicates.
- Freight coverage is recomputed server-side; a coverage status sent by the browser is ignored (test).
- Tokens: derived by HMAC from the subscription id and `RATE_LIMIT_SECRET`; only SHA-256 hashes are stored; links carry them in the URL **fragment** (never sent to the server or logs); the confirm/unsubscribe pages are `noindex`, `no-referrer`, and remove the fragment from the address bar after reading.
- The same message is returned whether an address is new or already subscribed (no enumeration).
- QR route accepts only a slug of an active product, size 128–1024, and encodes only `NEXT_PUBLIC_SITE_URL` + path.
- Service worker: never intercepts `/my-material-lists`, `/rate-alerts/confirm|unsubscribe`, `/api/**`; the new public pages are added to the allowlist and tested in the real `sw.js`.
- Client bundle scanned: no secret names, no `qrcode`/`jsqr`/`pngjs`. `npm audit`: 0 vulnerabilities.

## 6. Pre-existing defects found and fixed

1. **Production-breaking:** `submit.ts` validated the reference returned by `create_enquiry` with the _old_ sequential regex; after the previous phase's migration (random references) every enquiry would have been reported as failed. Now one shared `ENQUIRY_REFERENCE` accepts both formats (tests include a hostile-reference case).
2. The site header showed an invented fallback location ("Raipur Depot") and invented opening hours when settings were empty. They now render only if configured.

## 7. Admin

`/admin/rate-alerts` (status, counts, last snapshot, recent subscriptions/notifications, provider state); freight/expert badges in the enquiry list and a labelled detail panel (allow-listed keys, plain text); `/admin/qr-labels`; BusinessSettings delivery fields; sidebar entry.

## 8. Navigation, SEO, PWA

`/tools` landing page; "Tools" in header/footer; sitemap entries; robots disallow for `/my-material-lists` and token pages; canonical URLs and descriptions on every new page; offline allowlist extended.

## 9. Blockers needing owner decisions

- **Email provider** for rate alerts (and any customer email). Needs approval, a verified sender domain (SPF/DKIM), a bounce/suppression policy, then an implementation of `CustomerEmailProvider` in `lib/email/provider.ts`. Web3Forms cannot do this.
- **Expert photo upload** needs a signed-upload path (e.g. Cloudinary signed uploads), size/type limits and malware/retention decisions. Not built; WhatsApp is offered.
- **Delivery area**: owner must fill `delivery_enabled`, `delivery_pincodes` (and optional localities/notes/terms) in BusinessSettings. Until then the page says coverage is not published.
- Applying the migrations (§4).

## 10. Tests changed for deliberate behaviour changes

`parse.test.ts` (settings default gained `delivery`), `submit.test.ts` / `fallback-submit.test.ts` (reference format), `security.test.ts` (new routes/modules in the allow-lists), `indexing.test.ts` (robots list), `enquiries.test.ts` (admin metadata query), `service-worker.test.ts` (more pages, more bypasses added; nothing removed). `FakeSupabase` now issues random-format references like the database.

## 11. Verification actually run (2026-11-24)

| Check                     | Result                                                                       |
| ------------------------- | ---------------------------------------------------------------------------- |
| `tsc --noEmit`            | clean                                                                        |
| `eslint src`              | clean                                                                        |
| `prettier --check src`    | clean                                                                        |
| `vitest run`              | **1696 passed, 89 files** (includes the real-PostgreSQL migration/SQL suite) |
| `next build`              | succeeded; all new routes present                                            |
| Client bundle secret scan | no hits                                                                      |
| `npm audit`               | 0 vulnerabilities                                                            |

## 12. NOT TESTED (honest list)

- **Any real browser** (layout at phone/tablet/desktop, keyboard and screen-reader use, print of QR labels, the fragment-token pages, localStorage in private mode, install/offline behaviour). Component tests run in jsdom only.
- **Scanning a QR with a real phone** (tests decode with an independent library).
- **Live Supabase**: migrations were run only in a local PostgreSQL harness; RLS enforcement and PostgREST grants against a real project are unverified.
- **Live Google Sheets** delivery settings and price snapshots; the Vercel cron firing; `CRON_SECRET` behaviour on Vercel.
- **Any email**: no provider exists, so no customer email was or could be sent.
- Freight/expert enquiries end-to-end against the real database and Web3Forms notification.

## 13. Manual browser checklist (owner / QA)

1. Calculator: each of the four calculators, change units, read formulas; steel disclaimer visible; "Add to enquiry" → bulk form prefilled, nothing sent.
2. Planner: create 2 projects, reload, edit, delete; submit one as an enquiry.
3. Compare: add 3 products, try a 4th, reload, open the shared URL in a private window; deactivate a product in the sheet and reload.
4. Saved lists: save, reload, change a price in the sheet, confirm refresh; corrupt the localStorage value and confirm it recovers.
5. Delivery check: with the sheet empty (expect "not published"), then with PINs listed; try `12345`, `012345`, letters; send a freight enquiry; confirm admin badge/detail.
6. Ask expert: submit; confirm GENERAL enquiry with the expert panel; WhatsApp button only if configured.
7. QR: open `/api/qr/product/<slug>?format=png&size=512`, scan with a phone; print `/admin/qr-labels?ids=...`.
8. Rate alerts: page shows "not available"; admin page shows provider off.
9. Offline: visit `/tools`, go offline, reload; confirm `/my-material-lists` is never served offline.
10. Check phone width (360 px) for every new page for horizontal scroll.

## 14. Rate-alert operating notes

Daily at 02:30 UTC the job (when `CRON_SECRET` is set) reads the **live** sheet only (the static fallback is never snapshotted, so an outage cannot look like a price change), records snapshots, queues changes and — only if a provider exists — sends. With no provider it still records snapshots so history exists on day one. Failures retry up to 5 times.

## 15. Rollback

Code: redeploy the previous build. Database: both migrations are additive; to remove, drop the three rate-alert tables and their functions, and `enquiry_metadata` (re-create the previous `create_enquiry` from `20261124000000`). No data other than the new tables depends on them.

## 16. Awaiting approval

Per the standing instruction, work stops here: no commit, push, deploy or migration until the owner approves.
