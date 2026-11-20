# Final Responsive Audit Report — Mobile-First Optimisation

**Project:** Sagar Traders · **Date:** 2026-11-20 · **Git:** no commits, pushes or GitHub operations.

> **Read this first.** All changes below were made by code inspection and verified with TypeScript, ESLint, Prettier, 963 automated tests (jsdom) and a production build. **No real browser was available**: headless Chrome could not start in the agent sandbox (socket creation is blocked), a Firefox attempt and a local server smoke test were refused by the sandbox, and I did not try to bypass that. **Therefore no page was visually verified at any viewport, no screenshots exist, and no before/after images are included.** Every browser-dependent item is marked `NOT TESTED`. jsdom does not evaluate CSS, so the automated tests prove markup, ARIA and class contracts — not rendered layout.

## 1. Executive summary

The audit found that the public site was already largely mobile-aware (stacked grids, mobile drawer, 16px gutters), but several real defects would have broken phones:

| #   | Defect found in code                                                                                                                                                            | Fix                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Admin sidebar (260px) was permanently visible at every width** — at 320px only ~36px remained for content; no mobile navigation existed.                                      | Sidebar `hidden lg:flex`; new sticky top bar + drawer (`AdminMobileNav`); `main` gets `min-w-0`, 16px mobile padding.            |
| 2   | Header main bar could not fit at 320–375px (non-shrinking brand, tagline, Quick Quote, enquiry link, menu).                                                                     | Shrinkable brand, tagline `sm+`, Quick Quote moved into the drawer below 640px, 64px bar on phones.                              |
| 3   | Toasts were `fixed` + `w-full` + `right-16px` → 16px past the left edge on narrow screens.                                                                                      | Inset from both edges, safe-area bottom.                                                                                         |
| 4   | Dialogs/drawers: no page-scroll lock, close button 32px, modal not height-bounded, no scroll for long content.                                                                  | Scroll lock, bounded/scrolling dialog, 44px close on touch, sticky dialog header, safe-area padding.                             |
| 5   | Controls 32–40px high; inputs 14px (iOS zooms the page on focus).                                                                                                               | `pointer-coarse:` 44px targets; 16px inputs below `md`.                                                                          |
| 6   | Dense tables (9 columns on admin products, 7 on enquiries/homepage rates, 8 on enquiry items) relied on horizontal scrolling.                                                   | `Table stacked`: labelled cards below `md` (single DOM; roles preserved).                                                        |
| 7   | Hero carousel: price + prev/next + CTA row could not fit 248px; 36px controls; 11px chips; swipe fired on vertical scroll; unlabeled 14px search; 288px image.                  | Wrapping column layout, 44px controls/chips/tabs, horizontal-intent swipe, labelled 16px `type="search"`, 208px image on phones. |
| 8   | Admin filter row (`w-36` + `w-44` selects) and form action bars did not wrap; six admin `h1`s used a **non-existent token** (`text-display-sm`) and rendered as body-size text. | Wrapping filters; stacked full-width Save/Cancel; headings use `text-headline-lg-mobile md:text-headline-lg`.                    |

## 2. Responsive architecture and breakpoint strategy

Mobile-first Tailwind with the **default breakpoints retained** (`sm 640`, `md 768`, `lg 1024`, `xl 1280`; the token file only clears colours/type/radii/shadows). Decisions:

- **Customer header:** utility bar `sm+`; desktop nav `md+`; drawer below `md`; Quick Quote button `sm+`.
- **Admin:** drawer below `lg` (the 260px sidebar returns at 1024px; tablet portrait gets the drawer so content keeps full width).
- **Tables:** stacked cards below `md`; scroll wrapper only for non-stacked tables.
- **Touch:** `pointer-coarse:` (touch devices only) so desktop appearance is unchanged.
- Explicit `viewport` export (`width=device-width, initial-scale=1`; zoom **not** disabled). `viewportFit=cover` deliberately not set (default behaviour already avoids notches); `env(safe-area-inset-bottom)` is used on toasts/drawer content and is harmless without `cover`.
- `html { scroll-padding-top: 6.5rem }` keeps anchor targets (e.g. `#rates`) below the sticky header.

## 3. Pages inspected (source only; none rendered)

Customer: `/`, `/products`, `/products/[slug]`, `/bulk-enquiry`, `/contact`, not-found/error. Admin: `/admin/login`, `/dashboard`, `/products`, `/products/new`, `/products/[id]/edit`, `/categories`, `/enquiries`, `/enquiries/[id]`, `/settings`.

## 4. Components inspected

Read in full: site-header, mobile-nav, admin-sidebar, admin console + auth layouts, modal, button, table, tabs, notification, form-controls, quantity-input, container, product-filters, home-carousel, bulk-enquiry-form (layout parts), product-card, product-detail, product-image, rate-display, enquiry-list-view (table/pagination), product-list-view, enquiry-detail-view (items table), category/brand tables, dashboard recent-enquiries table, form action bars. **Searched by pattern only (not read line-by-line):** footer, contact-details, dashboard stock breakdown, settings-form fields, category/brand edit dialogs, login form, enquiry status/notes/retry controls. These may hide issues a browser would reveal.

## 5. Header and mobile navigation

- Brand block shrinks (`min-w-0`, name truncates, tagline hidden below 640px); bar height 64px on phones, 80px from `sm`.
- Phones show: brand, enquiry-list icon (count badge kept), menu button. Quick Quote is the **first, full-width button in the drawer**; Call and WhatsApp remain in the drawer; the desktop utility bar (phone/WhatsApp/Admin) stays `sm+`.
- Drawer uses the native `<dialog>`: Escape, focus trap, background inert, focus restored; links close it; scroll lock added; ≥48px link rows. `aria-haspopup`, `aria-expanded`, accessible names kept.
- **Trade-off to review:** on phones Quick Quote is one tap deeper (it is also in the hero and on every product card flow). Say if you prefer it kept in the bar at ≥400px.
- Admin Portal link is hidden on phones (utility bar `sm+`) — it was already not in the mobile drawer; unchanged, flagged for your decision.

## 6. Homepage

Carousel (see §1 #7); rates table stacked below `md`; hero buttons stack below 420px; trust strip headings 14px on phones. Reduced-motion, keyboard arrows, pause-on-focus/hover, tablist semantics were already present and unchanged.

## 7. Product catalogue

Cards: brand/SKU row wraps; footer actions already wrapped. Filters: unchanged structure (drawer below `lg`, URL state, `next/form`), now with 44px controls and 16px inputs on touch, scroll-locked drawer, 44px close.

## 8. Product detail

Specification labels wrap (`whitespace-normal`, `w-2/5` on phones); title uses the mobile heading token; image `aspect-4/3` + `object-contain` (no distortion) unchanged.

## 9. Bulk enquiry and contact

Enquiry rows become cards on phones (name + remove button top row, quantity group below); long names wrap. Submit buttons are full-width on phones. Already present and unchanged: `type=tel`/`inputMode`, `autoComplete`, pending disable (no double submit), values kept on recoverable errors. Server validation/submission untouched.

## 10–11. Admin dashboard and management

Navigation drawer; `min-w-0` main; wrapping filter/pagination/card-header rows; stacked product, enquiry, enquiry-item, category, brand and dashboard tables with all columns and actions preserved; stacked full-width Save/Cancel on product and settings forms; mobile-aware page headings.

## 12. Tables and dialogs

See `docs/COMPONENT_USAGE.md` ("Responsive additions"). The specification table is intentionally a normal scrollable table.

## 13. Accessibility

44px touch targets on touch devices; 16px form text on phones; labelled hero search; `aria-current` in both drawers; table roles preserved in stacked mode with headers visually hidden (not removed); Escape/focus handling via native `<dialog>`; reduced-motion unchanged. Remaining: several secondary text tokens are 11–12px (`label-sm`, `body-sm`) and were not enlarged globally.

## 14. Images

No images were replaced. Carousel image height reduced on phones; product images keep `aspect-4/3`/`object-contain`; `priority` kept on the first carousel image and product-detail image. Per-image `sizes`/lazy-loading were not audited beyond this.

## 15–17. Browser testing, viewports, functional regression

**NOT TESTED / BLOCKED.** Reason: no usable browser or local server in the agent sandbox. The 11-route × 6-viewport matrix (320/375/430/768/1280/1440), the extra widths (360/390/480/640/1024/1920), landscape, 200% zoom, on-screen keyboard, live-vs-static catalogue visual checks, and all authenticated admin workflows were **not run**. Admin pages additionally need a live Supabase session that is not available.

## 18–19. Automated results (run after the final code change)

| Check                  | Result                                                                                                                                                                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`    | PASS (no output)                                                                                                                                                                                                                             |
| `npm run lint`         | PASS (no output)                                                                                                                                                                                                                             |
| `npm test`             | PASS — 56 files, **963 tests** (948 existing + 15 new in `src/components/responsive.test.tsx` + carousel test)                                                                                                                               |
| `npm run build`        | PASS; routes unchanged; Proxy compiled; `pointer-coarse`, `max-md`, `dialog[open]`, safe-area rules present in the emitted CSS                                                                                                               |
| `npm run format:check` | **Errors only on `.zshrc`/`.bashrc`/`.profile` etc.**: the sandbox mounts these as unreadable character devices in the project root (not repository files). `prettier --check src docs supabase *.json *.mjs *.ts *.md` → all files conform. |

No existing test was deleted or weakened. One existing swipe test needed no change; the code treats a missing `clientY` as no vertical movement. New tests cover: admin drawer open/close/ARIA/active-route/Escape, customer drawer Quick Quote, stacked-table markup and non-stacked regression, modal sizing classes, and source guards (no fixed widths > 300px, `min-w-0` main, toast insets, touch classes, scroll lock, shrinkable header).

## 20. Remaining issues (known, not fixed)

1. **Nothing is browser-verified** (above). Expect to find small issues the first time these screens are seen on a phone, especially: stacked-table card spacing, the 5-slide carousel tab strip at 320px, dashboard stock breakdown, category/brand edit dialogs, enquiry status/notes controls, footer.
2. Hero carousel shows a hard-coded **"In Stock"** badge on every slide. That contradicts the Phase 12 "truthful availability" rule. It is business content, not layout, so I left it; recommend removing or driving it from data.
3. Undefined design tokens are used in places (`text-body-xs`, `text-xs`, `font-label`, `rounded-DEFAULT`) — they generate no CSS, so those elements inherit size/font. Not changed (would alter existing desktop appearance); worth a separate cleanup.
4. 11–12px text (`label-sm`/`body-sm`) remains for secondary information. Only unclassed body copy moved to 16px on phones.
5. Stacked mode relies on ARIA roles being honoured for `display:block` tables; screen-reader behaviour was not tested.
6. `.env.example` shows as modified in git; that change is not from this phase.

## 21. Tests not performed

All real-browser viewport checks; mobile landscape/tablet orientation; 200% zoom; on-screen keyboard; touch gestures on a device; screenshot comparison; admin login/logout and every admin workflow (product create/edit/archive, category/brand, settings, enquiry status/notes/retry) — **no live Supabase/Google credentials**; live-catalogue vs static-fallback visual comparison; Lighthouse/CLS measurement; a local `next start` HTTP smoke test (refused by the sandbox); screen-reader testing.

## Verification matrix

| Area                                                | Status                                                     | Evidence                                                    |
| --------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------- |
| Global responsive layout                            | IMPLEMENTED — NOT BROWSER-TESTED                           | Code audit + class/markup tests                             |
| Header                                              | IMPLEMENTED — NOT BROWSER-TESTED                           | Source guard test                                           |
| Mobile navigation                                   | PASS (jsdom interaction)                                   | `responsive.test.tsx` (open/close/ARIA/Escape/active route) |
| Homepage                                            | IMPLEMENTED — NOT BROWSER-TESTED                           | Code audit                                                  |
| Product listing / details                           | IMPLEMENTED — NOT BROWSER-TESTED                           | Code audit                                                  |
| Search and filters                                  | PASS (existing tests); layout NOT TESTED                   | 963 tests                                                   |
| Bulk enquiry / Contact                              | PASS (existing form tests); layout NOT TESTED              | Existing `enquiry-forms.test.tsx`                           |
| Enquiry list                                        | IMPLEMENTED — NOT BROWSER-TESTED                           | Existing tests                                              |
| Admin login/dashboard/management/enquiries/settings | IMPLEMENTED — NOT BROWSER-TESTED                           | Existing view tests + code audit; no live session           |
| Tables                                              | PASS (markup); usability NOT TESTED                        | Stacked-table tests                                         |
| Modals and drawers                                  | PASS (jsdom); rendering NOT TESTED                         | Modal/drawer tests                                          |
| Accessibility                                       | PARTIAL                                                    | ARIA/roles asserted; keyboard/SR not browser-tested         |
| 320 / 375 / 430px / tablet / desktop                | **NOT TESTED**                                             | No browser available                                        |
| Regression tests                                    | PASS                                                       | 963/963                                                     |
| TypeScript / ESLint                                 | PASS                                                       | Command output                                              |
| Prettier                                            | PASS for all repo files; script errors on sandbox dotfiles | See §18–19                                                  |
| Production build                                    | PASS                                                       | Build output                                                |

## Required answers

1. **Complete public site responsive on phones?** Code is mobile-first and the identified defects are fixed, but this is **not verified in a browser**.
2. **Admin dashboard responsive on phones?** The previously missing mobile navigation and table handling are implemented; **not verified in a browser or with a live session**.
3. **Works at 320px without horizontal overflow?** **Unknown / NOT TESTED.** Known overflow causes were removed; no measurement was possible.
4. **Mobile header and navigation work?** Interaction contract passes in jsdom; real rendering/touch **NOT TESTED**.
5. **Customers can browse and filter on mobile?** Functionality unchanged and tests pass; mobile usability **NOT TESTED**.
6. **Add multiple products to the enquiry list on mobile?** Storage/logic unchanged and tested; mobile layout **NOT TESTED**.
7. **Submit bulk and contact enquiries on mobile?** Submission logic untouched and tested; on-device submission **NOT TESTED**.
8. **Admin workflows usable on mobile?** Layouts adapted; workflows **NOT TESTED**.
9. **Modals, drawers, dropdowns, tables on small screens?** Implemented and unit-tested; **NOT TESTED** visually. Native `<select>` dropdowns are browser-rendered.
10. **Tested in actual browser viewports?** **No.**
11. **Existing functionality and integrations intact?** Yes as far as automated tests show (963 pass); no server-side, API, database, auth or integration code was changed.
12. **Remaining responsive issues?** Section 20.
13. **Tests that could not be performed?** Section 21.

## Final status

**RESPONSIVE OPTIMIZATION COMPLETE WITH DOCUMENTED LIMITATIONS** — the code changes and automated checks are complete, but the central acceptance requirement (page-by-page browser verification) was **not met** and must be done on a machine with a browser before this can be called verified. If you require browser evidence for completion, treat the status as `NOT COMPLETE` until then.
