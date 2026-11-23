# Request a callback

Status: implemented, unit tested (schema, server persistence, form behaviour); real-PostgreSQL tested for the transaction; **not browser-tested, not live-tested**.

## Where it appears

Site header (desktop bar and mobile menu), Contact page, product detail page. One reusable form (`callback-modal.tsx`).

## Fields

Required: name, 10-digit Indian mobile (same rule as the other forms). Optional: email, preferred date, preferred time (Morning / Afternoon / Evening / Any time — **no clock times are promised**; business hours come from Business Settings), reason (≤200), message (≤500). A hidden honeypot field is checked first.

## Server-side rules

- Same Zod + rate-limit + idempotency path as every public form (per-IP and per-mobile limits, fail-closed).
- **Preferred date** is validated in India time (IST): a real calendar date, **not in the past**, **within 30 days**. The browser's `min`/`max` use the same IST logic, so the check does not shift around midnight.
- The enquiry type stays **`GENERAL`** (no `CALLBACK` type). Structured details are stored in the related table `enquiry_callbacks` (date, time window, reason) and the customer's email in `enquiries.email`; a one-line readable summary is written to `enquiries.message` for the admin list.
- One transaction (`create_enquiry`) saves the enquiry, its first status-history row, the callback row and the notification-outbox row; a failure rolls everything back.
- Duplicate protection: the form creates **one idempotency key per form session** and reuses it after a failure, so a retry after a lost response can never create a second enquiry; the second click while sending is ignored.

## Customer experience

Success shows the reference, the **requested** date/time ("this is the time you asked for — not a confirmed appointment"), the private tracking link, and call/WhatsApp buttons **only when configured**. It never says a callback is scheduled or completed. On failure all typed values stay and a retry message is shown. Offline, nothing is sent and the form says so.

## Admin

Callback enquiries are flagged in the enquiry list and the detail page shows the requested date and time window and the reason, with the normal status workflow, internal notes and tracking-link controls. Internal notes are never visible to customers.

## Limits

No separate follow-up log exists (the existing internal notes serve that purpose). No SMS/WhatsApp message is sent automatically.
