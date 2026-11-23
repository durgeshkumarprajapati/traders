# Phase report — Customer experience features (tracking, product finder, callbacks, quotations, PWA)

**Project:** Sagar Traders · **Date:** 2026-11-23 · **Git:** no commits, pushes, branches or GitHub operations · **Deployment:** none · **Environment variables / paid services:** unchanged

> **This report replaces an earlier version of itself.** A previous pass had committed an implementation and a report that called every feature "complete". An audit against the specification found that it was not (details in §2), so the features were corrected rather than re-described. Statements below distinguish what was **verified** from what was **not**, and every unverified item is listed in §17–§19.

---

## 1. Executive summary

All five features exist, are wired together, and pass automated checks. The audit found and fixed a number of defects, several of them serious (a PDF that printed an invented bank account, a quotation workflow that could never issue, sequential enquiry references, search that matched the wrong products). The work is **not production-verified**:

- **No real-browser test of any kind** was possible in this environment (headless Chrome cannot start, Firefox and a local server were refused by the sandbox, and I did not work around that). Nothing was visually verified at any viewport, and no screenshots exist.
- **No live system was touched.** The database migration written in this phase has **not been applied** to any Supabase project; email was **not** sent; Google Sheets was **not** read.
- **Customer email is blocked by the provider** (§10): Web3Forms documents that server-side use needs a paid plan plus IP whitelisting, and it cannot email arbitrary recipients. Tracking-link email, status-change email and quotation email are therefore **not implemented** — they are not faked.
- **OTP is not implemented** (no SMS provider exists).

| Quality gate                                                          | Result (run after the final change)                                                                                                                                                            |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                                   | **PASS**                                                                                                                                                                                       |
| `npm run lint`                                                        | **PASS**                                                                                                                                                                                       |
| `prettier --check` on all repository files                            | **PASS** (`npm run format:check` also lists `EACCES` for `.bashrc`, `.zshrc`, `.bash_profile`, `.gitconfig`, `.env.example` — sandbox-masked files in the project root, not repository source) |
| `npm test`                                                            | **PASS — 73 files, 1,320 tests** (1,072 at the start of this audit; stable across 3 consecutive full runs)                                                                                     |
| `npm run build`                                                       | **PASS** — all new routes present, Proxy compiled                                                                                                                                              |
| `npm audit --omit=dev`                                                | **0 vulnerabilities**; no dependency was added or changed                                                                                                                                      |
| Client-bundle scan                                                    | **0** occurrences of 18 server-only identifiers/secret names in `.next/static`                                                                                                                 |
| Real PostgreSQL 16 run of all migrations + 4 self-asserting SQL files | **PASS** (single-user mode; cannot exercise RLS enforcement)                                                                                                                                   |

## 2. Existing architecture review — what the audit found

Reviewed: blueprint, decisions, design system, environment/Supabase/Sheets docs, risk register, phase 6–12 reports and the responsive audit; all migrations and SQL tests; enquiry, notification, admin-auth, catalogue, search, quotation and PWA code. Architecture constraints were kept: one Next.js app on Vercel, Supabase PostgreSQL + Auth, Google Sheets as the catalogue, the existing outbox, the custom UI kit, no new dependencies.

Defects found in the previously committed implementation and **fixed in this phase**:

| #   | Defect                                                                                                                                                                                                                                                   | Severity                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 1   | The quotation PDF shipped a built-in **fake bank account (SBI, A/C 31234567890), GSTIN, address, phone and email**, and printed the bank block on every PDF; the customer page also hard-coded an address, bank and tagline                              | Critical (invented business data) |
| 2   | PDF printed **invented payment/delivery terms** ("Advance via RTGS/NEFT…") and ignored the quotation's own terms; tax was never printed                                                                                                                  | Critical                          |
| 3   | The admin quotation list was **never given any quotations** (`<QuotationManager enquiry={…}/>` only), so a created draft could never be seen or issued — the workflow did not function                                                                   | Critical                          |
| 4   | After issuing, the page **reloaded and discarded the one-time customer link** (only its hash is stored), so the admin could never copy it                                                                                                                | High                              |
| 5   | Quotation creation/issuing was **not transactional** (quotation, items, status and history were separate statements)                                                                                                                                     | High                              |
| 6   | Issuing recorded `previous_status = "CONTACTED"` regardless of the real status — **fabricated history** — and could be repeated, silently re-issuing and rotating an issued quotation                                                                    | High                              |
| 7   | Quotation rows/items had **no database immutability**; defaults invented terms ("7 days", "Advance RTGS/NEFT") and a 0-rate line                                                                                                                         | High                              |
| 8   | Money used **floating-point**; references used `Math.random`; tax label "GST"                                                                                                                                                                            | Med                               |
| 9   | Enquiry references were **sequential** (`ENQ-2026-001000`)                                                                                                                                                                                               | High (spec)                       |
| 10  | The tracking page's "View quotation" link used the enquiry token against a route that only accepted quotation tokens — **it could never open**                                                                                                           | High                              |
| 11  | Tracking credentials were in the **query string** (logged by hosts, leaked via Referer)                                                                                                                                                                  | High                              |
| 12  | `/quotation/*` and its PDF had **no rate limiting, no no-store/noindex headers**; the page title leaked the customer's name                                                                                                                              | High                              |
| 13  | The tracking mapper copied `customer_name`, `mobile`, `email`, `message` from the database response if present (latent exposure); the admin page sent the token **hash** to the browser                                                                  | Med                               |
| 14  | PDF: single page only (long quotes drawn off-page), product names truncated, **corrupt cross-reference table** whenever any non-Latin-1 character appeared (`·`, `—`)                                                                                    | High                              |
| 15  | Search matched **inside words** ("int"→paint, "ent"→cement, "cement"→reinforcement), `cement` expanded to _binding wire_, **specifications were never searched** (array treated as a map), and `?q=constructor` **crashed** (prototype lookup)           | High                              |
| 16  | Related products = first four in the category (no brand/spec ranking); unit filter hard-coded a subset; no price-availability filter                                                                                                                     | Med                               |
| 17  | Callback: new idempotency key per submit (duplicate on retry), invented clock times in labels ("9:00 AM – 12:00 PM"), no email/message fields, date not validated server-side, confirmation lacked requested time and call/WhatsApp actions              | High                              |
| 18  | Service worker: only partly excluded `/api`, unbounded caches, no stale-time stamp, forced takeover on update, no network timeout; install prompt never remembered a dismissal and had no iOS guidance; manifest lacked `scope`/`id` and locked portrait | Med                               |
| 19  | Tracking/enquiry customer email and status notification were claimed but not implemented                                                                                                                                                                 | Med (honesty)                     |

## 3. Feature A — Enquiry tracking

Implemented: `/track-enquiry` (reference + token, loading / invalid / expired-or-revoked (deliberately identical) / rate-limited states), random references, hash-only random tokens (90-day expiry, revoke, rotate), fragment-based links, status timeline from real history, quotation summary, call/WhatsApp from settings, admin card (state, expiry, verified views, rotate, revoke). Full detail: `ENQUIRY_TRACKING.md`.
**Not implemented (blocked):** email the link to the customer; notify on status change; OTP.

## 4. Feature B — Smart product finder

Word-boundary search over name, brand, category, SKU, description, **specifications**, unit; narrow code-owned synonym dictionary; filters for category, brand, unit (from catalogue), availability, **price availability**; deterministic related-products ranking (brand, shared specs); add-to-enquiry on cards/detail/related with server-side re-validation. Full detail: `SMART_PRODUCT_SEARCH.md`.

## 5. Feature C — Callback requests

Reusable form (header, mobile menu, contact, product), required name + mobile, optional email/date/time/reason/message, IST-validated date, `GENERAL` type with `enquiry_callbacks`, one transaction with the outbox row, stable idempotency key, honest confirmation. Admin sees the request in the list and detail. Detail: `CALLBACK_WORKFLOW.md`.

## 6. Feature D — Digital quotations

Atomic draft / issue / revise, versioning, database-enforced immutability, exact arithmetic, admin-entered tax amount (no rate assumed), PDF (multi-page, wrapped, only configured facts), customer page and PDF behind revocable/rotatable hashed tokens with rate limiting and private headers, superseded/expired labelling, view auditing, copy / WhatsApp / open-in-email-app sharing. **No automatic email** (blocked). Detail: `QUOTATION_MANAGEMENT.md`.

## 7. Feature E — PWA

Manifest (id, scope, no orientation lock, temporary icons), allowlist service worker (network-first with timeout, bounded versioned caches, stamped pages, user-controlled updates), offline banner with save time and stale-price warning, install prompt (user-triggered native prompt, iOS instructions, 30-day dismissal), online-only enquiries. Detail: `PWA_IMPLEMENTATION.md`.

## 8. Database and migration changes

One new forward-only migration `20261124000000_customer_features_hardening.sql` (random references; four admin quotation functions; immutability triggers; integrity constraints; audit counters; replaced lookup functions; `set_updated_at` refinement) and `supabase/tests/04_customer_features_hardening.sql`. No table is dropped, no data rewritten. **Not applied to any live database.** Commands, verification SQL, RLS matrix and rollback: `DATABASE_MIGRATIONS.md`. **Deploy the migration before the code.**

## 9. Security and RLS verification

| Check                                                                                                           | Evidence                                                                        |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Anonymous cannot call any admin quotation function / any lookup function                                        | `has_function_privilege` assertions in real PostgreSQL                          |
| Non-admin and anonymous callers are refused by `create_quotation_draft` and create no rows                      | SQL test (sub claim empty / non-admin)                                          |
| No raw token anywhere: only SHA-256 hashes stored, 64-hex checked in SQL; raw token reaches only the admin once | SQL + vitest (`rpc` args asserted; logs asserted token-free)                    |
| Wrong reference / wrong token / expired / revoked → identical null                                              | SQL + `tracking.test.ts`                                                        |
| Customer payload contains no id, contact data, notes, outbox, keys                                              | SQL (`?` key checks) + mapper test with hostile response                        |
| Issued quotation cannot be edited, extended, deleted or returned to draft                                       | SQL (7 attempts, all refused)                                                   |
| A customer cannot modify quotation data                                                                         | no write path exists for customers; tables revoked for `anon`                   |
| Token brute force throttled; limiter fails closed                                                               | `access.test.ts` (21st attempt blocked; store failure blocks)                   |
| Private routes: no-store, noindex, no-referrer; excluded from robots                                            | `private-routes.test.ts` on the real Next config                                |
| Service worker never touches private traffic                                                                    | 20 blocked-URL cases run against the real `sw.js`                               |
| No secrets in client bundle                                                                                     | 18 identifiers → 0 hits                                                         |
| XSS / PDF injection                                                                                             | React escaping; PDF text escaped and Latin-1 normalised (test with `) Tj ET …`) |
| Admin routes remain protected                                                                                   | existing admin tests + new admin PDF route requires session                     |

**Not verified:** RLS _policy enforcement_ on a real Supabase project (test database is a superuser; owner checklist in `DATABASE_MIGRATIONS.md`). Residual: the quotation token is in the URL **path** and therefore in host request logs.

## 10. Email and notification integration

Provider facts were read from Web3Forms' documentation (pricing page returned 403, so prices/limits are **not verified**): _"Server side usage requires paid plan + server IP whitelisting"_; mail goes only to the inbox owning the access key (no per-request recipient); customer auto-reply is a paid browser-form feature.
Consequences: the owner-notification email is **unverified and may never deliver** on the free plan; customer-directed email cannot be built on this provider. The outbox, retries, idempotency and `POST /api/notifications/test` are unchanged and provider-agnostic; the test route now explains these limits. **Recommendation (needs owner approval; nothing switched or purchased):** a server-side transactional provider. Until then, links are shared by WhatsApp or the admin's own mail app. Mocked tests are **not** evidence of delivery.

## 11. Performance review

Search: in-memory over the cached catalogue per request, no per-keystroke request, no extra Sheets calls. PDF generation (measured, Node): **5 lines ≈ 2 ms / 6 KB; 30 lines ≈ 3 ms / 20 KB; 100 lines ≈ 10 ms / 60 KB** — far inside serverless limits; no dependency. Database: new lookups use existing unique indexes on the hash columns and `(enquiry_id, version)`; view counters are single-row updates. Service worker: bounded caches (40 pages / 120 assets). Not measured: real page weight, Core Web Vitals, cold starts.

## 12. Responsive and browser testing

**NOT TESTED.** No real browser, no viewport (320–1440), no keyboard/touch run, no PWA install, no offline test in a browser, no screenshots. All new layouts reuse the responsive primitives from the earlier audit (stacked tables, 44 px touch targets, `grid-cols-1` bases) and the new forms use the same patterns, but this is unverified. A manual checklist is in `FINAL_RESPONSIVE_AUDIT_REPORT.md` §F; add: `/track-enquiry`, `/quotation/<token>`, the callback dialog, the admin quotation dialog, the install prompt and the offline banner.

## 13. Automated test results

73 files / 1,320 tests pass. New or substantially extended: real-PostgreSQL migration + SQL suites (4 files); quotation server logic (34); quotation arithmetic and PDF integrity (21); access guard (4); tracking module (26); callback schema + persistence (15) and form (11); search (64) and view/related (4); service-worker behaviour (35); PWA UI (14); admin quotation manager (16); customer quotation view and tracking page (13); private-route headers (7); import-boundary guards. **Integration tests that used real PostgreSQL:** the migration/SQL suites only. Everything else is unit-level with fakes — not live proof.

## 14. Production build results

`next build` succeeds. New routes present: `/track-enquiry`, `/quotation/[token]`, `/offline`, `/manifest.webmanifest`, `/api/quotation/[token]/pdf`, `/api/admin/quotations/[id]/pdf`, `/api/notifications/test`; `ƒ Proxy` compiled. Not verified: running the built server, Vercel runtime/memory limits (estimated from the PDF measurements above).

## 15. Environment variables

**None added or changed.** Existing variables are reused (see `ENVIRONMENT.md`).

## 16. Manual Supabase / Vercel setup required

1. Apply `20261124000000_customer_features_hardening.sql` (and any earlier migration not yet applied) — **before** deploying the code; run the verification SQL. 2. Check RLS with the anon key. 3. Decide the email provider. 4. On Vercel Hobby, `vercel.json` cron `*/10 * * * *` needs a paid plan (daily only on Hobby). 5. Replace the temporary PWA icons with the real logo. 6. Run the browser checklist. 7. Optional: run `POST /api/notifications/test` to learn whether owner email delivers at all.

## 17. Live integrations verified

**None.** (Documentation facts about Web3Forms were read from its public docs; that is not a test of the account.)

## 18. Live integrations NOT verified

Supabase (migration, RLS, live reads/writes), Web3Forms delivery, Google Sheets, Vercel runtime and cron, real-browser rendering/PWA install/offline, SMS/OTP (not built), customer email (not built).

## 19. Known issues and risks

R25–R33 in `RISK_REGISTER.md`. Highlights: the email provider (R25); RLS untested live (R31); migration order (R32); PDF cannot print non-Latin scripts (R30); pre-existing enquiries have no status history (R33); quotation token in URL path (R26); no automatic customer email or OTP; unverified in real browsers.

## 20. Deployment readiness assessment

**Not ready to deploy yet.** Code and automated checks are green, but (1) the migration must be applied and verified first, (2) real-browser verification has not happened, (3) owner-notification email is unproven and likely non-functional on the free provider plan, and (4) the owner must decide the email provider before customer emails can exist. Nothing here blocks continued review; no deployment was performed.

## 21. Files created and modified

**Created:** `supabase/migrations/20261124000000_customer_features_hardening.sql`, `supabase/tests/04_customer_features_hardening.sql`, `src/features/quotations/{schemas.ts,server/access.ts}`, `src/app/api/admin/quotations/[id]/pdf/route.ts`; tests `src/components/admin/quotation-manager.test.tsx`, `src/components/website/{callback-modal,pwa-components,quotation-and-tracking}.test.tsx`, `src/config/private-routes.test.ts`, `src/features/enquiries/callback.test.ts`, `src/features/enquiries/server/tracking.test.ts`, `src/features/products/smart-search.test.ts`, `src/features/pwa/service-worker.test.ts`, `src/features/quotations/server/{access,quotations}.test.ts`.
**Modified (source):** `public/sw.js`, `next.config.ts`, `src/app/{manifest.ts,robots.ts}`, quotation page and PDF routes, track-enquiry page, admin enquiry page, `src/components/admin/{quotation-manager,enquiry-detail-view}.tsx`, `src/components/website/{callback-modal,quotation-view,track-enquiry-view,pwa-components,enquiry-received,product-filters,product-listing,product-detail,product-enquiry-panel,contact-content,site-header,use-enquiry-submit}.tsx|ts`, `src/features/admin/{actions,types,server/enquiries}.ts`, `src/features/catalogue/view.ts`, `src/features/enquiries/{callback-schemas,result,tracking-types,server/submit,server/tracking}.ts`, `src/features/products/{query,smart-search,synonyms,units}.ts`, `src/features/quotations/{actions,calculations,types,server/pdf,server/quotations}.ts`, `src/lib/email/web3forms.ts`.
**Modified (tests, to match deliberate changes — none deleted or weakened):** `src/features/pwa/pwa.test.ts` (function name; no portrait lock), `src/features/quotations/quotations.test.ts` (PDF now takes explicit business details — the old test depended on the invented defaults), `src/features/enquiries/{customer-features,security}.test.ts` (fragment tracking link; route allow-list), `src/config/indexing.test.ts` (private routes in robots), `src/app/api/notifications/test/route.test.ts` (hint text), `src/features/catalogue/view.test.ts`, `src/lib/supabase/migration.test.ts`.
**Docs:** this report; `ENQUIRY_TRACKING`, `SMART_PRODUCT_SEARCH`, `CALLBACK_WORKFLOW`, `QUOTATION_MANAGEMENT`, `PWA_IMPLEMENTATION`, `DATABASE_MIGRATIONS`, `EMAIL_SETUP`, `ENVIRONMENT`, `IMPLEMENTATION_PLAN`, `RISK_REGISTER`, `DECISIONS`. `.env.example` shows as modified in git but is **not** from this work.

---

### Per-feature status

| Feature                |                         Implemented                          |           Unit tested           |                     Integration tested (real PostgreSQL)                     | Browser tested | Live integration tested | Production verified |
| ---------------------- | :----------------------------------------------------------: | :-----------------------------: | :--------------------------------------------------------------------------: | :------------: | :---------------------: | :-----------------: |
| A Enquiry tracking     | Yes (email link, OTP, status email: **not built — blocked**) |               Yes               |             Yes (lookup, expiry, revocation, audit, privileges)              |     **No**     |         **No**          |       **No**        |
| B Smart product finder |                             Yes                              |               Yes               | n/a (pure logic over the cached catalogue; real catalogue pipeline fixtures) |     **No**     |         **No**          |       **No**        |
| C Callback             |                             Yes                              |               Yes               |           Partly (`create_enquiry` and callback row in SQL suites)           |     **No**     |         **No**          |       **No**        |
| D Quotations           |         Yes (email sending: **not built — blocked**)         |               Yes               |              Yes (atomicity, immutability, versioning, tokens)               |     **No**     |         **No**          |       **No**        |
| E PWA                  |                             Yes                              | Yes (real `sw.js` in a sandbox) |                                     n/a                                      |     **No**     |         **No**          |       **No**        |

**Awaiting your explicit approval before any deployment or further phase.**
