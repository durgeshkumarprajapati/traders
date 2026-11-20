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

## Foundation already in repo

See `docs/FOUNDATION.md` and `docs/FOUNDATION_RECONCILIATION.md`. Token corrections were completed in Phase 1; remaining approved fixes are listed in `PROJECT_BLUEPRINT.md` §26.1 (not started).
