# Enquiry tracking (no customer login)

Route: **`/track-enquiry`** · Status: implemented, unit + real-PostgreSQL tested; **not browser-tested, not live-tested** (see `PHASE_NEXT_REPORT.md`).

## How a customer gets access

After an enquiry is saved, the confirmation shows a private link:

```
/track-enquiry#ref=ENQ-7F3A-9C21-B8D4&token=tr_<64 hex characters>
```

- The credentials are in the URL **fragment** (after `#`). Browsers never send a fragment to the server, so the token does not appear in Vercel/CDN access logs or `Referer` headers. The page reads it in the browser. Old links of the form `?ref=…&token=…` still work once and are rewritten to the fragment form immediately.
- The confirmation says the link is shown once and that anyone holding it can view the enquiry. If it is lost, an administrator can issue a new one (below).
- A customer can also type the reference and token into the form on the page.
- **Not implemented / not claimed:** emailing the link to the customer, and OTP verification by mobile number — see "Blocked".

## Public reference

`ENQ-XXXX-XXXX-XXXX` (12 hex characters = 48 random bits) generated inside `create_enquiry` from `gen_random_uuid()` (PostgreSQL's cryptographic RNG) with a uniqueness check and retry. It contains no counter, so it reveals nothing about volume and cannot be enumerated by incrementing. The database `UNIQUE` constraint remains the final guard. Older enquiries keep their sequential `ENQ-YYYY-NNNNNN` references; both formats are accepted. **The reference is an identifier, not a credential** — the token is the credential, so guessing a reference gets nothing.

## Token

- `tr_` + 32 random bytes (hex). Only the **SHA-256 hash** is stored (`enquiries.tracking_token_hash`); the raw token exists only in the response that shows it and in the customer's link.
- At submission the token is `HMAC-SHA256(server secret, "tracking-token:v1:" + idempotency key)` so that a retried submission (same key, e.g. after a lost response) receives the **same** token whose hash is already stored. It cannot be derived without the server secret (`RATE_LIMIT_SECRET`, domain-separated so it never produces a value used for any other purpose). Admin-issued replacement tokens are purely random.
- **Expiry:** 90 days from issue. **Revocation:** admin "Revoke link". **Rotation:** admin "Rotate New Link" invalidates the old token and creates a new one.

## What the lookup does (`get_tracked_enquiry`, service-role only)

Requires **both** the reference and the token hash; fails identically (returns nothing) for unknown reference, wrong token, expired, or revoked. It returns only: reference, type, status, delivery location, dates, the status timeline, requested items (name, brand, unit, quantity, listed price) and the latest issued quotation summary. It never returns internal ids, contact details, internal notes, notification/outbox data, idempotency keys, or other enquiries. The TypeScript mapper additionally ignores any extra field (tested). Each verified lookup increments `tracking_view_count` / `tracking_last_viewed_at` for the admin and does **not** change `updated_at`.

## Abuse protection

- Reference/token shape is checked **before** the database is called.
- Rate limit: **20 lookups per 10 minutes per client IP** (IP stored only as a salted HMAC), shared with the quotation routes so alternating routes does not multiply guesses. Fails **closed** if the limiter store is unreachable.
- Messages are generic ("not found, or the link has expired or is invalid"); they never say which part was wrong.
- The page is served `Cache-Control: private, no-store`, `X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer`, excluded from `robots.txt`, and never cached by the service worker.

## Status timeline

Uses only the approved statuses (`NEW`, `CONTACTED`, `QUOTATION_SENT`, `CONFIRMED`, `COMPLETED`, `CANCELLED`). `enquiry_status_history` records previous status, new status, time, administrator and a **system-written** description (never an internal note). A row is written at creation, on every admin status change (with the real previous status) and when issuing a quotation moves the enquiry to `QUOTATION_SENT` (real previous status; no row if the status did not change). The progress bar is derived from the current status; dates are shown only where history rows exist. **Enquiries created before the history table existed have no history and show only verified information — no transitions are invented.**

## Admin

`/admin/enquiries/[id]` → "Customer Tracking Link": state (Active / Expired / Revoked / Not generated), expiry date, verified customer views and last view, rotate, revoke. The new link is shown once. The hash is never sent to the browser (only a boolean).

## Blocked / not implemented

| Item                                        | Why                                                                                                                                                                                                                                                               |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email the tracking link to the customer     | The configured provider (Web3Forms) sends only to the inbox that owns the access key; its API has no per-request recipient. Its customer auto-reply is a paid (Pro) feature. A server-side transactional provider needs an owner decision (see `EMAIL_SETUP.md`). |
| Notify the customer when the status changes | Same reason; no customer-capable notification channel is configured.                                                                                                                                                                                              |
| OTP by mobile number                        | No SMS provider is configured. Not built; no OTP code path exists.                                                                                                                                                                                                |
