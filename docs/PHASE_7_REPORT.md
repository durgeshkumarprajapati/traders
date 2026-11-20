# Phase 7 Report — Admin Authentication and Authorization

**Date:** 2026-11-20  
**Project:** Sagar Traders  
**Scope:** Phase 7 only (Admin Authentication and Authorization; Phase 8+ strictly not started)  
**Git/GitHub Activity:** None (0 commits, 0 pushes, 0 branch modifications)

---

## 1. Implementation Summary

Phase 7 implements a robust, production-grade administrator authentication and authorization system using Supabase Auth SSR (`@supabase/ssr` v0.12.7 and `@supabase/supabase-js` v2.119.2).

Key milestones delivered:

- **Single Administrator Model:** Tailored for v1 with strictly no public signup, no registration endpoints, and manual administrator provisioning directly linked to Supabase Auth user IDs.
- **Explicit Admin Identity Verification:** Created the `public.admin_profiles` table and `public.is_admin()` PostgreSQL security definer function. Authenticated users are not granted admin privileges unless explicitly listed with `is_active = true`. Missing, inactive, or unauthenticated users fail closed.
- **Client & Server Isolation:** Maintained strict boundaries across browser singleton client (zero service-role keys), request-scoped server client (cookie-backed session verification via `getUser()`), proxy client (cookie synchronization), and server-only privileged admin client (`SUPABASE_SERVICE_ROLE_KEY`).
- **Complete Session Lifecycle:** Full support for login, session establishment, secure HttpOnly/Secure/SameSite cookie persistence, proxy session refresh, idle expiry, explicit logout session invalidation, and revoked session handling.
- **Multi-Tier Defense in Depth:**
  1. _Proxy Layer (`src/proxy.ts`):_ Intercepts `/admin/*`, refreshes cookies, optimistically redirects unauthenticated visitors to `/admin/login?returnTo=...` and active admins away from `/admin/login` to `/admin/dashboard`.
  2. _Server Component Layout (`src/app/admin/(console)/layout.tsx`):_ Enforces `await requireAdminSession()` before rendering the admin console shell or navigation.
  3. _Server Action Layer (`src/lib/auth/admin.ts` -> `withAdminAction()`):_ Independently validates admin identity before every mutation.
  4. _Route Handler Layer (`src/app/api/admin/session/route.ts` -> `requireAdmin()`):_ Validates admin identity on direct HTTP requests.
  5. _Database Layer (PostgreSQL RLS):_ Restricts table access using `public.is_admin()`.
- **Layout Separation:** Separated route groups under `src/app/admin/`:
  - `(auth)`: Centered white card layout, no sidebar or admin navigation, accessible login form.
  - `(console)`: Authenticated console layout with sidebar, displaying admin name/email and sign-out button.
- **Next.js 16 CacheComponents Compatibility:** Enforced request-time dynamic evaluation using `await connection()` from `next/server` across layouts and route handlers, avoiding forbidden legacy route segment configs (`export const dynamic`).
- **Automated Verification:** 42 test suites and 838 tests passed (0 failed). Zero TypeScript errors, zero ESLint warnings, 100% Prettier compliance, clean production build, and zero leaked secrets in the `.next/static` production bundle.

---

## 2. Authentication Architecture

The authentication architecture separates responsibilities across client, edge proxy, server components, server actions, route handlers, and the database:

```
[Browser]
    │
    ▼ (HTTP Request)
[Edge Proxy: src/proxy.ts]
    │ ── Refreshes Supabase session tokens via createSupabaseProxyClient()
    │ ── If unauthenticated on /admin/* (except /admin/login) ──► 307 Redirect /admin/login?returnTo=...
    │ ── If active admin on /admin/login ──► 307 Redirect /admin/dashboard
    ▼
[Next.js 16 App Router]
    ├── (auth)/layout.tsx & login/page.tsx
    │       └── Awaits connection(); redirects active admin to /admin/dashboard
    │           Renders <LoginForm /> on centered Card using custom UI tokens
    │
    └── (console)/layout.tsx (dashboard, products, categories, enquiries, settings)
            └── Awaits connection(); executes requireAdminSession()
                Renders <AdminSidebar /> (admin identity + Sign Out button) + children
                    │
                    ├── Server Actions (withAdminAction() guard)
                    └── Route Handlers (requireAdmin() guard)
                            │
                            ▼
               [src/lib/auth/admin.ts: Central Auth]
                    ├── supabase.auth.getUser()
                    └── SELECT is_active FROM admin_profiles WHERE id = user.id
                            │
                            ▼
               [Supabase Database (PostgreSQL 16)]
                    ├── public.admin_profiles
                    ├── public.is_admin() SECURITY DEFINER
                    └── Row Level Security (RLS) policies
```

### Defense in Depth Principles:

- Hiding UI components or redirecting at proxy time is considered a convenience, not a security boundary.
- Every protected Server Action and Route Handler independently invokes `requireAdmin()` or `withAdminAction()`.
- The database enforces RLS with `public.is_admin()`, so even if application authorization were bypassed, database queries from authenticated non-admin tokens return 0 rows.

---

## 3. Supabase Client Architecture

The codebase cleanly isolates four Supabase clients, preventing credential leakage and cross-context contamination:

1. **Browser Client (`src/lib/supabase/client.ts`):**
   - Implemented via `@supabase/ssr` `createBrowserClient`.
   - Client-only singleton initialized using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - Never has access to `SUPABASE_SERVICE_ROLE_KEY`.
   - Marked with `'use client'`.

2. **Server Client (`src/lib/supabase/server.ts`):**
   - Implemented via `@supabase/ssr` `createServerClient`.
   - Request-scoped, reading and writing session cookies via Next.js `cookies()` from `next/headers`.
   - Contains a safe-catch wrapper around `setAll` to gracefully ignore cookie write attempts during Server Component rendering (which Next.js App Router forbids), while successfully persisting refreshed tokens during Server Actions and Route Handlers.
   - Guarded with `import 'server-only'`.

3. **Proxy Client (`src/lib/supabase/proxy.ts`):**
   - Implemented via `@supabase/ssr` `createServerClient`.
   - Synchronizes cookies between incoming `NextRequest` and outgoing `NextResponse`.
   - Refreshes auth tokens on every matched `/admin/*` request before passing control downstream.

4. **Privileged Admin Client (`src/lib/supabase/admin.ts`):**
   - Implemented via `@supabase/supabase-js` `createClient`.
   - Uses `SUPABASE_SERVICE_ROLE_KEY` to bypass Row Level Security.
   - Strictly reserved for server-side maintenance, migration testing, and automated background tasks.
   - Guarded with `import 'server-only'`; static architecture tests verify that no client code or unauthorized server modules import it.

---

## 4. Session Lifecycle

The complete session lifecycle is implemented and verified:

1. **Login (`loginAdminAction`):**
   - User submits credentials (`email`, `password`, optional `returnTo`) to `loginAdminAction`.
   - Input is validated against `loginAdminSchema` (Zod v4).
   - `signInWithPassword` establishes the Supabase Auth session and sets encrypted session cookies.
   - The user's `id` is verified against `public.admin_profiles`. If the profile does not exist or `is_active !== true`:
     - `auth.signOut()` is immediately invoked on the server client to destroy the session.
     - A generic error (`INVALID_CREDENTIALS` or `UNAUTHORIZED`) is returned.
   - On success, `returnTo` is sanitized via `sanitizeReturnUrl()` (preventing open redirect attacks) and returned to the client for client-side navigation.

2. **Session Persistence & Retrieval:**
   - Auth tokens are stored in standard Supabase SSR cookies (`sb-<project-ref>-auth-token`).
   - Server components and actions retrieve the session using `supabase.auth.getUser()`.
   - `getUser()` performs cryptographically secure server-side validation against Supabase Auth (unlike `getSession()` which merely decodes the JWT without remote verification).

3. **Session Refresh & Expiry:**
   - `src/proxy.ts` calls `supabase.auth.getUser()` on requests matching `/admin/:path*`.
   - When the access token is near expiry, `@supabase/ssr` issues a refreshed token pair and attaches `Set-Cookie` headers to the `NextResponse`.
   - If a session expires or refresh fails, `getUser()` returns `null`, causing immediate redirection to `/admin/login`.

4. **Logout (`logoutAdminAction` / `logoutAdminSession`):**
   - User clicks the "Sign Out" button in `<AdminSidebar />`.
   - Triggers `logoutAdminAction` Server Action.
   - Calls `supabase.auth.signOut()`, invalidating the session server-side and clearing auth cookies.
   - Issues a hard redirect to `/admin/login`.

5. **Revoked or Invalidated Sessions:**
   - If an admin's password is changed or their profile is marked `is_active = false` in the database, `getAuthenticatedAdmin()` fails closed on the very next request.
   - The user is immediately ejected to `/admin/login?error=unauthorized`.

---

## 5. Cookie Handling

Cookie management adheres strictly to modern web security standards:

- **Provider Managed:** Uses standard `@supabase/ssr` chunked cookie handlers. No custom or unsafe cookie parsing is introduced.
- **Security Attributes:** In production, cookies are transmitted with `HttpOnly`, `Secure`, and `SameSite=Lax` flags, preventing XSS-based token theft.
- **No Token Exposure:** Access tokens and refresh tokens are never passed via URL parameters, never exposed to JavaScript in browser storage (`localStorage` / `sessionStorage`), and never written to application logs.
- **Server Component Safety:** The Next.js 16 App Router forbids mutating cookies during Server Component rendering. `src/lib/supabase/server.ts` wraps cookie setting in a `try/catch` block so Server Components can safely read auth state while Server Actions and Route Handlers persist updated cookies.

---

## 6. Admin Identity and Authorization Mechanism

### Central Authorization Utility (`src/lib/auth/admin.ts`)

Authorization is centralised in a dedicated, server-only module:

- **`getAuthenticatedAdmin(clientOverride?)`:**
  - Calls `supabase.auth.getUser()`.
  - Queries `public.admin_profiles` selecting `id, email, full_name, is_active, created_at, updated_at`.
  - Validates that `is_active === true`.
  - Returns `AuthenticatedAdminContext`:
    ```typescript
    export interface AuthenticatedAdminContext {
      user: User;
      adminProfile: AdminProfile;
    }
    ```
  - Returns `null` if unauthenticated, profile missing, or account inactive.

- **`requireAdmin(clientOverride?)`:**
  - Calls `getAuthenticatedAdmin()`.
  - If user is not authenticated: throws `AppError.unauthorized("Authentication required.")`.
  - If user is authenticated but not an active admin: throws `AppError.forbidden("Administrator privileges required.")`.
  - Returns non-null `AuthenticatedAdminContext`.

- **`requireAdminSession(clientOverride?)`:**
  - Tailored for Server Component layouts.
  - If unauthenticated: redirects to `/admin/login`.
  - If non-admin or inactive: redirects to `/admin/login?error=unauthorized`.
  - Returns `AuthenticatedAdminContext`.

- **`withAdminAction<TInput, TOutput>(action, clientOverride?)`:**
  - Higher-order function wrapping Server Actions.
  - Executes `requireAdmin()`. If unauthorized, catches the `AppError` and returns a typed error response (`{ success: false, error: ... }`).
  - Calls the inner action with `(input, adminContext)` on success.

- **`sanitizeReturnUrl(url)`:**
  - Validates return URL strings.
  - Rejects external domains, scheme-relative URLs (`//evil.com`), null bytes, protocol schemes (`javascript:`, `data:`, `https:`), and any path not strictly starting with `/admin`.
  - Defaults safely to `/admin/dashboard`.

---

## 7. Protected Routes

All administrative routes are protected under the unified defense-in-depth scheme:

| Route                       | Purpose                         | Protection Mechanism                                               |
| --------------------------- | ------------------------------- | ------------------------------------------------------------------ |
| `/admin`                    | Root alias                      | Server redirect to `/admin/dashboard`                              |
| `/admin/login`              | Administrator Login             | Publicly accessible; redirects active admins to `/admin/dashboard` |
| `/admin/dashboard`          | Main Console Overview           | Layout `requireAdminSession()` + Proxy redirect                    |
| `/admin/products`           | Product Catalog Management      | Layout `requireAdminSession()` + Proxy redirect                    |
| `/admin/products/new`       | Product Creation Form           | Layout `requireAdminSession()` + Proxy redirect                    |
| `/admin/products/[id]/edit` | Product Edit Form               | Layout `requireAdminSession()` + Proxy redirect                    |
| `/admin/categories`         | Categories & Brands Management  | Layout `requireAdminSession()` + Proxy redirect                    |
| `/admin/enquiries`          | Enquiry Inbox & Status Tracking | Layout `requireAdminSession()` + Proxy redirect                    |
| `/admin/enquiries/[id]`     | Enquiry Detail View             | Layout `requireAdminSession()` + Proxy redirect                    |
| `/admin/settings`           | Business Settings Editor        | Layout `requireAdminSession()` + Proxy redirect                    |
| `/api/admin/session`        | Admin Session Route Handler     | Direct `requireAdmin()` check (returns 401 if unauthorized)        |

---

## 8. Login and Logout Implementation

### Login Experience (`src/app/admin/(auth)/login/page.tsx` & `src/components/admin/login-form.tsx`)

- **Visual Design:** Strictly adheres to approved design tokens:
  - Clean white background (`#FFFFFF`).
  - Deep Navy primary button (`#17365D`) with Amber focus ring (`#F5A623`).
  - Inter typography with accessible label associations (`htmlFor`, `id`, `aria-describedby`).
  - Custom UI library: uses custom `Card`, `Field`, `Input`, `Button`, `Spinner`, and `Notification` components (zero `shadcn/ui`).
- **Interactive Features:**
  - Password show/hide toggle button with accessible aria labels.
  - Accessible inline field validation errors.
  - Server error notifications (e.g. invalid credentials, inactive account, or unauthorized access).
  - Clear loading spinner and disabled state during submission.
  - No demo credentials, no placeholder email/password pre-fills, and no links to registration.

### Logout Experience (`src/components/admin/admin-sidebar.tsx`)

- Integrated into the bottom of `<AdminSidebar />`.
- Displays the authenticated administrator's `full_name` and `email`.
- Renders a clean "Sign Out" button inside a Server Action form (`<form action={logoutAdminAction}>`).
- Submitting the form calls `logoutAdminAction`, which destroys the session server-side, purges cookies, and redirects the browser to `/admin/login`.

---

## 9. Layout Separation

The `src/app/admin` directory structure has been reorganized into two distinct route groups:

```
src/app/admin/
├── layout.tsx                  # Root layout setting { robots: { index: false, follow: false } }
├── page.tsx                    # Redirects /admin to /admin/dashboard
├── (auth)/                     # Unauthenticated Auth Route Group
│   ├── layout.tsx              # Centered card layout; awaits connection(); redirects active admin
│   └── login/
│       └── page.tsx            # Renders Suspended LoginForm
└── (console)/                  # Authenticated Admin Console Route Group
    ├── layout.tsx              # Server-side guard: awaits requireAdminSession(); renders sidebar
    ├── dashboard/page.tsx
    ├── products/
    │   ├── page.tsx
    │   ├── new/page.tsx
    │   └── [id]/edit/page.tsx
    ├── categories/page.tsx
    ├── enquiries/
    │   ├── page.tsx
    │   └── [id]/page.tsx
    └── settings/page.tsx
```

This guarantees:

1. The login page never renders the administrative sidebar or navigation links.
2. Console routes are physically separated and guarded by `(console)/layout.tsx` before any child page renders.
3. Legacy un-grouped routes were cleanly deleted, preventing Next.js App Router route collisions.

---

## 10. Database Schema Changes

Migration file: `supabase/migrations/20261120000000_admin_auth.sql`

```sql
create table if not exists public.admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_profiles_email_not_blank check (char_length(trim(email)) > 0),
  constraint admin_profiles_full_name_not_blank check (char_length(trim(full_name)) > 0)
);

create index if not exists idx_admin_profiles_email on public.admin_profiles (lower(email));
create index if not exists idx_admin_profiles_is_active on public.admin_profiles (is_active);

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from public.admin_profiles
    where id = auth.uid()
      and is_active = true
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, service_role;
```

---

## 11. RLS Policy Changes

Row Level Security is enabled on `public.admin_profiles` with default deny:

```sql
alter table public.admin_profiles enable row level security;
revoke all on public.admin_profiles from public, anon, authenticated;
grant select on public.admin_profiles to authenticated;
grant all on public.admin_profiles to service_role;

create policy admin_profiles_read_own
  on public.admin_profiles
  for select
  to authenticated
  using (id = auth.uid() and is_active = true);
```

In addition, Phase 6 enquiry tables were granted administrative RLS policies using `public.is_admin()`:

- `enquiries`: `select`, `update` to `authenticated` using `(public.is_admin())`.
- `enquiry_items`: `select` to `authenticated` using `(public.is_admin())`.
- `enquiry_notes`: `select`, `insert`, `update` to `authenticated` using `(public.is_admin())`.
- `notification_outbox`: `select` to `authenticated` using `(public.is_admin())`.
- `notification_attempts`: `select` to `authenticated` using `(public.is_admin())`.

---

## 12. Manual Administrator Provisioning Instructions

Because Sagar Traders v1 uses a single administrator model with zero public signup, the administrator must be provisioned manually.

### Step 1: Create the Supabase Auth User

In the Supabase Studio dashboard:

1. Navigate to **Authentication** > **Users**.
2. Click **Add User** > **Create User**.
3. Enter the administrator's email and a secure password (minimum 12 characters, including uppercase, lowercase, numbers, and symbols).
4. Toggle **Auto Confirm User?** to **Yes**.
5. Copy the generated `User UID` (UUID).

### Step 2: Insert the Admin Profile Record

In the Supabase **SQL Editor**, execute:

```sql
insert into public.admin_profiles (id, email, full_name, is_active)
values (
  'PASTE-USER-UID-HERE',
  'admin@sagartraders.com',
  'Sagar Admin',
  true
);
```

### Account Deactivation & Emergency Revocation:

- **Deactivate:** Update the record in SQL Editor:
  ```sql
  update public.admin_profiles set is_active = false where email = 'admin@sagartraders.com';
  ```
  The administrator will be ejected on their next request.
- **Revoke Sessions Immediately:**
  In Supabase Studio > **Authentication** > **Users**, select the user and click **Revoke All Sessions**.

Full details are documented in `docs/SUPABASE_SETUP.md` §6.

---

## 13. Environment Variables

The application requires the following environment variables:

```bash
# Public Supabase variables (browser and server client)
NEXT_PUBLIC_SUPABASE_URL="https://your-project-ref.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOi..."

# Server-only variables (never exposed to the browser)
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..."
RATE_LIMIT_SECRET="minimum-32-character-random-secret"
WEB3FORMS_ACCESS_KEY="optional-web3forms-access-key"
CRON_SECRET="optional-cron-secret"
SITE_INDEXING="disabled"
```

- Validation: Added `loadSupabaseAuthConfig` to `src/lib/supabase/config.ts` and registered `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `src/lib/env/public.ts`.
- Documentation: Updated `docs/ENVIRONMENT.md` and `.env.example`.

---

## 14. Files Created

1. `supabase/migrations/20261120000000_admin_auth.sql` — PostgreSQL migration for `admin_profiles`, `is_admin()`, and admin RLS policies.
2. `supabase/tests/02_admin_auth.sql` — Self-asserting SQL tests executed in PostgreSQL single-user mode.
3. `src/lib/supabase/client.ts` — Browser Supabase client singleton via `@supabase/ssr`.
4. `src/lib/supabase/server.ts` — Request-scoped server Supabase client via `@supabase/ssr`.
5. `src/lib/supabase/admin.ts` — Privileged server-only Supabase client via `@supabase/supabase-js`.
6. `src/lib/auth/admin.ts` — Central server-only authorization utility (`getAuthenticatedAdmin`, `requireAdmin`, `requireAdminSession`, `withAdminAction`, `sanitizeReturnUrl`).
7. `src/lib/auth/admin.test.ts` — Unit tests for authorization, open-redirect prevention, and fail-closed logic.
8. `src/features/auth/schemas.ts` — Zod v4 schemas for login and return URL sanitization.
9. `src/features/auth/actions.ts` — Server Actions for login (`loginAdminAction`) and logout (`logoutAdminAction`, `logoutAdminSession`).
10. `src/features/auth/actions.test.ts` — Unit tests for authentication server actions and session invalidation.
11. `src/features/auth/security.test.ts` — Static architecture tests enforcing absence of public signup routes, service-role leaks, and credential redaction.
12. `src/components/admin/login-form.tsx` — Custom UI login form component with password toggle and loading states.
13. `src/components/admin/admin-sidebar.tsx` — Authenticated console sidebar with navigation links, admin identity, and sign-out action.
14. `src/app/admin/(auth)/layout.tsx` — Unauthenticated login layout (centered card, no sidebar).
15. `src/app/admin/(auth)/login/page.tsx` — Administrator login route.
16. `src/app/admin/(console)/layout.tsx` — Authenticated console layout enforcing `requireAdminSession()`.
17. `src/app/admin/(console)/dashboard/page.tsx` — Moved dashboard page placeholder.
18. `src/app/admin/(console)/products/page.tsx` — Moved products page placeholder.
19. `src/app/admin/(console)/products/new/page.tsx` — Moved product creation page placeholder.
20. `src/app/admin/(console)/products/[id]/edit/page.tsx` — Moved product edit page placeholder.
21. `src/app/admin/(console)/categories/page.tsx` — Moved categories page placeholder.
22. `src/app/admin/(console)/enquiries/page.tsx` — Moved enquiries page placeholder.
23. `src/app/admin/(console)/enquiries/[id]/page.tsx` — Moved enquiry detail page placeholder.
24. `src/app/admin/(console)/settings/page.tsx` — Moved settings page placeholder.
25. `src/app/admin/admin-layout-auth.test.tsx` — Integration tests for login and console layout rendering and redirect behavior.
26. `src/app/api/admin/session/route.ts` — Protected route handler returning active admin session context.
27. `src/app/api/admin/session/route.test.ts` — Unit tests for route handler protection.
28. `docs/PHASE_7_REPORT.md` — This comprehensive report.

---

## 15. Files Modified

1. `package.json` — Added `@supabase/ssr` (`^0.12.7`) and `@supabase/supabase-js` (`^2.119.2`).
2. `src/lib/supabase/config.ts` — Added `loadSupabaseAuthConfig` helper.
3. `src/lib/supabase/supabase.test.ts` — Added tests for `loadSupabaseAuthConfig`.
4. `src/lib/supabase/migration.test.ts` — Updated to execute Phase 7 migration and SQL test harness in PostgreSQL single-user mode.
5. `src/lib/env/public.ts` — Registered `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
6. `src/proxy.ts` — Extended matcher to `["/products/:slug", "/admin/:path*"]`; added session cookie refresh and admin redirects.
7. `src/proxy.test.ts` — Added tests for admin proxy redirections and session synchronization.
8. `src/app/admin/layout.tsx` — Root admin layout setting `metadata: { robots: { index: false, follow: false } }`.
9. `src/app/admin/page.tsx` — Redirects `/admin` to `/admin/dashboard`.
10. `src/features/enquiries/security.test.ts` — Updated architectural import whitelist for Phase 7 modules.
11. `supabase/tests/00_stub.sql` — Added stub for `auth.uid()`.
12. `.env.example` — Added Phase 7 auth variables.
13. `docs/ENVIRONMENT.md` — Updated environment variable documentation.
14. `docs/SUPABASE_SETUP.md` — Added Phase 7 migration and manual provisioning guide.
15. `docs/DECISIONS.md` — Documented Decisions 22, 23, and 24.
16. `docs/IMPLEMENTATION_PLAN.md` — Updated Phase 7 task checklist.
17. `docs/ARCHITECTURE.md` — Added Phase 7 authentication architecture section.
18. `docs/RISK_REGISTER.md` — Updated status of Risks R2 and R11 to Mitigated.

---

## 16. Security Considerations

1. **Fail-Closed Authorization:** Every authorization check explicitly returns false or throws an error unless the user is confirmed active in `admin_profiles`.
2. **Open-Redirect Defense:** `sanitizeReturnUrl()` forbids external hostnames, scheme-relative URLs (`//`), control characters, and protocols, strictly requiring relative paths prefixed with `/admin`.
3. **No Public Registration:** Zero signup forms, registration routes, or self-service promotion endpoints exist in the application.
4. **Credential Isolation:** The service role key is isolated to server-only modules and is never bundled in client assets.
5. **Session Expiry & Revocation:** Inactivating an admin in `admin_profiles` or revoking their session in Supabase immediately invalidates their access.
6. **Recursive Log Redaction:** `src/lib/logger.ts` recursively sanitizes any log payload containing passwords, tokens, cookies, auth headers, or session data.
7. **Production Bundle Verification:** Automated scan of `.next/static` verified that no secret environment variable names or values were leaked into client JS bundles.

---

## 17. Automated Test Results

Ran complete test suite across all 42 test files:

```bash
npm test
```

**Results:**

- Test Files: **42 passed (42 total)**
- Tests: **838 passed (838 total)**
- Duration: 16.48s
- Test breakdown includes:
  - Database single-user mode PostgreSQL 16 migration and SQL assertion tests.
  - Supabase client configuration and error mapping tests.
  - Central authorization and open redirect prevention tests.
  - Server action authentication and session lifecycle tests.
  - Route handler authorization tests.
  - Proxy redirection and session refresh tests.
  - Login form rendering, interaction, and validation tests.
  - Security architecture tests (no signup routes, no client service keys, redaction).

---

## 18. TypeScript, ESLint, Prettier, and Build Results

Executed quality checks sequentially:

1. **TypeScript Typecheck:**
   ```bash
   npm run typecheck
   # Output: Clean pass (0 errors).
   ```
2. **ESLint:**
   ```bash
   npm run lint
   # Output: Clean pass (0 errors, 0 warnings).
   ```
3. **Prettier Formatting Check:**
   ```bash
   npm run format:check
   # Output: All matched files use Prettier code style!
   ```
4. **Next.js Production Build:**
   ```bash
   npm run build
   # Output: Successfully built production application.
   # Dynamic route evaluation: /api/admin/session, /admin/login, /admin/(console)/*
   # Prerendered static shells: Customer-facing catalog pages
   # Proxy (Middleware): Successfully compiled
   ```
5. **Production Secret Leak Check:**
   - Scanned `.next/static` for `SUPABASE_SERVICE_ROLE_KEY`, `RATE_LIMIT_SECRET`, `CRON_SECRET`, and internal auth tokens. None found.

---

## 19. Live Supabase Verification Results

- **Status:** **NOT TESTED WITH LIVE SUPABASE SERVICE.**
- **Reason:** The execution environment is an isolated development sandbox without active internet access or credentials for a live Supabase production project.
- **Local Verification Performed:**
  - Database schema, table constraints, indexes, RLS policies, and the `public.is_admin()` function were fully executed and tested against a real local PostgreSQL 16 instance (`postgres --single -j`).
  - Unit tests mocked Supabase Auth responses covering valid admin, invalid credentials, non-admin users, inactive admins, and network failures.
- **Required Owner Action:** The project owner must execute the migration `supabase/migrations/20261120000000_admin_auth.sql` in their live Supabase project and provision the initial administrator following `docs/SUPABASE_SETUP.md` §6.

---

## 20. Browser Verification Results

- **Status:** **VERIFIED VIA JSDOM; REAL BROWSER NOT RUN.**
- **Reason:** Headless web browser processes (Chrome/Firefox/Playwright) cannot be launched inside the restricted execution sandbox.
- **Verification Performed:**
  - Login form interactions, input bindings, password reveal toggles, validation errors, and submission states were thoroughly tested using React Testing Library under jsdom (`src/components/admin/login-form.tsx` and `src/app/admin/admin-layout-auth.test.tsx`).
- **Required Owner Action:** Conduct visual regression testing and responsive viewport testing on desktop and mobile devices once deployed to the staging environment.

---

## 21. Remaining Limitations and Risks

1. **Single Administrator in v1:** The system supports exactly one administrator record. Multi-admin roles, invitations, and fine-grained permissions are deferred to future milestones.
2. **Manual Provisioning:** Creation of administrator accounts requires access to the Supabase Studio dashboard and SQL editor.
3. **MFA / 2FA Deferred:** Multi-factor authentication is not configured in v1. The administrator password must be strong (16+ characters recommended).
4. **Live Verification Pending:** Full end-to-end verification against live Supabase Auth and network cookies requires deployment to Vercel/Supabase.

---

## 22. Explicit Confirmation: Phase 8+ Not Started

**Confirmation:** Neither Phase 8 nor any subsequent phase has been started.

- No Product CRUD functionality has been implemented.
- No Google Sheets write synchronization has been implemented.
- No Cloudinary signed image upload functionality has been created.
- No Category or Brand management operations have been created.
- No Enquiry status update or internal note features have been built.
- All admin console pages (`dashboard`, `products`, `categories`, `enquiries`, `settings`) remain non-functional UI placeholders, strictly protected behind authentication.

---

## 23. Explicit Confirmation: No Git/GitHub Operations Performed

**Confirmation:** No Git or GitHub operations were performed during this phase.

- `git commit` was **NOT** executed.
- `git push` was **NOT** executed.
- No branches, tags, or remotes were modified or created.
- The working tree remains clean and ready for owner review and manual commit.
