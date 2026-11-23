# Progressive Web App (PWA) Implementation

**Project:** Sagar Traders  
**Scope:** Installable Web App, Offline Resilience & App Manifest  
**Files:** `src/app/manifest.ts`, `public/sw.js`, `src/app/(website)/offline/page.tsx`, `src/components/website/pwa-components.tsx`

---

## 1. Overview

Sagar Traders is configured as an installable Progressive Web App (PWA) designed for building contractors, site engineers, and property owners operating in low-connectivity construction environments.

---

## 2. Web App Manifest (`src/app/manifest.ts`)

Conforms to W3C Web App Manifest standards:

- **Name:** _Sagar Traders – Building Materials_
- **Short Name:** _Sagar Traders_
- **Description:** _Direct site supply of TMT steel, cement, bricks, sand, and building materials._
- **Start URL:** `/`
- **Display Mode:** `standalone`
- **Theme Color:** `#17365D` (Deep Navy)
- **Background Color:** `#FFFFFF`
- **Icons:** Standard and Maskable icons in 192x192 and 512x512 PNG formats located at `/icons/icon-192.png`, `/icons/icon-512.png`, and `/icons/icon-maskable.png`.

---

## 3. Service Worker Caching Strategy (`public/sw.js`)

The service worker implements a strict multi-tier caching policy:

1. **Pre-cached Core Assets (Install Phase):**
   - Offline fallback page: `/offline`
   - Static branding icons and styles.
2. **Network-First with Offline Fallback for Public Pages:**
   - Customer-facing pages (`/`, `/products`, `/contact`, `/bulk-enquiry`) attempt network fetch first.
   - If offline or network timeout occurs, cached responses are served. If not cached, the custom `/offline` page is served.
3. **Strict Exclusions (Never Cached in Service Worker):**
   - `/admin/*`: Administrator console and management pages.
   - `/track-enquiry*`: Dynamic tracking tokens and enquiry details.
   - `/quotation/*`: Private digital quotations.
   - `/api/*`: Dynamic API routes, session endpoints, and PDF downloads.
   - Method `!= GET`: All POST, PUT, DELETE requests pass through directly.

---

## 4. Offline UX & Install Prompt

- **`OfflineBanner` (`src/components/website/pwa-components.tsx`):**
  Monitors browser `navigator.onLine` status and displays a non-intrusive status alert when connectivity is lost:
  > _"You are currently offline. Viewing cached catalogue. Real-time rates and enquiries will resume when connectivity returns."_
- **`PwaInstallPrompt` (`src/components/website/pwa-components.tsx`):**
  Captures the browser's `beforeinstallprompt` event and displays an elegant install invitation banner with "Install App" and "Later" options. Stores dismissal in `localStorage` to avoid repeatedly nagging the user.
- **Dedicated Offline Page (`/offline`):**
  Offers immediate offline guidance, displays direct emergency phone links (`tel:...`) that work natively on mobile devices without internet, and provides a "Try Reconnecting" button.
