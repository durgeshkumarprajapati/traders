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

## Foundation already in repo

See `docs/FOUNDATION.md` and `docs/FOUNDATION_RECONCILIATION.md`. Token corrections were completed in Phase 1; remaining approved fixes are listed in `PROJECT_BLUEPRINT.md` §26.1 (not started).
