# Stitch Design Inventory (Phase 0)

Source: `~/Downloads/stitch_sagar_traders_b2b_platform (1)/stitch_sagar_traders_b2b_platform/`
Contents: 13 × `*/code.html` + `sagar_traders_design_system.md`. **No screenshots, images, or `components/` sticker sheets were exported.**

## Screens

| #   | Stitch folder                   | Audience | Production route                                           | Size  | Responsive classes |
| --- | ------------------------------- | -------- | ---------------------------------------------------------- | ----- | ------------------ |
| 1   | customer_homepage               | Public   | `/`                                                        | 53 KB | sm/md/lg (25/13/9) |
| 2   | product_catalog_filters         | Public   | `/products`                                                | 33 KB | yes                |
| 3   | product_details_enquiry         | Public   | `/products/[slug]`                                         | 18 KB | yes                |
| 4   | bulk_quotation_request          | Public   | `/bulk-enquiry`                                            | 21 KB | yes                |
| 5   | contact_location                | Public   | `/contact`                                                 | 17 KB | yes                |
| 6   | admin_portal_login              | Admin    | `/admin/login`                                             | 9 KB  | **none**           |
| 7   | admin_operations_dashboard      | Admin    | `/admin/dashboard`                                         | 18 KB | partial (lg/sm)    |
| 8   | admin_product_catalog           | Admin    | `/admin/products`                                          | 20 KB | **none**           |
| 9   | admin_add_edit_product          | Admin    | `/admin/products/new`, `/admin/products/[id]`              | 20 KB | md only            |
| 10  | admin_category_brand_management | Admin    | `/admin/categories` + `/admin/brands` (design merges them) | 20 KB | lg only            |
| 11  | admin_enquiry_workflow          | Admin    | `/admin/enquiries`                                         | 18 KB | **none**           |
| 12  | admin_enquiry_details_notes     | Admin    | `/admin/enquiries/[id]`                                    | 19 KB | md only            |
| 13  | admin_business_settings         | Admin    | `/admin/settings`                                          | 17 KB | md only            |

## Shared layouts

- **Public shell** (screens 1–5): demo banner → top bar (hours, Admin Login) → header (logo, 4 nav links, phone, WhatsApp) → content → footer (links, materials, helpline).
- **Admin shell** (screens 7–13): 260px sidebar (Dashboard, Products (42), Categories & Brands, Enquiries (12 New), Business Settings, user card "Sagar Aggarwal", Storefront, Logout) + fluid canvas on `bg-surface-muted`.
- **Admin login** (6): centred card, no sidebar.

## Repeated components (extract once)

Header, footer, product card (listing/homepage/featured), category card, price-board table row, stock badge (In Stock / Limited / Out), status badge (enquiry statuses), WhatsApp quote button, search input, filter sidebar (checkbox/radio groups), pagination, breadcrumbs, enquiry-item row (qty + unit), admin sidebar, admin page header, stat card, data table, modal (archive, category, brand), toast (save/settings), form field groups, tabs (settings page), timeline (enquiry detail).

## Navigation relationships

- Every `href` in the export uses a prototype folder scheme (`../admin-dashboard/AdminDashboard.html`, `../product-listing/ProductListing.html?cat=cement`, `?id=cement-ppc`) that **does not match even the exported folder names**. All must be rewritten to App Router routes. Query-param conventions (`?cat=`, `?id=`) should become slugs/search params.
- Category links on the homepage use `cat=cement|steel|bricks|aggregates|plumbing|others`; admin lists `/cement /steel /bricks /aggregates` slugs. Slugs must come from Sheets.

## Interactions in the export

Zero `<script>` blocks (apart from Tailwind config). Only 11 inline `onclick` toggles for modals/toasts. Everything else is **non-functional**: mobile menu button (`#mobile-menu-btn`), filters, search, sorting, pagination, quantity steppers, "Add Item", "Export CSV", drag-reorder handles, "Reset Password", "Keep session active", archive/save beyond toast, enquiry form submit (a static confirmation box exists in HTML), tabs on settings page.

## Component variants observed vs required (plan §Phase 1)

| Component                      | Seen in HTML                                                                             | Required by plan           | Gap                                              |
| ------------------------------ | ---------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------ |
| Button                         | primary (navy), secondary (amber), outline, icon, with-icon                              | + ghost, destructive, link | destructive/ghost/link not specified             |
| Badge                          | numeric (sidebar count), dot, status pills                                               | numeric, dot, status       | ok                                               |
| Card                           | elevated, action, interactive                                                            | same                       | sheets missing                                   |
| Input                          | text, icon, password(with visibility), select, textarea, checkbox, radio, number stepper | + searchable select        | searchable select not designed                   |
| Modal                          | standard, alert (archive), drawer (spec only)                                            | standard, alert, drawer    | drawer not seen in any page                      |
| Table                          | standard, interactive; selectable (spec only)                                            | 3                          | selectable unseen                                |
| Tabs                           | horizontal/icon (settings)                                                               | 2                          | ok                                               |
| Notification                   | toast (success)                                                                          | success/error/warning/info | only success designed                            |
| Loading / empty / error states | **none**                                                                                 | required                   | must be designed-by-system, flagged for approval |

## Breakpoints

Only Tailwind defaults `sm`(640) `md`(768) `lg`(1024) used; `xl` unused. Admin pages largely desktop-only; sidebar has no mobile collapse. Mobile admin behaviour is **unspecified**.

## Assets

- 10 unique `lh3.googleusercontent.com/aida/...` images (Stitch-hosted, temporary): cement, TMT, bricks, sand, pipes, hero. No logo file — logo is a text "ST" navy square.
- Icons: **Material Symbols Outlined** via Google Fonts. Plan specifies Lucide → needs mapping table.
- Fonts: Inter 400/500/600/700/800 via Google Fonts.
- Tailwind via **CDN runtime** (`cdn.tailwindcss.com?plugins=forms,container-queries`).
