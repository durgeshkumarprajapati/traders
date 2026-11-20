# Component Usage (Phase 1)

Import from `@/components/ui`. Live gallery (dev only): `/dev/components` (404 in production).
Rule: pages compose these components; they never re-implement button/badge/card/field/table/modal styles.

| Component                                                                                | Variants / API                                                                                                                      | Evidence                                                                                           |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `Button`, `ButtonLink`, `ButtonAnchor`                                                   | `variant`: primary · secondary · outline · ghost · destructive · link; `size`: sm · md · lg · icon. `ButtonAnchor` for `tel:`/wa.me | Primary/secondary/icon/with-icon seen in HTML; ghost/destructive/link per plan (**reconstructed**) |
| `Badge`                                                                                  | `tone` × `appearance` (solid/outline)                                                                                               | status pills seen; palette-only                                                                    |
| `CountBadge`, `DotBadge`                                                                 | numeric / dot                                                                                                                       | sidebar counts, status dots seen                                                                   |
| `StockBadge`, `EnquiryStatusBadge`                                                       | status → tone map (single source)                                                                                                   | Stitch used off-palette colours; remapped                                                          |
| `Card`, `CardHeader/Body/Footer/Title`, `InteractiveCard`                                | elevated · action · interactive                                                                                                     | **Reconstructed** (no card.html)                                                                   |
| `Input` (+`icon`, `type="password"`), `Textarea`, `Select`, `Checkbox`, `Radio`, `Field` | `Field` render-prop wires label/helper/error ARIA                                                                                   | text/icon/password seen in HTML                                                                    |
| `Modal`, `AlertModal`, `Drawer`                                                          | native `<dialog>`; `open`, `onClose`                                                                                                | modal/alert seen; **drawer reconstructed**                                                         |
| `Table`, `THead`, `TBody`, `Tr(interactive, selected)`, `Th`, `Td`                       | standard · interactive · selectable (checkbox column)                                                                               | table seen; selectable **reconstructed**                                                           |
| `Tabs`                                                                                   | horizontal; `icon` per item for icon variant                                                                                        | tabs seen in settings                                                                              |
| `Notification`, `ToastProvider`/`useToast`                                               | success · error · warning · info                                                                                                    | only success toast seen; others **reconstructed**                                                  |
| `Spinner`, `Skeleton`, `EmptyState` (`tone="error"`)                                     | loading/empty/error                                                                                                                 | not designed — **reconstructed**                                                                   |
| `Breadcrumbs`, `Pagination`                                                              | link-based, server-friendly                                                                                                         | seen as static markup                                                                              |

## Examples

```tsx
<Field label="Mobile number" required error={errors.mobile}>
  {(p) => <Input type="tel" {...p} />}
</Field>

<ButtonAnchor variant="secondary" href={whatsAppUrl}><MessageCircle aria-hidden className="size-4" /> WhatsApp</ButtonAnchor>

<AlertModal open={open} onClose={close} onConfirm={archive} title="Archive product?" confirmLabel="Confirm Archive" />
```

## Rules

1. Colours/spacing/type only via tokens (ESLint enforces colours, `dark:`, inline `style`).
2. Icons: Lucide, decorative icons get `aria-hidden`; icon-only buttons need `aria-label`.
3. Status → badge mapping lives in `status-badge.tsx` only.
4. Toasts: wrap the admin layout in `ToastProvider` (Phase 7/8).
5. `Modal`s are controlled (`open`/`onClose`); mount them conditionally per page.

## Not implemented (flagged)

- **Searchable select**: not designed anywhere; native `Select` only. Needs a design decision.
- Drawer exit animation; modal focus-return relies on native `<dialog>`.
- Visual comparison with Stitch: no screenshots supplied — components were matched to the HTML class usage/spec text only.
- When the sticker sheets arrive, diff reconstructed components (Card, Drawer, selectable Table, non-success Notification) first.

## Pending updates from approved decisions (not yet implemented)

- `StockBadge`/`StockStatus` currently has three values. **`AVAILABLE_ON_ORDER`** ("Available on Order", Info blue `#1D4ED8`) is approved and must be added (see `PROJECT_BLUEPRINT.md` §5.2).
- Unit display labels are separate from canonical unit values (see §5.3); no UI component exists for units yet.
- Lint/enforcement refinements approved for the foundation fixes: restricted dynamic inline styles, `text-white`/`bg-black` hints, brand-colour TS export with parity test (see `PROJECT_BLUEPRINT.md` §20.4, §26.1).

## Website components (Phase 3) — `src/components/website`, `src/components/common`

| Component                                                                                                      | Purpose                                                            | Notes                                                                                                                |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `SiteHeader`, `MobileNav`, `EnquiryListLink`                                                                   | Header, mobile drawer menu, live enquiry-list count                | Call/WhatsApp render only when configured in business settings                                                       |
| `SiteFooter`, `AnnouncementBanner`                                                                             | Settings-driven footer and optional banner (white, amber rule)     | No hard-coded business data                                                                                          |
| `ProductCard`, `CategoryCard`, `ProductImage`                                                                  | Reusable cards and image-or-placeholder                            | No price → "Rate on request" (never 0)                                                                               |
| `RateDisplay`                                                                                                  | Indicative rate + unit + last-updated                              | Pair with `PRICE_DISCLAIMER`                                                                                         |
| `WhatsAppButton`, `CallButton`                                                                                 | Click-to-chat / `tel:`                                             | WhatsApp is disabled (with sr text) when no valid number; link text says it opens WhatsApp, never "sent"             |
| `AddToEnquiryButton`, `ProductEnquiryPanel`                                                                    | Add to browser-side enquiry list; product-page enquiry             | Stores only product id + quantity                                                                                    |
| `ProductFilters`, `ProductListing`                                                                             | URL-driven filters (next/form), results, pagination, empty/loading | Search params read inside `<Suspense>`                                                                               |
| `ContactDetails`, `ContactForm`, `BulkEnquiryForm`                                                             | Contact cards and the two enquiry forms                            | Validate with Zod; failed submit focuses an `alert` summary; valid submit says "not connected yet" (no fake success) |
| `QuantityInput`, `FormErrorSummary`, `Section`, `ContentPlaceholder`, `NavLink`, `SkipLink`, `PlaceholderPage` | Shared helpers in `components/common`                              | `ContentPlaceholder` marks content the business has not supplied                                                     |
| `DemoDataNotice`                                                                                               | Visible "sample data" notice                                       | Remove with the sample data in Phase 5                                                                               |

Accessibility note for inline `sr-only` text: put the separating space **outside** the span (`label{" "}<span className="sr-only">…</span>`), otherwise accessible names run together.

## Phase 5 additions — `src/components/website`

| Component / module                                                                       | Purpose                                            | Notes                                                                      |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------- |
| `HomeContent`, `ProductListing`, `ProductDetail`, `BulkEnquiryContent`, `ContactContent` | Async server components holding each page's body   | Read data only via `features/catalogue/server`; render inside `<Suspense>` |
| `HeaderSlot`, `FooterSlot`, `AnnouncementSlot` (`site-chrome.tsx`)                       | Layout slots fed by business settings / categories | Fallbacks use `emptyBusinessSettings()`                                    |
| `CatalogueUnavailable`, `CatalogueEmpty`                                                 | Honest failure vs empty-catalogue states           | No sample data, no technical detail                                        |
| `WhatsAppButton hideIfUnavailable`                                                       | Hide the button when no valid number is configured | Customer pages use it; the disabled variant remains for tests/dev          |
