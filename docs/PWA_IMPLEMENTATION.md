# Progressive Web App

Status: implemented; the service worker's behaviour is unit tested by running the real `public/sw.js` in a sandbox; install/offline UI unit tested. **Not tested in a real browser (no Lighthouse, no install on a device).**

## Manifest (`src/app/manifest.ts` → `/manifest.webmanifest`)

Name and short name "Sagar Traders"; `id` and `scope` `/`; `start_url` `/`; `display: standalone`; theme `#17365D`, background white; `lang: en-IN`; **no orientation lock** (so tablets / rotated screens are not forced into portrait). Icons: 192 and 512 (`any`) and a maskable 512.

**Icons are temporary.** No official logo file exists in the repository, so the icons are a generic abstract emblem in the brand colours (navy/amber/white) generated for this purpose. They are not a registered logo. Replace `public/icons/*` when the owner supplies the real mark.

## Service worker (`public/sw.js`, version `v2`)

An explicit **allowlist**; anything not listed goes straight to the network and the worker never reads or stores it.

| Never intercepted, read or cached                                                                                                                                                                                                                                                                                                                                       | Cached                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/admin/**`, **every** `/api/**` (incl. health, session, quotation PDFs, notifications), `/track-enquiry`, `/quotation/**`, `/_next/data`; non-GET; cross-origin; requests with `Authorization` or `Range`; RSC / prefetch requests; any URL with `token`, `ref`, `key`, `code`, `otp`, `auth`, `session`, `q`, `search`, `email`, `phone`, `mobile`, `name` parameters | **Pages** (network-first, 4 s timeout, then the saved copy): `/`, `/products`, `/products/<slug>`, `/contact`, `/bulk-enquiry`, `/offline`. **Build assets** `/_next/static/**` and **public images** (cache-first) |

- A response is stored only if it is HTTP 200, same-origin, and **not** `Cache-Control: no-store/private`.
- Every stored page is stamped with its save time (`x-sw-cached-at`).
- Caches are versioned (`sagar-pages-v2`, `sagar-assets-v2`), **size-bounded** (40 pages, 120 assets, oldest evicted), and old Sagar caches are deleted on activation without touching other applications' caches.
- Install pre-caches only `/offline` and two icons. A new version waits until the customer taps "Refresh" (no forced takeover of an open page).
- Enquiries, callbacks and tracking are **online-only**: they are never queued, and offline they show an explicit message and keep the typed values. Nothing private (tokens, enquiries, quotations, OTPs, admin data, personal details) is ever stored by the worker.

## Offline experience

A banner appears **only while offline**: "You are offline — this is a saved copy from <date/time>. Prices and availability may be out of date. Enquiries can only be sent when you are online." (the time comes from the saved page's stamp). Pages never visited offline show `/offline` (call button only if a phone is configured). When the connection returns the banner disappears and the next navigation fetches fresh data.

## Install prompt

Chromium browsers: the page captures the browser's install event and shows an **Install** button; the native prompt appears **only after the customer clicks**. iOS Safari (no install API): shows "Share → Add to Home Screen" steps. Never shown inside an installed app; **dismissal is remembered for 30 days**; it never claims the app is installed (the browser's `appinstalled` event just hides it). Other browsers simply get no prompt and the site works normally.

## Verify on a device (owner)

1. Chrome (Android): open the site, wait for the Install button, install, open from the home screen. 2. DevTools → Application → Service Workers / Cache Storage: after browsing a product page you should see only the allowlisted URLs — never `/admin`, `/api`, `/quotation`, `/track-enquiry`. 3. Switch to offline mode: visited pages open with the banner and date; unvisited pages show `/offline`; submitting a form shows the offline message. 4. Lighthouse → PWA/Installable.
