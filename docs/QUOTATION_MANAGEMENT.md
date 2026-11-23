# Digital quotations

Status: implemented; unit tested (server logic, arithmetic, PDF, admin UI, customer view) and **tested against a real PostgreSQL 16** for atomicity, immutability, versioning and access control. **Not browser-tested, not live-tested, no email delivery.**

## Lifecycle

`DRAFT` → `ISSUED` → (`REVISED` when a newer version is issued) — plus `EXPIRED / ACCEPTED / REJECTED`, reserved: nothing sets them automatically today (expiry is _derived_ from `valid_until`, so no job is needed).

1. **New quotation** (admin, from the enquiry page): lines pre-filled from the enquiry's items (catalogue-backed lines are read-only; manual lines can be added), a **quoted rate per line (required, > 0)**, discount, an optional **tax amount**, validity in days (**1–90, required, no default**) and optional terms (**no default text**).
2. **Preview PDF** (admin-only endpoint) — drafts are stamped "DRAFT – NOT ISSUED".
3. **Issue** (asks for confirmation): in **one transaction** the draft becomes `ISSUED`, earlier issued versions become `REVISED`, a random access link is created, and the enquiry moves to `QUOTATION_SENT` **only if it was `NEW` or `CONTACTED`** (history records the _real_ previous status; other statuses are left alone).
4. **Revise**: creates a new draft (next version) pre-filled from any version; issuing it supersedes the previous one.

## Money

Done with exact arithmetic — never floating point. The **database** computes line totals (`round(quantity × rate, 2)`), subtotal and total inside the same transaction; the browser sends no totals (any it sent would be ignored). The TypeScript preview uses integer paise and BigInt, round-half-up, matching PostgreSQL; a mismatch is logged. Constraints enforce `total = subtotal − discount + tax`, `discount ≤ subtotal`, `line = round(qty × rate, 2)`.

**Tax is an amount entered by the administrator.** The system applies **no tax rate and assumes no tax applicability** (none is configured). GSTIN appears on documents only if it is set in Business Settings.

## Immutability and history (enforced by database triggers)

Once `ISSUED` the reference, enquiry, version, customer snapshot, amounts, terms, validity and issue time **cannot be changed**, line items **cannot be added/edited/removed**, the quotation **cannot be deleted** or returned to draft — even by an administrator or a direct SQL client using the app's roles. Only the access-link columns and the status transitions needed for supersession can change. Customer name/contact are **snapshots** taken when the draft is created.

## Customer access

- `/quotation/<token>` and `/api/quotation/<token>/pdf`. The token is `qt_` + 32 random bytes; only its SHA-256 hash is stored.
- The enquiry's own tracking link also opens the **latest issued** quotation (the tracking page's "View quotation" button uses this).
- **Expiry** 90 days from issue; **revoke** and **rotate** from the admin page (the new link is shown once). Rotating/revoking the enquiry link stops the enquiry-link route too.
- Unknown / expired / revoked tokens are indistinguishable (404). **Rate limited** (shared tracking budget: 20 per 10 min per IP, fail-closed). Responses are `private, no-store`, `noindex`, `no-referrer`; never cached by the service worker.
- An **older version** keeps working but is labelled _Superseded_ (page and PDF) and says a newer version exists. An **expired** quotation (past `valid_until`) is labelled _Expired_. Each customer view is counted for the admin.

## What the customer / PDF shows

Only configured facts: business name, tagline, address, phone, email and GSTIN **from Business Settings**, each omitted if not set. There are **no bank details, payment instructions, delivery promises or warranty text** anywhere — none exist in the configured data. Terms appear only if the administrator typed them for that quotation. Previous builds shipped hard-coded address/bank/GSTIN placeholders in the PDF and page; they were removed.

## PDF (`features/quotations/server/pdf.ts`)

A dependency-free PDF 1.4 generator: A4, multi-page with the table header repeated and "Page n of N", wrapped (never truncated) descriptions, correct cross-reference offsets. **Limitation:** it uses the standard Helvetica font (Latin-1/WinAnsi), so non-Latin scripts (e.g. Devanagari names) print as `?` in the PDF; the on-screen quotation shows them correctly. Embedding a font would remove this and is the recommended follow-up. Generated from the stored snapshot only.

## Sharing

- **Download PDF** and **Copy link** (customer page and admin).
- **WhatsApp**: opens WhatsApp with an encoded message and the link; **nothing is sent by the website** and delivery is not tracked.
- **Email**: the admin gets an "Email customer (opens your email app)" link (`mailto:`) when the enquiry has an email. **The website does not send quotation emails.** Distinguishing queued / attempted / accepted / failed / delivered requires a server-side provider that can email arbitrary recipients; the configured provider cannot (see `EMAIL_SETUP.md`). No fake status is shown.

## Admin access control

Every admin action runs inside `withAdminAction` (server-side session + active-admin check) **and** the database functions re-check `is_admin()`, so a forged request from an anonymous or non-admin session is refused twice. Admin PDF requires the admin session.
