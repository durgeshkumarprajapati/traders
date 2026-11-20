# Approved Decisions (post-Phase 0)

| #   | Decision                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Categories & Brands share one admin screen (tabs or clearly separated sections).                                                                                   |
| 2   | Contact-form submissions are saved in Supabase as enquiries (type `GENERAL`, no items) + email notification. WhatsApp stays optional.                              |
| 3   | Add `sku` (optional, unique-when-present, searchable in admin) to the Products sheet in Phase 4. Drop firm and buyer-type for v1.                                  |
| 4   | White canvas everywhere incl. admin. No navy section backgrounds / gray admin canvas. Navy and amber only as component accents.                                    |
| 5   | Lucide icons only.                                                                                                                                                 |
| 6   | "Quotation Sent" uses Info blue `#1D4ED8`.                                                                                                                         |
| 7   | Durable outbox table with notification attempts, delivery status and retry. Enquiry + outbox row saved in one transaction; email failure never rejects an enquiry. |

Rules: no dark mode, no colours outside the approved palette, no business-logic changes in Phase 1.

## Implications recorded for later phases

- Phase 4: Products sheet gains `sku`; uniqueness validation when provided.
- Phase 6: single `enquiries` table with `type` (`BULK` or `GENERAL` only — **superseded:** no `PRODUCT` type), `enquiry_items` optional (none for `GENERAL`); `notification_outbox` + attempts/status/retry.
- Phase 3/8: homepage bulk-enquiry banner, footer and admin shell must be white surfaces with bordered/accent components (the Stitch navy banner and gray admin canvas are not used).

## Decisions after the Phase 2 reconciliation review (2026-11-18)

Authoritative detail: `PROJECT_BLUEPRINT.md` §27 and §26.1.

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8   | Custom UI component library only; **shadcn/ui is not introduced** alongside it.                                                                                                                                                                                                                                                                                                          |
| 9   | Categories and Brands: **`/admin/categories`** with Categories and Brands tabs, one sidebar entry. `/admin/catalog` is not used. (Supersedes the earlier "tabs or sections" wording in #1.)                                                                                                                                                                                              |
| 10  | Contact form uses **Server Actions**; validation, auth, persistence and business logic on the server.                                                                                                                                                                                                                                                                                    |
| 11  | `vitest-axe` deferred to **Phase 11**.                                                                                                                                                                                                                                                                                                                                                   |
| 12  | Reconciliation fixes approved with allocation: before Phase 3 — showcase isolation, Categories/Brands merge, missing route stubs, `noindex` placeholders, error boundaries, logger serialisation/redaction (incl. nested secrets), ESLint refinements, brand-colour TS export + parity test, skip link/`aria-current`/`metadataBase`/`engines`. **Login/console route groups: Phase 7.** |
| 13  | All four stock statuses retained: `IN_STOCK` (success `#166534`), `LIMITED_STOCK` (warning `#B45309`), `OUT_OF_STOCK` (error `#B91C1C`), `AVAILABLE_ON_ORDER` (info `#1D4ED8`, "Available on Order"); add to common badge and product validation.                                                                                                                                        |
| 14  | Units: full list + custom unit; canonical value with separate display label; `TON` ≠ `METRIC_TON`; no silent conversion; admin can pick a predefined unit or type a custom one. Final value list to be confirmed before Phase 4.                                                                                                                                                         |
| 15  | Single-product WhatsApp enquiry: **WhatsApp-only, not persisted**. Bulk enquiry and contact form: persisted in Supabase (`BULK`, `GENERAL`).                                                                                                                                                                                                                                             |
| 16  | `PROJECT_BLUEPRINT.md` is the authoritative current specification; older documents carry a "superseded" banner where they conflict.                                                                                                                                                                                                                                                      |

## Decisions on open items (2026-11-18)

| #   | Decision                                                                                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 17  | Final canonical units: BAG, PIECE, KG, TON, METRIC_TON, CUBIC_FEET, CUBIC_METER, BUNDLE, BOX, METER, BRASS, BLOCK, CUSTOM. `TON` ≠ `METRIC_TON`, no conversion. `CUSTOM` supports a user-defined display label. |
| 18  | "50 kg Bag" is a pack description; "3m Length" is a product size/specification. Neither is a unit.                                                                                                              |
| 19  | `AVAILABLE_ON_ORDER` products are allowed in bulk enquiries; availability shown clearly.                                                                                                                        |
| 20  | Outbox attempt storage deferred to Phase 6; other operational/admin decisions deferred to their phases.                                                                                                         |
| 21  | Phase 2 foundation-fix batch (`PROJECT_BLUEPRINT.md` §26.1) authorised and implemented 2026-11-18. Login/console split remains Phase 7.                                                                         |
