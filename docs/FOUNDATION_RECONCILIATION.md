# Phase 2 Foundation Reconciliation Review

> **UPDATED 2026-11-18 (documentation corrections applied).** Owner decisions have been applied: see section 4A (approved items with phase allocation) and section 5 (decisions resolved). The authoritative specification is `PROJECT_BLUEPRINT.md`. **No source files have been changed; the foundation fixes have not been started.**

Date: 2026-11-18 · Scope: review only — **no source files were changed**. Compares the existing foundation (built before Phase 0) with the Phase 0 audit, the approved decisions (`DECISIONS.md`) and Phase 1 (`DESIGN_SYSTEM.md`, `COMPONENT_USAGE.md`).

Verified state: `tsc`, ESLint, 26 tests, `next build` pass. Not run: any live server (sandbox refused to start one), browser, e2e, axe, Lighthouse.

Severity: **H** blocks a later phase or production · **M** fix during/before the named phase · **L** housekeeping.

---

## 1. The three checks requested

### 1.1 Token enforcement (ESLint) — works, with 3 gaps

Tested with sample code:

| Case                                                                                                                                                           | Result         | Verdict                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------- |
| `bg-primary/90`, `text-on-surface-variant`, `border-info`, `shadow-overlay`, `outline-primary`, `accent-primary`, `bg-on-surface/50`, `hover:bg-surface-muted` | allowed        | ✅ legitimate semantic use not blocked                                                                         |
| cva variant maps, `fill="currentColor"`                                                                                                                        | allowed        | ✅                                                                                                             |
| `text-gray-500`, `bg-[#fff]`, `dark:*`                                                                                                                         | blocked        | ✅ intended                                                                                                    |
| `style={{ width: "40%" }}` / CSS-variable styles                                                                                                               | **blocked**    | ⚠ **Gap A**                                                                                                    |
| Prose string containing `"text-red-500"`                                                                                                                       | blocked        | ⚠ Gap B (rare)                                                                                                 |
| `text-black`, `text-white`, `bg-white`, `bg-black`                                                                                                             | **not caught** | ⚠ **Gap C** — these classes don't exist (colour namespace cleared) so they fail _silently_ (no colour applied) |
| Hex in non-class contexts (`fill="#17365D"`, OG-image `background: "#17365D"`)                                                                                 | not caught     | ⚠ Gap D — duplicated token values                                                                              |

Recommendations (not applied):

- **A (M):** Allow `style` only for runtime-dynamic values (progress width, CSS custom properties); keep banning static styling. Needed by Phase 10 upload progress and any dynamic-width bar. Interim escape hatch: `// eslint-disable-next-line … -- reason`.
- **C (L):** Add `\b(text|bg|border)-(black|white)\b` to the rule with message "use `on-surface` / `surface`".
- **D (M):** Create one TS export of brand colours (e.g. `src/config/brand.ts`) for places CSS variables can't reach: Open Graph images, `manifest` `theme_color`, email/HTML notification templates, maps. Must mirror `tokens.css`; add a unit test asserting they match.
- Document: never build class names dynamically (`bg-${tone}`) — Tailwind will not generate them. Use lookup maps (as `badge.tsx` does).

### 1.2 Production isolation of `/dev/components` — route is a 404, but code still ships (M)

Evidence from the production build:

- `.next/server/app/dev/components.meta` → `"status": 404`; prerendered HTML has no showcase content. ✅ **Route is unavailable in production.**
- `robots.ts` disallows `/dev`. ✅
- `vitest`, `jsdom`, testing-library, `prettier` are `devDependencies` and absent from the app bundle. ✅
- ❌ **The showcase client code is emitted as a public static chunk** (`.next/static/chunks/42iipl_daaova.js`, ~38 KB containing showcase strings) because the page statically imports `Showcase`. It cannot be reached through the app, but the file is fetchable if its URL is known, and it adds build weight. Also the route appears in `routes-manifest`/`prerender-manifest`.
- Not verified: HTTP behaviour of a running server (sandbox refused `next start`). Please run `npm run build && npm start` and `curl -i localhost:3000/dev/components` (expect 404).

Recommended fix (before Phase 3): load the showcase only behind a build-time constant (`if (process.env.NODE_ENV !== "production") { const { Showcase } = await import(...) }`, so the bundler dead-code-eliminates it), or exclude the directory from production routes entirely (e.g. only add the route via a dev-only mechanism). Re-verify by grepping `.next/static` for showcase strings and expecting zero hits.

### 1.3 Accessibility — adopted as acceptance criteria

Implemented in Phase 1 and covered by unit tests: native `<dialog>` (focus trap, Esc, inert background), `alertdialog` role, `Field` wiring (`aria-describedby`, `aria-invalid`, required), tab keyboard model (arrows/Home/End, roving tabindex), `role=alert/status` notifications, `aria-current` on pagination/breadcrumbs, reduced-motion handling, visible `:focus-visible`.

Acceptance criteria to be checked **per real workflow** (to add to each phase's checklist):

1. Every interactive element reachable and operable by keyboard; visible focus; logical order.
2. Dialogs: focus moves in on open and **returns to the trigger on close**; Esc closes; backdrop click never loses unsaved data silently.
3. Errors: text message (not colour alone), tied to the field via `aria-describedby`, `aria-invalid`; form-level summary receives focus on failed submit.
4. Status changes (toast, save, enquiry submitted) announced via live regions.
5. Icon-only controls have accessible names; decorative icons `aria-hidden`.
6. Contrast: verify `on-surface-variant #4B5563` on white (≈7.6:1 ✅), `warning #B45309` on white (≈5.0:1 ✅ AA text), amber `#F5A623` with black text ✅; **do not** use amber as text on white. Needs a measured pass in Phase 11.
7. Not yet done: skip-to-content link, `aria-current` on active nav items, automated checks (axe) — see §3.

---

## 2. Phase 2 requirement matrix

| #   | Phase 2 requirement           | Status                 | Notes                                                                                                                                                                                                                                                                                         |
| --- | ----------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Next.js App Router            | ✅                     | 16.4.6; `cacheComponents` + `partialPrefetching` set explicitly (matches docs)                                                                                                                                                                                                                |
| 2   | Strict TypeScript             | ✅                     | `strict: true`. Optional hardening: `noUncheckedIndexedAccess`; `allowJs` unneeded                                                                                                                                                                                                            |
| 3   | Tailwind + shadcn/ui          | ⚠ **Conflict (M)**     | Tailwind ✅. **shadcn/ui not used** — Phase 1 built a custom cva + native-`<dialog>` library. Plan §1 lists shadcn/ui. Needs a recorded decision: accept custom library (recommended: shadcn would bring Radix defaults/colour tokens that clash with the cleared palette) and amend the plan |
| 4   | ESLint + formatting           | ✅ / ⚠                 | Prettier configured; not part of `lint`/CI script; no pre-commit hook (git deferred)                                                                                                                                                                                                          |
| 5   | Feature-oriented architecture | ⚠                      | Directories exist but `features/`, `hooks/`, `types/`, `app/api/` are empty; `lib/{google-sheets,supabase,cloudinary,email,whatsapp,validation}` not created. Expected — created in their phases. Empty dirs aren't tracked by git                                                            |
| 6   | Public website layout         | ⚠                      | Header/footer present. Missing: mobile navigation, announcement-banner slot, skip link, call/WhatsApp actions (Phase 3). Text wordmark only (approved)                                                                                                                                        |
| 7   | Admin layout                  | ⚠                      | Sidebar + main only. Missing: header/profile menu, breadcrumbs, mobile drawer, `aria-current`, `ToastProvider`, auth (Phase 7/8). Uses raw `p-6` instead of a token                                                                                                                           |
| 8   | Admin login layout            | ❌ **(H for Phase 7)** | `/admin/login` currently inherits the sidebar layout. Needs route groups: `admin/(auth)/login` and `admin/(console)/…`. This **moves existing stub files** — acceptable here, since structure change is required, not cosmetic                                                                |
| 9   | Shared navigation & footer    | ⚠                      | Centralised in `config/navigation.ts`. Footer is a copyright only; business data must come from BusinessSettings (Phase 4/5)                                                                                                                                                                  |
| 10  | Env validation                | ⚠                      | Zod schemas exist. Server env validated **lazily** (`serverEnv()`), never called → no fail-fast at boot; `publicEnv` is unused (e.g. `metadataBase` not set). Add `instrumentation.ts` check or call at module load of each integration                                                       |
| 11  | Centralised error handling    | ⚠                      | `AppError`/`toErrorResponse` ✅. Missing: route-handler/server-action wrapper, Zod-error mapping, `global-error.tsx`, segment-level `error/not-found/loading` for `/admin`. `error.tsx` doesn't log and uses `reset` (works per docs, but Next 16 recommends **`retry`**)                     |
| 12  | Logging                       | ⚠                      | JSON console logger with top-level key redaction. Gaps: nested objects not redacted; `Error` instances serialise as `{}` (stack/message lost); no request/correlation id                                                                                                                      |
| 13  | Server-only boundaries        | ✅ (partial)           | `lib/env/server.ts` imports `server-only`; vitest aliases it. Each future integration module must do the same; add a lint rule/test that `lib/{google-sheets,supabase/admin,cloudinary,email}` import it                                                                                      |
| 14  | Basic security headers        | ✅ (basic)             | nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, HSTS. CSP deferred to Phase 11. Add `Cache-Control: no-store` for `/admin/*` with Phase 7                                                                                                                                 |
| 15  | Test infrastructure           | ⚠                      | vitest + testing-library (26 tests). Missing: e2e (Playwright), axe accessibility checks, coverage config                                                                                                                                                                                     |

---

## 3. Conflicts and gaps by source

### With approved decisions

| ID  | Finding                                                                                                                           | Sev | Proposed resolution                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Decision 1 (Categories & Brands on one screen) vs stub routes `/admin/categories` **and** `/admin/brands` and two sidebar entries | M   | One route (e.g. `/admin/catalog` or keep `/admin/categories`) with `Tabs` (`?tab=brands`); one nav item "Categories & Brands"; remove `/admin/brands` stub |
| D2  | Decision 2/7 (contact → Supabase enquiry; outbox) — no `api/`/action convention chosen                                            | M   | Choose: Server Actions for forms, route handlers for cron/retry endpoint (Vercel Cron). Decide in Phase 6 kickoff                                          |
| D3  | Decision 4 (white canvas)                                                                                                         | ✅  | Header/footer/sidebar are white; no navy sections exist                                                                                                    |
| D4  | Decision 3 (SKU)                                                                                                                  | —   | Phase 4 task; no foundation impact                                                                                                                         |

### With Phase 0 audit

| ID  | Finding                                                                                                             | Sev                  | Resolution                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Missing routes from designs: `products/[slug]`, `admin/products/new`, `admin/products/[id]`, `admin/enquiries/[id]` | M                    | Add stubs when Phase 3 / 9 start                                                                                                                           |
| A2  | Stub pages are **indexable** and display "Phase N will implement…" text                                             | **H for any deploy** | Never deploy before Phase 3 content; or add `noindex` + remove placeholder copy until then                                                                 |
| A3  | `src/app/favicon.ico` is the Next.js default                                                                        | L                    | Replace when a logo/brand mark is supplied (do not invent one)                                                                                             |
| A4  | `README.md` is the create-next-app default                                                                          | L                    | Replace with project README (Phase 12 docs, or sooner)                                                                                                     |
| A5  | Demo-content gate (R1) not yet automated                                                                            | M                    | Add a test/script that fails the build if known demo strings (`98000 00000`, `27AABCS0000A1Z5`, `sagartraders-demo`, `admin123`, `[Demo`) appear in `src/` |
| A6  | Admin mobile layout undesigned (R13)                                                                                | M                    | Phase 8: sidebar → `Drawer` below `lg`; needs design approval since Stitch has none                                                                        |

### With Phase 1

| ID  | Finding                                               | Sev | Resolution                                                                                                                                                                              |
| --- | ----------------------------------------------------- | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | `/dev/components` code ships in a public chunk (§1.2) | M   | Dead-code-eliminate in production                                                                                                                                                       |
| P2  | `ToastProvider` not mounted anywhere                  | L   | Mount in admin layout in Phase 8                                                                                                                                                        |
| P3  | `Drawer` exit animation (150ms ease-in)               | —   | Deferred by decision; implement when first used                                                                                                                                         |
| P4  | Searchable select                                     | —   | Deferred by decision                                                                                                                                                                    |
| P5  | Visual comparison vs Stitch                           | —   | **Blocked** until screenshots/reference images exist                                                                                                                                    |
| P6  | `metadataBase`, `lang="en"`                           | L   | Set `metadataBase` from `publicEnv.NEXT_PUBLIC_SITE_URL`; consider `lang="en-IN"`                                                                                                       |
| P7  | Currency glyph ₹                                      | ✅  | Verified: build self-hosts Inter `latin-ext` (covers U+20B9). It isn't preloaded (only `latin` is), so a brief fallback flash is possible; consider adding `latin-ext` to the `subsets` |

### Housekeeping

- Stray empty `src/.claude/.cc-writes` directory (tool artefact) — safe to ignore/remove; `tsconfig.tsbuildinfo` is git-ignored.
- No `engines`/`.nvmrc` pin (Vercel picks Node version): add `"engines": {"node": ">=22"}` or `.nvmrc` (dev machine is Node 24).
- `AGENTS.md` is regenerated by `next dev`; commit it with the first commit.

---

## 4. Original proposed follow-up work (historical — superseded by §4A)

**Before Phase 3 (small, foundation fixes):**

1. Isolate `/dev/components` from production bundles (P1) and re-verify.
2. Admin route groups for login vs console (row 8) and merge Categories/Brands routes (D1).
3. Add stubs for missing detail routes (A1); mark placeholder pages `noindex` (A2).
4. `error.tsx` → `retry`, add logging; add `global-error.tsx`, admin `error.tsx`/`loading.tsx`/`not-found.tsx` (row 11).
5. Logger: serialise `Error`, redact nested keys (row 12).
6. ESLint: narrow `style` allowance, add black/white hint (Gaps A, C); brand-colour TS export + parity test (Gap D).
7. Skip-to-content link, `aria-current` on nav, `metadataBase`, `engines`.
8. Decide shadcn/ui (row 3) and record it; add axe tooling (`vitest-axe`/`jest-axe`) — **requires dev-package install by you**.

**During Phase 3:** header mobile nav, announcement slot, footer from settings, demo-string gate (A5).
**Phase 4+:** SKU, `server-only` guards for each integration, env fail-fast.
**Phase 6:** server action vs route-handler convention, outbox schema.
**Phase 8:** admin mobile drawer, toast provider, header/profile.
**Phase 11:** CSP, `sitemap.ts`, measured contrast/axe/Lighthouse.

## 4A. Approved items and phase allocation (authoritative)

Status: **approved; implementation not started; each batch needs separate authorisation.** Same table as `PROJECT_BLUEPRINT.md` §26.1.

| #   | Item                                                                                                            | Timing                           | Verification required                                               |
| --- | --------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------- |
| 1   | Isolate `/dev/components` from production bundles                                                               | Before Phase 3                   | 404 in production **and** dev-only JS absent from production output |
| 2a  | Merge Categories and Brands into `/admin/categories` (tabs); one sidebar entry; remove/redirect `/admin/brands` | Before Phase 3                   | One nav entry, one page                                             |
| 2b  | Admin login/console route groups                                                                                | **Phase 7** (not pulled forward) | Login without console sidebar                                       |
| 3a  | Missing route stubs                                                                                             | Before Phase 3                   | Routes build                                                        |
| 3b  | `noindex` on placeholder pages                                                                                  | Before Phase 3                   | Metadata verified                                                   |
| 4   | Error boundaries and recovery (`global-error.tsx`, Next 16 `retry`, logging, admin segment boundaries)          | Before Phase 3                   | Build + tests                                                       |
| 5   | Logger serialisation and redaction — no passwords, tokens, service-role keys or **nested** secrets exposed      | Before Phase 3                   | Nested/array/`cause` unit tests                                     |
| 6a  | ESLint: restricted dynamic inline styles                                                                        | Before Phase 3                   | Lint tests                                                          |
| 6b  | ESLint: black/white class hints                                                                                 | Before Phase 3                   | Lint test                                                           |
| 6c  | Brand-colour TypeScript export                                                                                  | Before Phase 3                   | No other hard-coded hex                                             |
| 6d  | Token/export parity test                                                                                        | Before Phase 3                   | Test passes/fails correctly                                         |
| 7   | Skip link, `aria-current`, `metadataBase`, `engines`                                                            | Before Phase 3                   | Manual keyboard check, build                                        |
| 8a  | shadcn/ui: custom library only                                                                                  | Documentation — done             | —                                                                   |
| 8b  | axe tooling                                                                                                     | Phase 11                         | —                                                                   |

## 5. Decisions — resolved

| Topic                                                                               | Decision                                                           |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| shadcn/ui                                                                           | Custom library only; do not introduce shadcn/ui                    |
| Categories & Brands                                                                 | `/admin/categories` with a Brands tab; one sidebar entry           |
| Contact transport                                                                   | Server Actions                                                     |
| axe                                                                                 | Deferred to Phase 11                                               |
| Stock statuses                                                                      | All four retained incl. `AVAILABLE_ON_ORDER` (info blue)           |
| Units                                                                               | Canonical value + display label; custom unit; `TON` ≠ `METRIC_TON` |
| Single-product enquiry                                                              | WhatsApp-only in v1 (not persisted)                                |
| Searchable select / drawer exit animation / logo / visual comparison / `user-event` | Deferred or recorded as blocked (see `DECISIONS.md`)               |

## 6. Current authorisation status

Phase 0 and Phase 1: approved. Reconciliation decisions: approved. Documentation corrections: applied. **Foundation-fix batch (§4A items marked "Before Phase 3"): implemented and verified 2026-11-18, awaiting owner acceptance** (tsc, ESLint, 107 tests, production build; static bundle proof; no running-server HTTP check). **Phase 3: not authorised.**
