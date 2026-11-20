# Architecture (Phase 0 – proposed, pending approval)

> **SUPERSEDED IN PART — see `PROJECT_BLUEPRINT.md`.** The blueprint is the authoritative current specification (precedence: `PROJECT_BLUEPRINT.md` > `DECISIONS.md` > other documents). Sections of this document that conflict with it are marked **Superseded** below. Last reconciled: 2026-11-18.

One Next.js 16 App Router repo, one Vercel deployment. No separate backend.

```
Browser ─► Next.js (RSC + route handlers + server actions)
              │
              ├─ features/*/service  (business rules, Zod validation)
              │     ├─ lib/google-sheets  (products, categories, brands, settings)   [server-only]
              │     ├─ lib/supabase       (enquiries, enquiry_items, notes, admin_profiles) [server-only service role + SSR anon client]
              │     ├─ lib/cloudinary     (signed upload)                            [server-only]
              │     └─ lib/email          (Web3Forms)                                [server-only]
```

## Data ownership (unchanged from plan)

Sheets = products, prices, categories, brands, settings. Supabase = admin identity, enquiries (+ item snapshots, notes, notification state). Cloudinary = images. No product master data in Supabase; enquiry items store **snapshots** only.

## Next.js 16 specifics that shape the design

- `cacheComponents` is on: reading Sheets in a Server Component should use `"use cache"` + `cacheLife`/`cacheTag`, with `revalidateTag` after admin writes. Request-time data (cookies/session) must sit behind `<Suspense>`.
- `proxy.ts` (not middleware) for optimistic admin redirects; **each server action/route handler re-verifies the admin** (plan Phase 7 rule).
- Admin pages are dynamic and uncached; public catalog pages are cached with a short life (proposal: 5 min revalidate, max acceptable staleness 30 min).

## Pricing freshness policy (to approve)

Cache life 5 min; if Sheets fails and cached data older than 30 min, hide prices ("Rate unavailable — request quotation"); never show a price without "Last updated".

## Decisions requested — **Superseded (all resolved)**

The eight questions originally listed here were answered by the owner; the authoritative record is `PROJECT_BLUEPRINT.md` §27 and `DECISIONS.md`.

1. Categories/Brands: **one `/admin/categories` page with Categories and Brands tabs**, one sidebar entry (`/admin/catalog` not used; `/admin/brands` stub to be removed).
2. Contact form: **saved in Supabase as a `GENERAL` enquiry** (Server Actions) + email notification. Single-product WhatsApp enquiries are **WhatsApp-only, not persisted**; bulk enquiries are persisted (`BULK`).
3. **SKU added** (optional, unique when present). Firm and buyer type **dropped**. Stock quantity, IP and call-log UI excluded from v1.
4. Navy sections: **not approved** (navy/amber as component accents only).
5. Admin canvas: **white**, bordered cards (no gray canvas).
6. Icons: **Lucide**.
7. Status colours: **no tint tokens**; palette-only solid/outline badges; Quotation Sent = Info blue `#1D4ED8`.
8. Notifications: **durable outbox table** with attempts, delivery status and retry.

Additional approved decisions: four stock statuses (incl. `AVAILABLE_ON_ORDER`, info blue), canonical units + display labels + custom unit, custom UI library only (no shadcn/ui), foundation fixes allocated per `PROJECT_BLUEPRINT.md` §26.1.

## Admin Authentication and Authorization (Phase 7)

Phase 7 implements server-enforced authentication and authorization for the administrative console using Supabase Auth SSR (`@supabase/ssr`):

```
Browser ─────────────────► Next.js 16 (App Router)
                           │
                           ├─ proxy.ts (session cookie refresh, optimistic redirects)
                           │
                           ├─ (auth)/login (public login UI, redirect active admin)
                           │
                           └─ (console)/*  (layout calls requireAdminSession)
                                 │
                                 ├─ Server Actions (withAdminAction guard)
                                 ├─ Route Handlers (requireAdmin guard)
                                 │
                                 └─ Central Auth (src/lib/auth/admin.ts)
                                       │
                                       ├─ getUser() via createServerClient
                                       ├─ admin_profiles check (is_active = true)
                                       └─ Supabase DB (RLS + is_admin() function)
```

### 1. Supabase Client Architecture

- **Browser Client (`src/lib/supabase/client.ts`):** Client-only singleton using `createBrowserClient` with public anon key. Zero service-role credentials.
- **Server Client (`src/lib/supabase/server.ts`):** Request-scoped using `createServerClient` and Next.js `cookies()` with safe handling of read-only Server Component contexts.
- **Proxy Client (`src/lib/supabase/proxy.ts`):** Synchronizes cookies across `NextRequest` and `NextResponse` during optimistic redirects.
- **Privileged Admin Client (`src/lib/supabase/admin.ts`):** Server-only client using `SUPABASE_SERVICE_ROLE_KEY` for internal maintenance tasks and migration tests. Bypasses RLS; strictly isolated from client bundles.

### 2. Administrator Identity & Database Model

- Single administrator model for v1 with manual provisioning. No public registration or signup.
- `public.admin_profiles` table links directly to `auth.users(id)` (`ON DELETE CASCADE`) and carries `is_active boolean NOT NULL DEFAULT true`.
- PostgreSQL security definer function `public.is_admin()` checks existence and active status in `admin_profiles` for the executing `auth.uid()`.
- RLS enabled on `admin_profiles` with default deny. Policies allow active authenticated admins to read their own profile and authorize access to `enquiries`, `enquiry_items`, `enquiry_notes`, and `notification_outbox`.

### 3. Central Authorization Utility (`src/lib/auth/admin.ts`)

- `getAuthenticatedAdmin()`: Retrieves session user via `getUser()`, queries `admin_profiles` for active admin identity. Returns `AuthenticatedAdminContext` or `null`.
- `requireAdmin()`: Calls `getAuthenticatedAdmin()`, throwing `AppError.unauthorized()` or `AppError.forbidden()` if unauthenticated or inactive.
- `requireAdminSession()`: Used by Server Component layouts; redirects unauthenticated visitors to `/admin/login` and inactive/non-admin users to `/admin/login?error=unauthorized`.
- `withAdminAction()`: Higher-order wrapper for Server Actions, ensuring server-side verification before executing any administrative mutation.
- `sanitizeReturnUrl()`: Strict open-redirect defense, enforcing relative local paths starting with `/admin` and disallowing scheme-relative `//` URLs.

### 4. Layout Separation & Next.js 16 CacheComponents

- `src/app/admin/(auth)`: Houses `/admin/login` on a clean, centered white card without admin navigation or sidebar. Redirects authenticated active admins to `/admin/dashboard`.
- `src/app/admin/(console)`: Houses authenticated console routes (`/admin/dashboard`, `/admin/products`, `/admin/categories`, `/admin/enquiries`, `/admin/settings`). Enforces server-side authentication in layout before rendering sidebar or pages.
- Compatibility with `cacheComponents`: Avoids deprecated route segment configs (`export const dynamic = "force-dynamic"`) and calls `await connection()` from `next/server` at the top of request-time layouts and route handlers.

### 5. Multi-Tier Defense in Depth

1. **Edge/Proxy (`src/proxy.ts`):** Optimistic redirects for unauthenticated traffic and session cookie maintenance.
2. **Console Layout (`src/app/admin/(console)/layout.tsx`):** Server-side verification via `requireAdminSession()`.
3. **Server Actions (`src/features/auth/actions.ts` etc.):** Direct invocation protected by `withAdminAction()`.
4. **Route Handlers (`src/app/api/admin/session/route.ts`):** Direct HTTP requests protected by `requireAdmin()`.
5. **Database (Supabase RLS):** SQL policies restricting table access to `public.is_admin()`.

## Phase 8: Admin Dashboard & Catalogue Management Architecture

### 1. Admin Dashboard Loader (`src/features/admin/server/dashboard.ts`)

- Server-only request-time aggregation via `loadAdminDashboardData()`.
- Fetches full catalogue snapshot from Google Sheets (`loadAdminCatalogue()`) including active/inactive products, categories, brands, and sheet validation issues.
- Queries Supabase `enquiries` table for status counts (`NEW`, `PENDING` i.e. `CONTACTED`/`QUOTATION_SENT`, total) and the 10 most recent enquiries.
- Upstream failures degrade gracefully: errors are logged to `pino` and fallback empty structures are returned, keeping the console functional.

### 2. Admin Catalogue Mutations (`src/features/admin/actions.ts`)

- All mutations (`createProductAction`, `updateProductAction`, `toggleProductActiveAction`, `createCategoryAction`, `updateCategoryAction`, `toggleCategoryActiveAction`, `createBrandAction`, `updateBrandAction`, `toggleBrandActiveAction`, `updateBusinessSettingsAction`) are Server Actions guarded with `withAdminAction()`.
- Validations execute against strict Zod schemas (`productInputSchema`, `categoryInputSchema`, `brandInputSchema`, etc.).
- Optimistic concurrency control is enforced on updates via `expectedUpdatedAt` timestamps compared against Google Sheets row state.
- Post-mutation cache clearing uses `invalidateSheetsCache()` and `revalidatePath()`.

### 3. Category & Brand Dependency Guard

- Deactivating a category or brand is evaluated against active products in the catalogue.
- If any active products depend on the target category or brand, the action rejects with an explicit error message (`INACTIVE_CATEGORY` / `INACTIVE_BRAND`), preventing catalog corruption.

### 4. Public Navigation & Homepage Carousel

- Website navigation is reordered to a 4-item multi-page structure: `Home` (`/`), `Products` (`/products`), `Contact` (`/contact`), and `Bulk Enquiry` (`/bulk-enquiry`).
- Each route is an independent page with vertical scrolling; infinite single-page scrolling is avoided.
- `HomeCarousel` is an accessible, touch-responsive carousel component with 4 curated building materials slides. If images in `public/images/carousel/` are pending, it displays a zero-shift, high-contrast Deep Navy (`bg-primary`) SVG geometric grid card.

## Phase 9: Admin Enquiry Management & Live Integration Activation Architecture

### 1. Admin Enquiry Management (`src/features/admin/server/enquiries.ts` & `src/components/admin/`)

- **Listing View (`/admin/enquiries`):** Server-side data loading via `loadAdminEnquiries()` supporting search (`reference`, `customer_name`, `mobile`, `delivery_location`), status filtering (`NEW`, `CONTACTED`, `QUOTATION_SENT`, `CONFIRMED`, `COMPLETED`, `CANCELLED`), type filtering (`BULK`, `GENERAL`), and server-side pagination with item count aggregation per enquiry.
- **Detail View (`/admin/enquiries/[id]`):** Server-side loading via `loadAdminEnquiryDetail(id)` assembling the parent enquiry, requested items snapshot (`enquiry_items`), internal staff notes joined with administrator author profiles (`enquiry_notes` + `admin_profiles`), and notification outbox delivery status (`notification_outbox`).
- **Contact Deep Links:** One-click WhatsApp link formatted with standard country code (`https://wa.me/91...`) and telephone link (`tel:...`) for rapid customer outreach.

### 2. Enquiry Status Lifecycle & Concurrency

Enquiry status transitions are strictly enforced in `updateEnquiryStatusAction()`:

- `NEW` → `CONTACTED`, `CANCELLED`
- `CONTACTED` → `QUOTATION_SENT`, `CANCELLED`
- `QUOTATION_SENT` → `CONFIRMED`, `CANCELLED`
- `CONFIRMED` → `COMPLETED`, `CANCELLED`
- `COMPLETED` and `CANCELLED` are terminal states.
  Any invalid transition throws a `VALIDATION` error and is rejected.

### 3. Internal Staff Notes

- Stored in `enquiry_notes` with `enquiry_id`, `author_id` (admin user ID), `body` (1–2000 characters), and `created_at`.
- Rendered chronologically in the admin detail view with the author's full name and email.
- Created via `addEnquiryNoteAction()` guarded by `withAdminAction()`.

### 4. Notification Outbox Monitoring & Manual Retry

- The detail view displays real-time delivery status (`PENDING`, `PROCESSING`, `SENT`, `FAILED`), attempt count vs max attempts (8), last error summary, and timestamp.
- If delivery fails or is in progress, the administrator can manually trigger `retryNotificationAction(outboxId)`, which invokes the database function `retry_notification(p_outbox_id)` to reset the attempt timer and status for immediate processing.

### 5. Live Integration Verification Matrix

| Integration                    | Status                                                          | Verification Summary                                                                                                                                                                                                                                      |
| ------------------------------ | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Google Sheets API v4**       | `CONNECTED (Worksheets pending manual import)`                  | Service Account JWT signed and OAuth 2.0 token exchanged (HTTP 200). Spreadsheet metadata loaded, confirming existing initial tab `"Sheet1"`. Ready for demonstration CSV import.                                                                         |
| **Web3Forms API**              | `PASS (Server-side verified)`                                   | Validated `WEB3FORMS_ACCESS_KEY` format (36-char UUID). Unit and integration tests confirm payload construction, endpoint URL, input sanitization, timeout abort handling, and HTTP error classification. Real emails suppressed per safety instructions. |
| **Supabase PostgreSQL & Auth** | `BLOCKED (Migrations pending in Supabase Dashboard SQL Editor)` | Project URL and keys configured in `.env`. PostgREST server responds over HTTPS, but database returns schema-cache error (missing tables `public.enquiries` and function `public.is_admin`). Migrations must be run in Supabase SQL editor.               |

## Phase 10: Production Reliability, Live Integration Activation & Professional Header Redesign Architecture

### 1. Operational Health Check (`/api/health` & `src/features/health/server.ts`)

- **Dedicated Service Layer:** Health check logic is isolated in server-only module `src/features/health/server.ts` using `import "server-only";`.
- **Architectural Boundary Enforcement:** Respects catalogue domain rules by querying catalogue state via `@/features/catalogue/server` (`loadAdminCatalogue()`) rather than directly importing low-level `@/lib/google-sheets/*`.
- **Comprehensive Dependency Checks:**
  - `app`: Checks application uptime, Node version, memory usage, and build environment.
  - `googleSheets`: Invokes catalogue loader, assessing configuration, connectivity, and parsed sheet health.
  - `supabase`: Uses `@supabase/ssr` server client with anonymous key, evaluating configuration presence and database ping.
  - `notifications`: Inspects Web3Forms credentials and outbox configuration.
- **Fail-Safe Response Contract:**
  - Status `healthy` (HTTP 200) when all services respond normally.
  - Status `degraded` (HTTP 200) when auxiliary services are partially degraded or unconfigured during local development.
  - Status `unhealthy` (HTTP 503) when core dependencies suffer fatal failure.
  - Strictly prevents secret leakage in JSON output (reports boolean states and error categories only).
  - Explicit `"cache-control": "no-store"` header prevents stale cache hits on monitoring tools.

### 2. Automated Notification Retry Sweeper (`/api/notifications/process` & `vercel.json`)

- **Serverless Scheduled Execution:** `vercel.json` schedules execution of `GET /api/notifications/process` every 10 minutes (`*/10 * * * *`).
- **Authorization Guard:** Protected by `CRON_SECRET` bearer token matching standard Vercel Cron headers (`Authorization: Bearer <CRON_SECRET>`). Returns 401 Unauthorized for invalid/missing bearer tokens, and 503 Service Unavailable if `CRON_SECRET` is unset.
- **Deadline Guard Protection:** `src/features/enquiries/server/notifications.ts` includes an execution time guard (`maxDurationMs = 20000`). If notification processing approaches the serverless execution ceiling, the batch breaks early and records remaining items for the next scheduled tick, preventing invocation timeouts.
- **Durable State Machine:** Uses the PostgreSQL stored procedure `claim_due_notifications()` and `retry_notification()` with exponential backoff (attempt ceiling: 8 attempts).

### 3. Professional Building Materials Website Header (`src/components/website/site-header.tsx`)

- **Multi-Tier B2B/Retail Layout:** Replaces generic single-row navbar with a structured, high-trust dual-tier design inspired by established building material suppliers.
- **Top Utility Bar:**
  - Store physical location (`Nagpur, Maharashtra`).
  - Business operating hours (`Mon – Sat: 8:00 AM – 8:00 PM`).
  - Quick contact links for phone (`tel:`) and WhatsApp (`https://wa.me/`).
  - Subtle administrator access link (`Admin Portal`) linking to `/admin/login`.
- **Main Architectural Branding Bar:**
  - High-contrast Navy architectural badge container (`bg-primary`) with Secondary Amber `Building2` icon.
  - Prominent company name ("Sagar Traders") with uppercase tracking and authoritative typography.
  - Tagline subtitle ("Quality Building Materials & Hardware Supplies").
- **Action & Navigation Tier:**
  - Desktop navigation links with active indicators (`border-b-2 border-secondary`).
  - Direct quick-action buttons for Call and WhatsApp with contextual brand accents.
  - Dedicated "Enquiry List" button displaying dynamic badge count of added materials.
  - High-visibility "Quick Quote" primary call-to-action button directing to `/bulk-enquiry`.
- **Accessible Mobile Drawer:** Fully responsive slide-out navigation for mobile viewports, containing all navigation links, contact actions, enquiry counter, and direct phone/WhatsApp buttons with proper ARIA attributes.
- **Graceful Null Degradation:** When phone or WhatsApp numbers are omitted from business settings, corresponding buttons degrade cleanly without empty links or broken layouts.

## Phase 11: Catalogue Fallback, Reliable Enquiries, Security, SEO & Performance Architecture

### 1. Catalogue Resolution Architecture & Static Fallback Pipeline

The public customer-facing website never displays raw errors, blank states, or crashes due to Google Sheets outages, quota exhaustion, network timeouts, or unconfigured spreadsheets. Centralized resolution in `src/features/catalogue/server.ts` enforces a strict two-tier priority:

```
loadCatalogue() Request
        │
        ▼
[Priority 1: Live Google Sheets]
   ├── getSheetsSnapshot() with Next.js Cache Components
   ├── Parse & Validate (Products, Categories, Brands, BusinessSettings)
   └── Usable Products Count > 0 ?
          ├── YES ──► return { ok: true, source: "LIVE", catalogue, settings }
          └── NO  ──► Log Warning & Transition to Priority 2
                          │
                          ▼
        [Priority 2: Static Fallback Catalogue]
           ├── src/features/catalogue/data/static-catalogue.ts
           ├── 20 Realistic Construction Materials across 6 Categories & 6 Brands
           ├── Preserves Truthfulness: price: null ("Rate on request"), stock: "AVAILABLE_ON_ORDER"
           └── return { ok: true, source: "STATIC", catalogue, settings }
```

- **Non-blocking Informational Banner (`CatalogueFallbackNotice`):** Rendered on `/`, `/products`, `/products/[slug]`, and `/bulk-enquiry` only when `source === "STATIC"`. Assures visitors of catalogue accuracy and encourages them to contact Sagar Traders directly for current rates and stock.
- **Truthful Static Fallback Dataset:** 20 products across Cement, Steel & TMT, Bricks & Blocks, Sand & Aggregates, Hardware & Fasteners, and Plumbing & Sanitary. Zero fabricated prices (all `null`), zero fabricated SKUs (`null`), zero fabricated update timestamps (`null`), and stock status strictly set to `AVAILABLE_ON_ORDER`.

### 2. Dual-Source Enquiry Resolution & Server-Side Integrity

Enquiries submitted from both the live Google Sheets catalogue and the static fallback catalogue resolve seamlessly through `src/features/enquiries/server/snapshots.ts`:

- Server-side authoritative validation: browser input supplies only `productId` and `quantity`. Product name, unit, category, brand, listed price, and stock status are strictly looked up server-side from the active catalogue snapshot.
- For static fallback items: `listed_price` is persisted as `null` ("Rate on request", never coerced to 0), `stock_status` as `"AVAILABLE_ON_ORDER"`.
- If an item was queued during fallback and the catalogue transitioned, or vice versa, resolution checks the primary resolved catalogue first and falls back to static catalogue. Any unknown product ID is rejected with `INVALID_PRODUCTS`.

### 3. Degraded Email-Only Fallback with In-Memory Rate Limiting

To guarantee lead preservation even during catastrophic Supabase database outages:

- When `create_enquiry` fails or Supabase is unreachable: `submit.ts` activates `deliverEmailOnlyFallback()`.
- Formats an explicit degraded email notification and dispatches directly via `sendWeb3FormsEmail()`.
- Uses an in-memory sliding window rate limiter (max 5 submissions per IP per hour) when database rate-limiting tables are unreachable.
- Returns `{ ok: true, reference: "ENQ-YYYY-FAL-XXXXXX", mode: "EMAIL_FALLBACK", message: "Your enquiry has been sent successfully. Our team will contact you shortly." }`. Does not claim database persistence.
- If Web3Forms also fails: fails closed with `code: "UNAVAILABLE"` and preserves all entered form data for the user.

### 4. SEO & Structured Data Architecture

- **Dynamic XML Sitemap (`src/app/sitemap.ts`):** Serves `GET /sitemap.xml` with canonical URLs for `/`, `/products`, `/bulk-enquiry`, `/contact`, and dynamic detail routes `/products/[slug]` generated from the active catalogue.
- **Crawler Directives (`src/app/robots.ts`):** Enforces strict indexing rules, permitting public pages while blocking `/admin`, `/api`, and `/dev`.
- **OpenGraph & Twitter Cards (`src/app/layout.tsx`):** Complete site metadata with canonical base URL, OpenGraph title, description, and preview image fallbacks.
- **Schema.org JSON-LD:** Structured `Product` data on `/products/[slug]`. Omit `offers` when price is null, preventing search engine penalties for unverified pricing claims.

## Foundation already in repo

See `docs/FOUNDATION.md` and `docs/FOUNDATION_RECONCILIATION.md`. Token corrections were completed in Phase 1; remaining approved fixes are listed in `PROJECT_BLUEPRINT.md` §26.1 (not started).
