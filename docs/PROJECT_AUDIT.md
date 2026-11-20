# Project Audit (Phase 0)

> **SUPERSEDED IN PART — see `PROJECT_BLUEPRINT.md`.** The blueprint is the authoritative current specification (precedence: `PROJECT_BLUEPRINT.md` > `DECISIONS.md` > other documents). Sections of this document that conflict with it are marked **Superseded** below. Last reconciled: 2026-11-18.

Date: 2026-11-18

## Repository

| Item       | Value                                                                     |
| ---------- | ------------------------------------------------------------------------- |
| Next.js    | 16.4.6 (Turbopack, `cacheComponents`, `partialPrefetching` enabled)       |
| React      | 19.3.0                                                                    |
| Tailwind   | 4.3.3 (`@tailwindcss/turbopack`)                                          |
| TypeScript | 5.x strict                                                                |
| Node / npm | 24.19.0 / 11.17.0                                                         |
| Test       | vitest 5.1 + testing-library + jsdom                                      |
| Added deps | zod 4, server-only, lucide-react 1.x, cva, clsx, tailwind-merge, prettier |
| Git        | **not a git repository** (deliberate: GitHub work deferred)               |

`AGENTS.md` warns this Next.js differs from training data; docs are in `node_modules/next/dist/docs/`. Notable: `proxy.ts` replaces middleware; `LayoutProps<"/">` helper types; `cacheComponents` means dynamic data access (cookies, DB fetches) must be inside `<Suspense>` or cached — directly relevant to Sheets/Supabase phases.

## Process deviation (disclosure)

The user asked to "create the project" before the Stitch export was available, so **Phase 2 foundation was built before Phase 0/1**. Built: layouts, route stubs, env validation, logger, errors, security headers, tests (6 passing), build passing. Consequence: `tokens.css` and the Button are not yet aligned to the spec (see DESIGN_SYSTEM_AUDIT §1). No data/integration code exists.

## Architecture status

Directory structure per plan exists (`app/(website)`, `app/admin`, `components/{ui,common,website,admin}`, `features`, `lib`, `config`, `hooks`, `types`, `styles`). Route pages are placeholders. Admin login currently inherits the sidebar layout (to split in Phase 7). No auth, no data layer, no `proxy.ts`.

## Vercel compatibility

No blockers: pure Next.js, no custom server, no local filesystem writes planned (Cloudinary for uploads). Notes: Google Sheets calls from serverless need caching (Sheets quota 60 reads/min/user); Vercel Hobby plan disallows commercial use → use Pro.

## Route mapping gaps

Plan route list vs designs:

- Design merges **Categories & Brands** on one screen; plan had separate routes. **Superseded: resolved — one `/admin/categories` page with Categories and Brands tabs; one sidebar entry.**
- Design has **product add/edit form**, **enquiry details**, which are not in the plan folder list (`/admin/products/new`, `/admin/products/[id]/edit`, `/admin/enquiries/[id]`) — **corrected route: `[id]/edit`**.
- No 404/error/empty/loading designs.

## Demo data & unsupported claims (must not reach production)

| Category              | Examples (page)                                                                                                                                                                                                                                                          | Production handling                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Demo banners          | "DEMO PROTOTYPE…" on all public pages; "[Demo Placeholder]", "[Demo]" labels                                                                                                                                                                                             | Remove                                                            |
| History/scale         | "Serving … Since 2008", "450+ MT Daily Dispatch Capacity", "35,000 sq.ft", "Same-Day Site Truck Delivery" (home)                                                                                                                                                         | Hide until owner confirms                                         |
| Certification/quality | "100% Original Certified Brands", "Every shipment is verified for tensile strength…", "verified IS 1489 Part 1" badge, "Tamper Proof", "Direct authorized depot supply" (admin brands), "Sample Brands Available" (UltraTech, Tata Tiscon, Jindal, ACC, Ambuja, Finolex) | Remove; dealership relationships unverified                       |
| Pricing claims        | "Live Depot Price Board", "without intermediate markup", "Competitive Pricing", "Minimum wholesale order: 50 Bags"                                                                                                                                                       | Rename ("Indicative rates"), show last-updated; remove unverified |
| SLA                   | "itemized quote on WhatsApp within 30 minutes", "Rapid on-site delivery"                                                                                                                                                                                                 | Remove                                                            |
| Contact               | +91 98000 00000, +91 98111 11111, +91 98765 43210, GSTIN 27AABCS0000A1Z5, "Plot 45-B, Industrial Zone, Bypass Highway Road", sales@sagartraders-demo.com, hours Mon–Sat 8–7:30                                                                                           | From BusinessSettings sheet only                                  |
| Admin                 | Visible credentials `admin@sagartraders.com / admin123`; person "Sagar Aggarwal – Yard Operations Manager"; "Firm: Sharma Builders"; customers Rajesh Sharma etc.                                                                                                        | Remove; real profile                                              |
| Metrics               | 42 products/148 enquiries/12 new/6 categories counts, "Stock check: 450 Bags Ready"                                                                                                                                                                                      | Derive from data                                                  |
| Images                | `lh3.googleusercontent.com/aida/...`                                                                                                                                                                                                                                     | Replace with Cloudinary                                           |

## Data-model gaps discovered in the designs

| UI element                                                                                              | Problem                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product table **SKU** column                                                                            | No `sku` in the Sheets Products schema                                                                                                                            |
| Enquiry detail **Depot Stock Check** quantities ("450 Bags Ready", "18 MT")                             | Schema has only a stock_status enum, no quantity                                                                                                                  |
| Enquiry detail **IP address**, **call duration** timeline                                               | Not collected; IP storage raises privacy questions; call logs unsupported                                                                                         |
| Customer **Firm** field                                                                                 | No `firm` column planned in enquiries                                                                                                                             |
| Contact form **Buyer Type**                                                                             | No place to store it; contact form is "general enquiry" yet plan only specifies product/bulk enquiries — define persistence (same `enquiries` table with `type`?) |
| Product **specifications** as editable key/value rows                                                   | Sheets has one `specifications` text column → define serialisation (JSON)                                                                                         |
| Product **Display on Homepage Rate Board** vs `is_featured`                                             | Two flags in UI, one in schema                                                                                                                                    |
| Dashboard "Stock Watchlist", "Bulk Price Editor", "Export CSV"                                          | Not in plan phases; need scope decision                                                                                                                           |
| Settings: logo, social links (plan 9E)                                                                  | Not in design                                                                                                                                                     |
| Dashboard: category/brand counts, recent updated products/rates, enquiry status overview (plan Phase 8) | Not in design                                                                                                                                                     |
| Enquiry **Completed** status                                                                            | Present in dropdown, absent from filter tabs; "Cancelled / Lost Lead" naming ≠ `CANCELLED`                                                                        |
| Enquiry totals ("Estimated Benchmark Value ₹4,11,850")                                                  | Allowed only as server-computed from authoritative snapshot, labelled indicative; freight/GST excluded                                                            |
| Unit-qty mapping                                                                                        | Bulk form shows "Bags/Tons/CFT" – units must come from product's `unit`                                                                                           |

## Broken / nonfunctional items

All `href`s broken (see inventory). Admin "Storefront", "Logout", "Reset Password" go nowhere. Pagination, sorting, filters static. Price shown "Today, 09:30 AM" strings are hard-coded relative times.
