# Phase 3 Report — Customer Website UI

Date: 2026-11-18 · Status: **built, awaiting owner review.** Not marked complete: browser verification is outstanding (see §4).

> **Update (Phase 5):** the sample data described below was removed; customer pages now read the validated Google Sheets catalogue. See `PHASE_5_REPORT.md`.

## 1. Scope delivered

UI only, on **temporary sample data**. No Google Sheets, Supabase, Cloudinary, Web3Forms, authentication or enquiry persistence; no fake API responses.

| Route              | What exists                                                                                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/`                | Hero, categories, featured products, indicative-rates table, why-choose-us (placeholders), brands, bulk-enquiry CTA, contact information                                                         |
| `/products`        | Search, category/brand/availability filters, sort, pagination (8/page), loading/empty states; URL-driven (`next/form`), server-rendered in `<Suspense>`                                          |
| `/products/[slug]` | Breadcrumb, image/placeholder, stock badge, SKU, rate-or-"Rate on request", disclaimer, description, enquiry panel (quantity, location, WhatsApp, add to list), specifications, related products |
| `/bulk-enquiry`    | Browser-side enquiry list (product search, add/remove, quantity), customer details form, validation with focused error summary, WhatsApp list message                                            |
| `/contact`         | Settings-driven contact cards, location placeholder, general enquiry form with validation                                                                                                        |
| Shared             | Header (+ mobile drawer), footer, announcement slot, skip link, `aria-current`, `(website)` error/loading/not-found                                                                              |

## 2. Rules followed

- White canvas, black text; navy and amber only on components (CTA card border, buttons, badges); no navy sections; no dark mode; Lucide icons only; token utilities only (lint + hex/colour tests green); custom UI library only.
- **No invented business facts.** Phone, WhatsApp, address, email, hours, GSTIN, tagline and announcement are all `null` in `getBusinessSettings()`; the UI omits them or shows a labelled placeholder. Sample products have generic names, **no prices, no timestamps**, no real brands. A content-gate test (`src/config/demo-content-gate.test.ts`) fails on demo phones, GSTIN, unverified claims, real brand names and Stitch image URLs.
- Price honesty: no price → "Rate on request" (never 0); exact disclaimer shown; no "live" wording; unpriced products sort last.
- Single-product WhatsApp is WhatsApp-only (no record). WhatsApp text only says it _opens_ WhatsApp. Without a configured number the button is visibly disabled.
- Forms: valid input shows "Submission is not connected yet … Nothing was sent or saved." No success state, no reference number.
- All sample-data pages are `noindex` (remove with the sample data in Phase 5).

## 3. Decisions applied

Four stock statuses (incl. `AVAILABLE_ON_ORDER`, info blue; shown on enquiry items and in filters); canonical units incl. `METRIC_TON`, `BLOCK`, `CUSTOM` with a user-defined label; `AVAILABLE_ON_ORDER` allowed in bulk enquiries. Constants live in `src/features/products/units.ts` and `status-badge.tsx`.

## 4. Verification record

| Check                                              | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tsc --noEmit`, ESLint, Prettier, production build | Pass (29 pages)                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Tests                                              | 10 files, all pass (units, formatting, query/filter/sort/pagination, WhatsApp builders, schemas, enquiry store, forms, cards, filters, nav, content gate, brand parity, lint rules, logger, UI library)                                                                                                                                                                                                                                                                  |
| Built-HTML inspection                              | 1 `h1` and 1 `main` per page; heading order correct; skip link is first anchor; `aria-current` present; `noindex`; exact disclaimer; titles; mobile menu button + drawer markup present                                                                                                                                                                                                                                                                                  |
| **Not performed (environment)**                    | **Running-server HTTP check** (`npm start` is refused by the sandbox, so `/dev/components` → 404 over HTTP was not observed live; build output shows prerender status 404). **Browser tests**: no browser tool exists in this session, so skip-link visibility/activation, focus movement to `#main-content`, `aria-current` while navigating, drawer focus restore, responsive layouts (375/430/768/1280/1440), and visual comparison with Stitch were **not** verified |

### Manual checklist for the owner (≈10 minutes)

1. `npm run build && npm start`; `curl -i localhost:3000/dev/components` → **404**.
2. Keyboard: Tab once → "Skip to main content" appears; Enter → focus lands in `<main>`; Tab through header → visible focus rings; current page link underlined.
3. Narrow window (<768px): menu button opens the drawer; Esc closes and focus returns to the button; links navigate.
4. `/products`: apply filters, sort, page 2; open "Filters" on mobile; clear filters; search nonsense → empty state.
5. Product page: quantity stepper, "Add to enquiry list", header count increments; `/bulk-enquiry` shows the item with its availability badge; submit empty → focus jumps to error summary; submit valid → "not connected yet".
6. Check 375px, 768px and 1280px for overflow and readability.

## 5. Known limitations and placeholders

- Sample data, no real catalogue; rates table shows "Rate on request" everywhere.
- Business details, WhatsApp number, map, announcement: absent until Business Settings (Phase 4/5).
- "Why choose us" and brand statements are labelled placeholders awaiting owner-approved wording.
- No product photos (neutral placeholder); no logo (text wordmark).
- Enquiry list persists in `localStorage` (provisional) and stores only ids and quantities.
- Mobile-number rule is provisional; unit is read-only on enquiry rows (taken from the product).
- Drawer exit animation, searchable select: still deferred. Listing filters live in a drawer below `lg`.
- No sitemap/structured data/OG yet (Phase 11).
