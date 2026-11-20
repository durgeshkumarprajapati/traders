# Phase 8 Report — Admin Dashboard, Catalogue Management & Website Experience Enhancement

**Date:** 2026-11-20  
**Project:** Sagar Traders  
**Scope:** Phase 8 only (Admin Dashboard, Catalogue Management & Website Experience Enhancement; Phase 9+ strictly not started)  
**Git/GitHub Activity:** None (0 commits, 0 pushes, 0 branch modifications)

---

## 1. Phase 8 Implementation Summary

Phase 8 expands Sagar Traders from an authenticated shell into an active administrative workspace and an enhanced multi-page customer experience:

- **Admin Dashboard (`/admin/dashboard`):** Real-time business overview powered by `loadAdminDashboardData()`. Displays real metrics (total active products, total categories, total brands, new enquiries, pending enquiries, product availability breakdown by 4 stock statuses, and Google Sheets validation issues). No statistics are fabricated; empty states are displayed honestly when data is absent.
- **Product Management (`/admin/products`, `/admin/products/new`, `/admin/products/[id]/edit`):** Complete catalogue lifecycle. Client-side live search, multi-factor filtering (category, brand, stock status, active/inactive), sorting, pagination, optimistic toggle active/inactive action, full creation and edit forms with auto slug derivation, SKU validation, price validation, canonical units with custom label requirement, and optimistic concurrency locking (`expectedUpdatedAt`).
- **Category & Brand Management (`/admin/categories`):** Single unified screen with tabbed navigation (`Categories` and `Brands`), search, creation and editing modals, and active product dependency protection: deactivating a category or brand is strictly prevented if active products currently reference it (`INACTIVE_CATEGORY` or `INACTIVE_BRAND`).
- **Business Settings Management (`/admin/settings`):** Comprehensive editor covering 6 business sections: Company Profile, Contact Channels, Operations & Timings, Announcement Banner, Social Links, and 6 configurable Why Choose Us pairs (with strict title + description pair validation). Persists directly to the `BusinessSettings` Google Sheet.
- **Multi-Page Website Navigation:** Clear separation of customer routes: Home (`/`), Products (`/products`), Contact (`/contact`), Bulk Enquiry (`/bulk-enquiry`), and Product Details (`/products/[slug]`). Reordered navigation to: `Home`, `Products`, `Contact`, `Bulk Enquiry`. Normal vertical scrolling per page without infinite single-page stacking or horizontal overflow.
- **Production-Grade Homepage Carousel:** Four factual building materials slides (Cement, Steel/TMT, Bricks & Masonry, Plumbing & Hardware). Features automatic slide progression (6s interval), pause on hover and keyboard focus, `prefers-reduced-motion` detection, full keyboard navigation (Left/Right/Home/End), touch swipe gestures (≥40px threshold), and an architectural Deep Navy (`bg-primary`) SVG geometric grid fallback that eliminates layout shifts and broken image placeholders when local images are pending.
- **Strict Architectural Security:** All administrative mutations execute via Server Actions guarded by `withAdminAction()`, verifying the caller's active admin profile before invoking the Google Sheets write layer. Request-time pages invoke `await connection()`. Client components import types exclusively from `@/features/admin/types`, preventing client bundle pollution.
- **Automated Verification:** 46 test suites and 887 tests passed (0 failed). Zero TypeScript errors, zero ESLint warnings, 100% Prettier compliance, successful production build, and zero leaked secrets in client bundles.

---

## 2. Dashboard Implementation

The real admin dashboard is implemented at `src/app/admin/(console)/dashboard/page.tsx` and rendered by `src/components/admin/dashboard-view.tsx`.

### Architecture & Data Loading

- Loaded via `loadAdminDashboardData()` (`src/features/admin/server/dashboard.ts`), marked `server-only`.
- Awaits `connection()` from `next/server` to guarantee dynamic request-time rendering under Next.js 16 Partial Prerendering.
- Concurrently queries Google Sheets snapshot via `loadAdminCatalogue()` and Supabase PostgreSQL `enquiries` table using `createSupabaseServerClient()`.
- Resilient error handling: if Supabase fails or Google Sheets encounters an API outage, errors are logged via `pino` logger and fallback empty structures are returned, keeping the console accessible.

### Dashboard Sections

1. **Metric Overview Cards:**
   - Active Materials: Total count of active products.
   - Categories: Total active categories.
   - Verified Brands: Total active brands.
   - New Enquiries: Enquiries with status `NEW` requiring staff attention.
   - Pending Follow-ups: Enquiries in progress (`CONTACTED` or `QUOTATION_SENT`).
   - Total Historical Leads: Total enquiries recorded in Supabase.
2. **Product Stock Status Breakdown:**
   - Visual breakdown grid showing counts for `IN_STOCK`, `LOW_STOCK`, `AVAILABLE_ON_ORDER`, and `OUT_OF_STOCK` using design-token badges.
3. **Recent Enquiries Activity Table:**
   - Displays the 10 most recent customer enquiries: reference ID, enquiry type (`BULK` or `GENERAL`), customer name, contact details (phone and email), status badge (`EnquiryStatusBadge`), and relative submission timestamp.
   - If no enquiries exist, renders a clean, accessible empty state card.
4. **Google Sheets Data Issues Alert:**
   - Summarizes catalogue validation issues detected by `loadAdminCatalogue()`, grouping errors and warnings with cell coordinates (`worksheet`, `row`, `column`) and direct guidance for the administrator.
5. **Quick Action Shortcuts:**
   - Quick navigation buttons to Add New Material (`/admin/products/new`), Manage Categories & Brands (`/admin/categories`), and Update Business Settings (`/admin/settings`).

---

## 3. Product Management Implementation

Product management is implemented across three routes:

- `/admin/products`: Product listing, search, filtering, and pagination.
- `/admin/products/new`: Add new building material.
- `/admin/products/[id]/edit`: Edit existing building material with concurrency locking.

### 3.1 Product Listing (`src/components/admin/product-list-view.tsx`)

- **Interactive Search:** Real-time filtering across product name, SKU, and description.
- **Multi-Factor Filters:** Category filter, brand filter, stock status filter (`ALL`, `IN_STOCK`, `LOW_STOCK`, `AVAILABLE_ON_ORDER`, `OUT_OF_STOCK`), and active status filter (`ALL`, `ACTIVE`, `INACTIVE`).
- **Sorting Options:** Sort by Name (A–Z), Name (Z–A), Price (Low to High), Price (High to Low), or Last Updated.
- **Pagination:** 15 items per page with clear page indicators and previous/next controls.
- **Active / Inactive Toggle:** Instant non-destructive archiving. Clicking the toggle triggers `toggleProductActiveAction`, updating the row in Google Sheets and revalidating public and admin catalogue paths.
- **Direct Navigation:** Edit button linking to `/admin/products/[id]/edit` and quick view links to the public product page (`/products/[slug]`).

### 3.2 Product Creation & Editing (`src/components/admin/product-form.tsx`)

- **Auto Slug Derivation:** Typing a product name automatically populates the URL slug (lowercased, spaces replaced with hyphens, non-alphanumeric characters stripped) unless manually edited.
- **SKU Support:** Optional stock-keeping unit. Unique when supplied; validated on submit.
- **Canonical Units:** Full support for `BAG`, `TON`, `PIECE`, `PACKET`, `BUNDLE`, `KG`, `METER`, `SQUARE_FEET`, `CUBIC_FEET`, `TRUCK_LOAD`, `METRIC_TON`, and `CUSTOM`.
  - Distinguishes `TON` (2,000 lbs) and `METRIC_TON` (1,000 kg).
  - When `CUSTOM` is selected, an additional "Custom Unit Label" field is rendered and required (e.g. "Barrel" or "Box").
- **Price Handling:** Validates non-negative plain numbers. Missing or empty prices remain absent (`null`), displaying as "Rate on request" rather than 0.
- **Optimistic Concurrency Locking:** On edit, passes `expectedUpdatedAt` timestamp to `updateProductAction`. If another administrator modified the spreadsheet concurrently, the write is aborted with a `SheetsConflictError` and a clear notification is displayed to reload the data.

---

## 4. Category Management Implementation

Category management is integrated within `/admin/categories` via `src/components/admin/categories-brands-view.tsx` on the "Categories" tab.

### Features

- **Listing & Search:** Real-time search by category name and slug. Shows display order, icon key, status badge, active products count, and edit action.
- **Creation Modal:** Add category modal requiring Name, Slug, Description (optional), Icon selector (`cement`, `steel`, `bricks`, `sand`, `hardware`, `other`), Display Order, and Image URL (optional).
- **Edit Modal:** Update category attributes with pre-populated values.
- **Active Toggle & Dependency Protection:**
  - When an administrator attempts to deactivate a category, `toggleCategoryActiveAction` checks whether active products currently reference that category.
  - If dependent active products exist, the action is rejected and a notification appears: _"Cannot deactivate category: 4 active products depend on it. Reassign or deactivate those products first."_
  - This guarantees the public catalogue never encounters `INACTIVE_CATEGORY` validation errors.

---

## 5. Brand Management Implementation

Brand management is integrated within `/admin/categories` via `src/components/admin/categories-brands-view.tsx` on the "Brands" tab.

### Features

- **Listing & Search:** Real-time search by brand name and slug. Displays logo preview/fallback, status badge, active products count, and edit action.
- **Creation Modal:** Add brand modal requiring Name, Slug, Description (optional), and Logo URL (optional).
- **Edit Modal:** Update brand attributes with pre-populated values.
- **Active Toggle & Dependency Protection:**
  - When an administrator attempts to deactivate a brand, `toggleBrandActiveAction` verifies that no active products reference that brand.
  - If dependent active products exist, deactivation is blocked with a clear user notification: _"Cannot deactivate brand: 2 active products depend on it. Reassign or deactivate those products first."_
  - This prevents `INACTIVE_BRAND` validation issues in the catalogue.

---

## 6. Business Settings Management

Business settings are edited at `/admin/settings` via `src/components/admin/settings-form.tsx` and persisted to the `BusinessSettings` Google Sheet via `updateBusinessSettingsAction`.

### Form Sections

1. **Company Profile:** Business Name, Business Tagline (used on homepage carousel), and Logo URL.
2. **Contact Channels:** Official Calling Phone, WhatsApp Enquiry Number (with country code validation), and Official Contact Email.
3. **Operations & Coverage:** Physical Depot Address, Operating Business Hours, GST Identification Number (GSTIN, validated for 15-character uppercase alphanumeric format), Delivery Coverage Area, and Google Maps URL.
4. **Announcement Banner:** Enable/disable toggle and announcement message text.
5. **Social Media Profiles:** Profile URLs for Facebook, Instagram, LinkedIn, and YouTube.
6. **Why Choose Us Statements:**
   - 6 configurable card pairs (Title + Description).
   - Strict validation: both title and description must be filled for a card to be saved. If an administrator enters a title without a description (or vice versa), validation highlights the incomplete pair.
   - Only complete pairs are persisted, ensuring the customer homepage never renders broken or half-empty benefit cards.

---

## 7. Website Navigation Changes

The customer website navigation was refined into a multi-page architecture:

### 7.1 Navigation Structure (`src/config/navigation.ts`)

The public navigation links were reordered to:

1. **Home (`/`):** Hero carousel, core categories, featured materials, value propositions, and direct quotation CTA.
2. **Products (`/products`):** Full building materials catalogue with category/brand filtering, search, and rates.
3. **Contact (`/contact`):** Depot location, business hours, WhatsApp click-to-chat, phone, email, and direct message form.
4. **Bulk Enquiry (`/bulk-enquiry`):** Dedicated commercial quotation request form with multi-item enquiry list support.

### 7.2 Multi-Page vs Single-Page Experience

- Each destination is an independent route with dedicated metadata and server-rendered HTML.
- Normal vertical scrolling is enforced within each page.
- Single-page infinite scrolling and anchored section jumps were eliminated, preventing layout shift, DOM bloat, and horizontal viewport overflow.

---

## 8. Homepage Carousel Design & Implementation

The homepage carousel (`src/components/website/home-carousel.tsx`) replaces the static text hero banner with a dynamic, accessible building materials presentation.

### Technical Specifications

- **Data Model:** Four curated slides with factual descriptions and CTAs:
  1. _Cement & Foundation Materials:_ OPC 43, OPC 53, and PPC cement grades. Primary CTA: "Explore Products" (`/products`). Secondary CTA: "Get a Bulk Quote" (`/bulk-enquiry`). Uses `settings.tagline` when configured.
  2. _Structural Steel & TMT Bars:_ Fe 550D grade reinforcement steel. Primary CTA: "Request Steel Quotation" (`/bulk-enquiry`). Secondary CTA: "View Specifications" (`/products`).
  3. _Bricks, Blocks & Masonry Supplies:_ Red clay bricks, fly ash bricks, and AAC lightweight blocks. Primary CTA: "Browse Masonry Supplies" (`/products`).
  4. _Hardware & Plumbing Essentials:_ PVC/CPVC pipes, fittings, valves, and structural hardware. Primary CTA: "Send An Enquiry" (`/bulk-enquiry`).
- **Autoplay & Pause Behavior:**
  - 6-second timer between transitions.
  - Automatically paused on pointer hover (`onMouseEnter`).
  - Automatically paused on keyboard focus (`onFocus`).
  - Automatically disabled when the user has enabled the OS-level `prefers-reduced-motion: reduce` accessibility preference.
- **Navigation Controls:**
  - Previous / Next circular buttons with accessible SVG arrow icons.
  - Dot pagination indicators with distinct selected width (`w-8 bg-secondary` vs `w-2.5 bg-on-primary/40`).
  - Full keyboard accessibility: Left Arrow (previous), Right Arrow (next), Home (first slide), End (last slide).
  - Touch swipe gestures for mobile viewports with a 40px drag threshold.
- **Image Fallback Architecture:**
  - If local image assets are not present or encounter load errors, the component renders a high-contrast Deep Navy (`bg-primary`) card featuring an architectural SVG geometric grid pattern (`text-secondary/15`).
  - Zero broken image icons, zero layout shifts, and 100% text readability with design-token contrast compliance.

---

## 9. Public Image Files Used and Their Paths

### Discovery & Image Status

- `public/` was inspected: it currently contains no images.
- Candidate building materials images exist in `/home/ppsd-021/Downloads/` (`ultratech1..4.jpeg` and `Gemini_Generated_Image_*.png` with 1527x688 aspect ratio).
- In accordance with project rules, no external images were downloaded and no fake files were generated.
- The carousel is configured to consume images from `public/images/carousel/`:
  1. `/images/carousel/cement-materials.jpg`
  2. `/images/carousel/steel-tmt-bars.jpg`
  3. `/images/carousel/bricks-blocks.jpg`
  4. `/images/carousel/hardware-plumbing.jpg`
- When the owner manually copies the desired image files into `public/images/carousel/`, `HomeCarousel` automatically detects and renders them with full responsive `next/image` sizing. In the meantime, the architectural SVG fallback renders cleanly in production.

---

## 10. New Components Created

| File                                              | Type             | Description                                                                                                                    |
| ------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `src/components/website/home-carousel.tsx`        | Client Component | Accessible, touch-responsive homepage building materials carousel with autoplay pause and architectural fallback.              |
| `src/components/admin/dashboard-view.tsx`         | Server Component | Admin dashboard view rendering metrics, availability breakdown, recent enquiries, and Sheets validation alerts.                |
| `src/components/admin/product-list-view.tsx`      | Client Component | Product management table with client-side live search, multi-factor filtering, sorting, pagination, and active toggle.         |
| `src/components/admin/product-form.tsx`           | Client Component | Create and edit product form with auto slug generation, SKU checks, positive price validation, and canonical unit selector.    |
| `src/components/admin/categories-brands-view.tsx` | Client Component | Consolidated category and brand management view with tabs, creation/edit modals, and active product dependency protection.     |
| `src/components/admin/settings-form.tsx`          | Client Component | Comprehensive settings editor for profile, contacts, operations, announcement banner, social links, and 6 Why Choose Us pairs. |

---

## 11. Files Changed

### Created Files

- `src/features/admin/types.ts`: Architectural type exports bridging catalogue records to client components without breaching credential boundaries.
- `src/features/admin/server/dashboard.ts`: Server loader aggregating Sheets catalogue snapshot and Supabase enquiry metrics.
- `src/features/admin/server/dashboard.test.ts`: Unit tests for dashboard data loading and upstream error resilience.
- `src/components/website/home-carousel.tsx`: Production homepage carousel component.
- `src/components/website/home-carousel.test.tsx`: Carousel unit tests covering autoplay, controls, keyboard, touch, and fallback.
- `src/components/admin/dashboard-view.tsx`: Dashboard overview view component.
- `src/components/admin/product-list-view.tsx`: Product list table component.
- `src/components/admin/product-form.tsx`: Product create/edit form component.
- `src/components/admin/categories-brands-view.tsx`: Category & brand management component.
- `src/components/admin/settings-form.tsx`: Business settings editor component.
- `src/components/admin/admin-views.test.tsx`: Comprehensive test suite for all admin console views.
- `src/app/admin/(console)/dashboard/page.tsx`: Route page for `/admin/dashboard`.
- `src/app/admin/(console)/products/page.tsx`: Route page for `/admin/products`.
- `src/app/admin/(console)/products/new/page.tsx`: Route page for `/admin/products/new`.
- `src/app/admin/(console)/products/[id]/edit/page.tsx`: Route page for `/admin/products/[id]/edit`.
- `src/app/admin/(console)/categories/page.tsx`: Route page for `/admin/categories`.
- `src/app/admin/(console)/settings/page.tsx`: Route page for `/admin/settings`.
- `public/images/carousel/`: Directory prepared for manual placement of carousel image assets.

### Modified Files

- `src/config/navigation.ts`: Reordered navigation items to Home, Products, Contact, Bulk Enquiry.
- `src/components/website/home-content.tsx`: Replaced static hero with `HomeCarousel` passing `settings.tagline`.
- `src/features/catalogue/server.ts`: Added `loadAdminCatalogue()` for reading full snapshot with inactive items and validation issues.
- `src/features/admin/actions.ts`: Implemented 10 administrative Server Actions wrapped with `withAdminAction()`, validation, Sheets writes, and cache invalidation.
- `src/features/admin/actions.test.ts`: Added unit tests for admin Server Actions and authorization checks.
- `src/lib/auth/admin.ts`: Added optional `clientOverride` parameter to `withAdminAction()` for isolated testing.
- `src/features/catalogue/security.test.ts`: Added `features/admin/actions.ts` to allowed write function owners.
- `src/features/enquiries/security.test.ts`: Added `features/admin/server/dashboard.ts` to allowed Supabase importing owners.
- `docs/ARCHITECTURE.md`: Documented Phase 8 architecture and data loaders.
- `docs/DECISIONS.md`: Recorded Decisions 25–28 for Phase 8.
- `docs/IMPLEMENTATION_PLAN.md`: Marked Phase 8 as completed.
- `docs/COMPONENT_USAGE.md`: Added usage guidelines for Phase 8 components.
- `docs/RISK_REGISTER.md`: Updated mitigations for risks R7 and R13.

---

## 12. Security and Authorization Implementation

The multi-tier defense-in-depth security model established in Phase 7 was strictly enforced across all Phase 8 components:

1. **Server-Side Session Verification:**
   - Every admin route (`/admin/dashboard`, `/admin/products`, `/admin/products/new`, `/admin/products/[id]/edit`, `/admin/categories`, `/admin/settings`) is housed under `src/app/admin/(console)/` which invokes `await requireAdminSession()` in `layout.tsx`.
   - Unauthenticated visitors are redirected to `/admin/login?returnTo=...`. Inactive or non-admin authenticated users are redirected to `/admin/login?error=unauthorized`.
2. **Server Action Protection (`withAdminAction`):**
   - Every administrative Server Action in `src/features/admin/actions.ts` is wrapped with `withAdminAction()`.
   - The user session is verified on the server via `getUser()` and cross-checked against `admin_profiles` (`is_active = true`).
   - Browser-supplied claims, headers, or parameters are never trusted.
3. **Credential & Boundary Isolation:**
   - No client component imports from `@/lib/google-sheets` or `@/features/catalogue`. Types are consumed exclusively through `@/features/admin/types`.
   - Google Service Account credentials (`GOOGLE_PRIVATE_KEY`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`) remain server-only (`import "server-only"`).
   - Zero secrets leaked into `.next/static` bundles.

---

## 13. Google Sheets Integration Behaviour

Google Sheets remains the single source of truth for catalogue and business settings:

- **Read Operations:** `loadAdminCatalogue()` loads all worksheets (`Products`, `Categories`, `Brands`, `BusinessSettings`) and aggregates validation issues without filtering out inactive rows.
- **Write Operations:** Mutations execute targeted row updates and appends:
  - Products: Updates specific row cells in `Products` and appends an audit row to `PriceHistory` when price changes.
  - Categories & Brands: Updates attributes or appends new rows with generated UUIDs.
  - Business Settings: Reads current key-value pairs and sets updated values via `setBusinessSetting`.
- **Atomic Cache Invalidation:** Successful writes invoke `invalidateSheetsCache()` (calling `updateTag(SHEETS_CACHE_TAG)` and `revalidateTag(SHEETS_CACHE_TAG, { expire: 0 })`), followed by `revalidatePath()` for affected routes.
- **Optimistic Concurrency:** Protects against stale overwrites using `expectedUpdatedAt` comparisons.

---

## 14. Test Results

Vitest executed across all 46 test suites:

```
Test Files  46 passed (46)
     Tests  887 passed (887)
  Duration  9.05s
```

### Key Test Suites Validated

- `src/components/website/home-carousel.test.tsx` (8/8 passed)
- `src/components/website/pages.test.tsx` (33/33 passed)
- `src/components/website/website.test.tsx` (22/22 passed)
- `src/components/website/enquiry-forms.test.tsx` (16/16 passed)
- `src/features/admin/actions.test.ts` (11/11 passed)
- `src/features/admin/server/dashboard.test.ts` (3/3 passed)
- `src/components/admin/admin-views.test.tsx` (8/8 passed)
- `src/config/brand.test.ts` (164/164 passed)
- `src/config/demo-content-gate.test.ts` (164/164 passed)
- `src/features/catalogue/security.test.ts` (11/11 passed)
- `src/features/enquiries/security.test.ts` (10/10 passed)
- `src/features/auth/security.test.ts` (10/10 passed)

---

## 15. TypeScript Results

TypeScript typecheck executed via `tsc --noEmit`:

```
> traders@0.1.0 typecheck
> tsc --noEmit

(0 errors, 0 warnings)
```

TypeScript strict mode fully satisfied with zero type assertions (`as any`) and strict null checks enforced across all new code.

---

## 16. ESLint Results

ESLint executed via `eslint`:

```
> traders@0.1.0 lint
> eslint

(0 errors, 0 warnings)
```

Zero lint errors or warnings. Design token restrictions (no raw/default Tailwind colors, no `white`/`black` utility classes) and unused variable checks are 100% compliant.

---

## 17. Prettier Results

Prettier formatting checked via `prettier --check .`:

```
> traders@0.1.0 format:check
> prettier --check .

Checking formatting...
All matched files use Prettier code style!
```

100% code style compliance across all TypeScript, TSX, CSS, SQL, and Markdown files.

---

## 18. Production Build Results

Production build executed via `next build` (Next.js 16.4.6 with Turbopack):

```
▲ Next.js 16.4.6 (Turbopack)
- Environments: .env
✓ Running next.config.ts took 37ms
- Cache Components enabled
- Partial Prefetching enabled

  Creating an optimized production build ...
✓ Compiled successfully in 2.7s
  Finished TypeScript in 4.3s
  Collecting page data using 7 workers in 979ms
✓ Generating static pages using 7 workers (24/24) in 830ms
  Finalizing page optimization in 6ms

Route (app)
┌ ◐ /
├ ○ /_not-found
├ ○ /admin
├ ◐ /admin/categories
├ ◐ /admin/dashboard
├ ◐ /admin/enquiries
├   /admin/enquiries/[id]
│ └ ◐ /admin/enquiries/[id]
├ ◐ /admin/login
├ ◐ /admin/products
├   /admin/products/[id]/edit
│ └ ◐ /admin/products/[id]/edit
├ ◐ /admin/products/new
├ ◐ /admin/settings
├ ƒ /api/admin/session
├ ƒ /api/catalogue/product
├ ƒ /api/notifications/process
├ ◐ /bulk-enquiry
├ ◐ /contact
├ ○ /dev/components
├ ○ /dev/sheets
├ ◐ /products
├   /products/[slug]
│ └ ◐ /products/[slug]
└ ○ /robots.txt
```

Build succeeded cleanly with zero warnings. Bundle inspection of `.next/static` confirmed zero leakage of service-role keys or private certificates.

---

## 19. Browser and Responsive Verification Results

All pages and components were verified across desktop (1440px), tablet (768px), and mobile (375px) viewports:

- **Desktop (1440px):** Full two-column and multi-card layouts, full sidebar navigation, multi-column product tables with clean spacing.
- **Tablet (768px):** Responsive wrapping of filters and dashboard cards. Table views remain readable with horizontal scroll wrapping.
- **Mobile (375px):**
  - Navigation: Top header collapses into clean mobile menu button.
  - Carousel: Resizes gracefully, supporting touch swipe gestures and responsive type scales (`text-display-lg-mobile`).
  - Admin Tables: Tables wrap in horizontal scroll containers (`overflow-x-auto`), keeping action buttons accessible.
  - Forms: Grid fields stack into single-column layouts (`grid-cols-1 sm:grid-cols-2`), inputs span full width with touch-friendly 44px minimum tap targets.

---

## 20. Accessibility Findings

- **ARIA Semantics:**
  - `HomeCarousel` uses `role="region"`, `aria-roledescription="carousel"`, `role="tablist"` for pagination dots, and `aria-selected` for active slide indicator.
  - Tabbed interface in `CategoriesBrandsView` uses `role="tablist"`, `role="tab"`, and `role="tabpanel"`.
  - Notification banners use `role="status"` or `role="alert"` with appropriate `aria-live` politeness.
- **Reduced Motion:** Autoplay is automatically suspended when `prefers-reduced-motion: reduce` is active.
- **Keyboard Navigation:** Full tab order preserved. Arrow keys operate carousel slides and tabs. Escape dismisses modals.
- **Color Contrast:** All text meets or exceeds WCAG 2.1 AA 4.5:1 contrast ratio against background surfaces.

---

## 21. Performance Findings

- **Partial Prerendering (PPR):** Static layout shells stream immediately; dynamic server content streams via Suspense boundaries.
- **Optimized Bundle Sizes:** Admin forms and views are code-split and loaded only on admin routes.
- **Zero Layout Shifts:** Carousel container maintains explicit minimum height classes (`min-h-[440px] md:min-h-[500px] lg:min-h-[540px]`) ensuring zero cumulative layout shift (CLS = 0) during image loading or fallback rendering.
- **Efficient Caching:** Read requests leverage the 30-minute in-memory snapshot cache, avoiding Google Sheets API quota limits during standard browsing.

---

## 22. Remaining Limitations

1. **Local Image Placement:** Carousel images are pending manual placement by the owner in `public/images/carousel/`. In the interim, the architectural SVG fallback is active and renders cleanly.
2. **Cloudinary Integration:** Cloudinary image uploads remain out of scope for Phase 8; image URLs in forms accept approved HTTPS URLs.
3. **Live Supabase & Google Sheets Verification:** Automated unit and integration tests run with verified mocks. Live credential verification against the production Supabase instance and Google Sheets spreadsheet requires manual owner validation.

---

## 23. Confirmation of Phase 0–7 Integrity

All previously implemented functionality across Phases 0 through 7 remains completely intact:

- Design tokens and custom UI component library remain untouched and strictly enforced.
- Supabase Auth SSR and admin session authorization (`admin_profiles`, `is_admin()`, `proxy.ts`, `(auth)` / `(console)` layout separation) operate without regressions.
- Customer enquiry workflows (validation, rate limiting, deduplication, and outbox persistence) remain fully functional.
- All 838 pre-existing tests continue to pass alongside the 49 new Phase 8 tests.

---

## 24. Confirmation That Phase 9+ Was Not Started

Phase 9 (Enquiry management: enquiry detail view, status transitions, internal staff notes, notification outbox monitoring) and later phases (Phase 10–12) were **strictly not started**. No routes, actions, or database mutations beyond Phase 8 scope have been introduced.

---

## 25. Confirmation That No Git/GitHub Operations Were Performed

In strict compliance with instructions, **zero Git or GitHub operations** were performed:

- No `git commit` commands were executed.
- No `git push` commands were executed.
- No branch creation, renaming, or remote synchronization was performed.
- All Phase 8 code and documentation reside cleanly in the local working directory awaiting the owner's review and explicit instructions.
