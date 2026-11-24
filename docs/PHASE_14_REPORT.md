# Phase 14 — Digital business visiting card & direct phone calling

Status: **implemented and verified by automated checks (typecheck, lint, formatting, 1,818 unit/component tests incl. real PNG rendering). NOT deployed, NOT browser-tested, production build NOT verified in this session (blocked by the sandbox network). Nothing committed, pushed or deployed; no migration, environment variable or paid service changed.**

## 1. Read this first (honest caveats)

1. **Design reference.** The card was first built from the brief's text description; it was then rebuilt to match the reference you supplied (screenshot + HTML): 640 px wide card, navy 4/5 + amber 1/5 strip, 56 px emblem tile, name 24/700 navy with tagline, GSTIN badge top-right, muted category strip with bullet separators, contact rows with 32 px icon tiles (navy phone, amber mail, bordered pin), QR card on the right, navy footer band with amber "Digital Visiting Card". **Deliberate differences, because the reference contains demonstration content:** no "[Demo]" tags; row labels are neutral ("Phone" / "Phone & WhatsApp" / "WhatsApp" / "Email" / "Address") instead of "Phone & WhatsApp Desk", "Quotation & Commercial Email" and "Main Depot & Weighbridge"; the QR caption is "Scan to visit our website" (the QR points to the website, not "live rates"); the footer shows only the configured opening hours (no "Same-Day Site Dispatch" claim; if no hours, the website host); the category strip lists the real active catalogue categories. The emblem is the app's own approved icon (`public/icons/icon.svg`), identical to the reference logo. **Please compare the sample renders with your reference** (regenerate with `CARD_PREVIEW_DIR=/some/dir npx vitest run src/features/business-card/render.test.ts`).
2. **No real browser, phone, installed PWA, share sheet or dialer was used.** Every browser/mobile/PWA item below is marked NOT TESTED with manual steps.
3. `next build` could not complete here because `next/font` could not reach Google Fonts (sandbox network allow-list; not bypassed). It passed at the end of Phase 13 and nothing in `layout.tsx`/fonts changed; typecheck, lint and every page test pass. Re-run `npm run build` on your machine/Vercel.
4. The card's sample renders use a fallback sans-serif (Node has no Inter). In browsers the page's self-hosted Inter is used; text is measured at draw time, so wrapping adapts to it.

## 2. Audit (before changes)

- Business facts: Google Sheets `BusinessSettings` → `BusinessSettings` type (`features/settings/business-settings.ts`). Fields reused: name, tagline, phone, whatsappNumber, email, address, businessHours, gstNumber (+ `logo_url`, already parsed from the sheet but previously dropped by `toBusinessSettings`). Categories: active catalogue categories. Website: `NEXT_PUBLIC_SITE_URL`. **No new setting, schema or migration.**
- Existing phone handling was **inconsistent and unvalidated**: header top bar, footer and quotation stripped characters themselves; the offline page, track-enquiry page and callback modal built `tel:${raw}` from whatever was stored (spaces, brackets and text would end up in the link). No validation anywhere.
- No logo image asset exists: the header draws a navy tile with a building icon (a documented temporary emblem).
- QR: `features/qr/qr.ts` (server-only `qrcode`). PWA: allow-list service worker; `/contact` and `/` already cached public pages.

## 3. Direct calling

- `src/lib/phone/index.ts` — `parsePhone()` → `{ e164, href, display } | null`. Accepts digits, spaces, `-`, `.`, `()` and one leading `+`; **rejects** letters, extensions, `#`, `*`, commas, misplaced `+`, too short/long. International numbers (`+`/`00`) are used as written (8–15 digits). A number with no international prefix is treated as Indian (10 digits, `0`+10, or `91`+10). Indian numbers need exactly 10 national digits starting 1–9. The dial target is always `tel:+<digits>`; the **display** keeps the owner's own formatting.
- `components/business/business-call-link.tsx` — `BusinessCallLink`: a real `<a href="tel:+…">`, `aria-label="Call <business> at <number>"` for the default content (custom visible text keeps its own accessible name), `min-h-11` (44 px), visible focus ring, renders **nothing** for a missing/invalid number.
- `CallButton` (existing, `contact-actions.tsx`) now uses the same validator. Replaced every hand-built business `tel:`: header top bar and mobile drawer, footer, contact page and homepage contact cards, callback modal, track-enquiry (2), quotation view, offline page. Admin `tel:` links to _customer_ numbers are out of scope and unchanged.
- WhatsApp is untouched and separate (own number, own URL builder). The card/links never call automatically; the device confirms the call.
- Known limitation: the slim desktop top bar is 36 px tall, so its call link is below 44 px there (pointer UI); the mobile drawer and all buttons meet 44 px.

## 4. Visiting card

- **Data** `features/business-card/data.ts` (`buildBusinessCardData`): only configured, valid values; everything else is `null` and omitted. Phone via `parsePhone`; WhatsApp shown only if different from phone; email must look like an email; GSTIN only if structurally valid; categories = active, de-duplicated, ≤ 6, ≤ 26 chars each; website only if `https`, not localhost/IP/`.local`/credentials. No demonstration values anywhere (a source gate test now also bans the reference's demo GSTIN and address).
- **One renderer** `features/business-card/draw.ts` (`drawBusinessCard`): 640 × 440 design units (the reference's 640 px width), draws on any Canvas 2D context. The on-screen preview (`BusinessVisitingCard`, canvas) and the PNG export call the **same function with the same data**, so they cannot diverge. Long text is wrapped/ellipsised, fonts shrink and spacing tightens so nothing overlaps (checked on extreme inputs).
- **Export** `features/business-card/export.ts`: waits (bounded 3 s) for the Inter weights, loads the logo (CORS `anonymous`, 5 s) and falls back to the built-in brand mark, draws at **3× = 1920 × 1320 px**, encodes with `canvas.toBlob("image/png")` and verifies the blob; clear errors (`NO_CANVAS`, `ENCODE_FAILED`). No dependency, no external service, no page screenshot.
- **QR**: matrix generated **on the server** (`qrMatrix` in `features/qr/qr.ts`) for the validated production origin only (no path, no tokens, no customer data) and drawn by the card itself as vector squares; no QR library ships to the browser. Omitted when the URL is not a valid public https URL. Caption "Visit Our Website" appears only with a QR.
- **Logo**: the configured `logo_url` (Cloudinary host only, https) is used if it loads with CORS; otherwise the existing emblem is drawn. Remote logos that do not send CORS headers silently fall back (they would otherwise block PNG export).
- **UI**: `BusinessCardSection` (server) → `BusinessCardPanel` (client). Button "Download Business Visiting Card" → "Preparing Visiting Card…" (disabled; a synchronous guard blocks repeat clicks) → download of `<business-name>-business-card.png` (e.g. `sagar-traders-business-card.png`). A "Share card" button appears **only** where the browser can share image files; cancel is silent, failure is reported, unsupported falls back to download. Messages never claim a save to the gallery: "downloading as …; to keep it in your phone's gallery, open the image and choose Save or Share".
- Placement: homepage (after the contact section), contact page (`#visiting-card`), footer link "Download business card". Not added to the header (kept uncrowded). Hidden entirely when there is no name plus at least one of phone/email/address. GSTIN (if valid) appears as the header badge, opening hours in the footer band.
- Files: `features/business-card/{data,draw,export,fixtures}.ts`, `components/business/{business-call-link,business-visiting-card,business-card-panel,business-card-section}.tsx`, `lib/phone/index.ts`.

## 5. Dependencies and environment

- Added **dev-only** `@napi-rs/canvas` (renders the real PNG in Node tests; never in the app bundle). No runtime dependency. No new environment variable. **`NEXT_PUBLIC_SITE_URL` must be the real public https origin** or the QR and website line are (correctly) omitted.
- `BusinessSettings.logoUrl` (optional) added; `toBusinessSettings`/`emptyBusinessSettings` carry it. No sheet or database change.

## 6. Automated verification (executed)

| Check                                                | Result                                                      |
| ---------------------------------------------------- | ----------------------------------------------------------- |
| `tsc --noEmit`, `eslint src`, `prettier --check src` | clean                                                       |
| `vitest run`                                         | **1,818 tests passed** (95 files)                           |
| `next build`                                         | **NOT VERIFIED here** (Google Fonts blocked by the sandbox) |

Tests added: `lib/phone` (24 cases: valid/invalid/normalisation); `business-card/data` (configured values, missing optional values, no demo values, WhatsApp≠phone, GSTIN/email/phone validation, categories, logo scheme, public URL/QR rules, filename); `business-card/export` (PNG at 1920×1320, only configured fields drawn, encode/canvas failure, font failure fallback, logo load/failure, download link + filename + URL release, native share/cancel/fail); `business-card/render` (**real PNG**: valid 1920×1320 signature and size, non-blank, exact brand colours, **QR decoded from the PNG equals the configured site URL at export and preview scale**, no QR for localhost/http/invalid, sparse and extreme-length inputs); `components/business` (call link, preview accessible name, download success/failure/retry, "Preparing…" + repeated-click prevention, share button visibility/flows); `business-card/placement` (no hand-built `tel:` in customer code, call links in every public location, WhatsApp separate, card on home/contact/footer, no hard-coded phone/email/GSTIN, QR library server-only, no new API route, service worker unchanged). Existing tests changed only for deliberate behaviour: footer link accessible name (`responsive.test`), `emptyBusinessSettings` gained `logoUrl`, demo-content gate gained the reference's GSTIN/address patterns.
Visual check: I rendered and inspected the PNGs (full, sparse, extreme) — no clipping or overlap.

## 7. NOT TESTED (needs a real device)

Everything below is untested; none is claimed to work.

1. Download on Android Chrome, iPhone Safari, desktop Chrome/Edge/Firefox; the downloaded file opens at 1920×1320 with logo/QR/text intact; scan the QR from the file and from a print.
2. WhatsApp/email sharing of the PNG; the native share sheet (Android, iOS); print at 3.5 × 2 in.
3. Installed PWA: download/share inside the standalone window; `tel:` handoff.
4. Each call link (header top bar, mobile drawer, homepage contact, contact page, footer, callback success, tracking, quotation, offline page) opens the dialer with the right number and never dials by itself; desktop behaviour with/without a calling app.
5. Widths 320/360/375/390/430/768/1024/1280/1440: no horizontal overflow, preview scales, buttons reachable.
6. Real Inter rendering and a real Cloudinary logo (CORS) in the exported PNG.
7. Regression walkthrough of the other features listed in the brief (covered only by automated tests).

## 8. Notes

- The admin settings form shows an input _placeholder_ "e.g. +91 91234 56789" (pre-existing, same number as the reference's demo phone). It is not data and never reaches customers; change it if you want it gone.
- The reference's "demo badge" and claims are not reproduced.
- Awaiting approval; nothing deployed.
