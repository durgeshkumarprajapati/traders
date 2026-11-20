# Google Sheets setup guide

Google Sheets is the **only** source of truth for products, categories, brands and business settings (`PROJECT_BLUEPRINT.md` §14). Supabase never stores catalogue records.

## 1. One-time Google setup

1. Create (or reuse) a Google Cloud project and **enable the Google Sheets API**.
2. Create a **service account**; create a JSON key for it. Copy `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `private_key` → `GOOGLE_PRIVATE_KEY` (one line, `\n` escapes). Do not commit or share the JSON file.
3. Create one spreadsheet and **share it with the service-account e-mail**: _Viewer_ is enough for reading; _Editor_ is required for admin writes (Phase 9). Share with nobody else you do not want editing the catalogue.
4. Put the spreadsheet id in `GOOGLE_SHEET_ID`.
5. Import `docs/sheets-template/*.csv` into tabs named exactly `Products`, `Categories`, `Brands`, `BusinessSettings` (and optionally `PriceHistory`).
6. Run `npm run dev` and open `/dev/sheets` (development only) — it shows configuration status, record counts and every data issue.

## 2. Worksheets and columns

Columns are matched by **header name** (case-insensitive), so order does not matter and extra columns are ignored and preserved. All listed headers are required unless marked optional. Blank rows are skipped.

**Products**: `product_id, product_name, slug, sku, category_id, brand_id, description, specifications, image_url, price, unit, stock_status, is_featured, is_active, created_at, updated_at` + optional `unit_custom`.
**Categories**: `category_id, category_name, slug, description, image_url, display_order, is_active`.
**Brands**: `brand_id, brand_name, slug, logo_url, description, is_active`.
**BusinessSettings**: `setting_key, setting_value`.
**PriceHistory** (optional): `history_id, product_id, previous_price, new_price, updated_at, updated_by`.

### Value rules

| Column                     | Rule                                                                                                                                                                                          | If broken                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `*_id`                     | Required, unique, letters/digits/`_`/`-`, ≤ 64. **Stable — never reuse or renumber.** (Row numbers are never identifiers.)                                                                    | row excluded                                                               |
| `slug`                     | Required, unique per worksheet, lowercase letters/digits with single hyphens                                                                                                                  | row excluded                                                               |
| `sku`                      | Optional; unique when present (case-insensitive); letters/digits/`. _ / -`                                                                                                                    | row excluded (duplicates: **all** rows in the group)                       |
| `category_id`, `brand_id`  | Must match a valid category/brand; an **active** product may not use an **inactive** one                                                                                                      | row excluded                                                               |
| `unit`                     | One of `BAG, PIECE, KG, TON, METRIC_TON, CUBIC_FEET, CUBIC_METER, BUNDLE, BOX, METER, BRASS, BLOCK, CUSTOM`. `TON` ≠ `METRIC_TON`. Never converted.                                           | row excluded                                                               |
| `unit_custom`              | Required when `unit = CUSTOM` (the display label); must be empty otherwise. Needs the optional column.                                                                                        | row excluded                                                               |
| `stock_status`             | `IN_STOCK, LIMITED_STOCK, OUT_OF_STOCK, AVAILABLE_ON_ORDER`                                                                                                                                   | row excluded                                                               |
| `is_featured`, `is_active` | `TRUE`/`FALSE` (checkboxes work); `yes/no/1/0` accepted                                                                                                                                       | row excluded                                                               |
| `price`                    | Blank = no price ("Rate on request"). Otherwise a plain positive number (`385` or `385.50`) — no `₹`, no commas, no `/-`                                                                      | price dropped, product kept, **warning**; never 0                          |
| `specifications`           | Blank, or JSON `[{"label":"Grade","value":"43"}]`                                                                                                                                             | field dropped, warning                                                     |
| `image_url`, `logo_url`    | Blank or `https://` on an allowed host (`res.cloudinary.com`)                                                                                                                                 | field dropped, warning                                                     |
| `created_at`, `updated_at` | Blank or ISO date-time (`2026-11-18T10:30:00Z`) or a date cell                                                                                                                                | field dropped, warning                                                     |
| `display_order`            | Blank or whole number ≥ 0 (blank/invalid sorts last)                                                                                                                                          | warning                                                                    |
| BusinessSettings keys      | `business_name, tagline, logo_url, phone, whatsapp_number, email, address, business_hours, gst_number, google_maps_url, delivery_coverage, social_*, announcement_enabled, announcement_text` | invalid value ignored, warning; unknown key ignored; duplicate key ignored |

"50 kg Bag" is a pack description and "3m Length" a size — put them in `product_name` or `specifications`, **not** in `unit`.

## 3. How problems are reported

Every issue carries `worksheet`, `row` (sheet row number), `column`, `severity` and a message. **error** ⇒ the row is excluded from the site; **warning** ⇒ the row is kept with that field dropped. One bad row never affects the others. Structural problems (missing tab, blank tab, missing/duplicate headers, > 5000 rows) make the whole read fail with a clear message instead of silently showing an empty catalogue. A worksheet that has only its header row is a valid, empty catalogue.

## 4. Freshness and caching

Reads are cached in the platform's shared cache (`use cache: remote`): refreshed in the background after **5 minutes**, and never served past **30 minutes** (maximum acceptable staleness). Edits you make directly in the spreadsheet therefore appear within about 5 minutes (up to 30 if traffic is very low). Admin edits made through the app invalidate the cache immediately. If Google is unavailable the site shows "unavailable" — it never invents products or prices.

## 5. Limits and cautions

- One batched read per refresh (4 worksheets in 1 request) keeps usage far below Google's quota (60 reads/min/user); 429/5xx responses are retried with backoff.
- Worksheets are limited to **5000 data rows** and columns **A–Z**.
- Do not use formulas in columns the app writes (it writes only the cells it changes, but a formula cell it overwrites becomes a plain value). Formula-looking text typed through the app is stored as text.
- Sheets has no transactions or unique constraints: avoid editing the same row manually while an admin is saving it.
- **Backups:** use _File → Version history_ (name a version before bulk edits) and periodically _File → Download → .xlsx_ to a safe place. Restoring a version in Sheets is the rollback for data mistakes; the app picks it up within the cache window.

## 6. "Why Choose Us" content (BusinessSettings)

The homepage "Why Choose Us" section is read from `BusinessSettings` using up to **six** title/description pairs:

| setting_key                                                   | Limit     |
| ------------------------------------------------------------- | --------- |
| `why_choose_us_1_title` … `why_choose_us_6_title`             | 80 chars  |
| `why_choose_us_1_description` … `why_choose_us_6_description` | 300 chars |

A point is shown only when **both** its title and description are filled. A half-filled pair is skipped and reported as an `INVALID_SETTING` warning (with the row number). If no complete pair exists the whole section is hidden — the app never shows placeholder claims. `docs/sheets-template/BusinessSettings.csv` contains the 12 empty rows to paste in.

## 7. Live-connectivity status (read this before launch)

The Google Sheets integration (Phases 4–5) has **only been verified against mocks and fixtures**. No Google service-account credentials were available in the development environment, so **a real read from your spreadsheet has not been performed or confirmed**. Before launch the owner must:

1. complete section 1 (service account, share the spreadsheet, set the three `GOOGLE_*` variables);
2. open `/dev/sheets` on a **local** run (it returns 404 in production) and confirm the diagnostics report a successful read and show no unexpected issues;
3. load `/products` and a product page and compare them to the spreadsheet.

Until then, treat live Sheets integration as **unverified**. If configuration is missing or Google is unreachable, customer pages show an "unavailable" state instead of data.
