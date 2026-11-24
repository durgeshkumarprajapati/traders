# Enquiry email — setup and verification

There are two independent email paths. Neither claims delivery it cannot prove.

## 1. "Send list by email" / "Email enquiry" buttons (customer's email app)

- Work like the WhatsApp buttons: they open the customer's own email app with the enquiry prefilled (`mailto:`). The customer must press Send. **No server, no database record, no key needed.**
- The recipient is the **business email in Business Settings** (`email` row in the Google Sheet). With no valid address the buttons are simply hidden — nothing is invented.
- Shown on `/bulk-enquiry` (list from the server catalogue) and on every product page (product, quantity, location).
- Limit: a `mailto:` link needs an email app on the customer's device (normal on phones, not guaranteed on desktops), and its body is capped at 1000 characters.

## 2. "Submit enquiry" → saved in Supabase → email to the shop (Web3Forms)

1. The enquiry is saved first (so it is never lost), with an outbox row.
2. Right after the response the server sends **one** email through Web3Forms using `WEB3FORMS_ACCESS_KEY`.
3. If sending fails, it is retried with backoff by the sweeper (`/api/notifications/process`, scheduled in `vercel.json` once a day at 03:00 UTC, because Vercel Hobby only allows daily crons) and can be retried by hand from the admin enquiry page ("Retry Email Notification"). The admin page shows the last error.
4. **Who receives it:** the inbox that owns the Web3Forms access key. Customers do not receive a copy.

### Prove it works (owner, once, after deploying)

```bash
curl -X POST https://<your-site>/api/notifications/test \
  -H "Authorization: Bearer $CRON_SECRET"
```

- `{"ok":true,...}` → Web3Forms accepted a real test email; confirm it arrives (check spam).
- `{"ok":false,"hint":"..."}` → the hint says what to fix (wrong key, plan restriction, network). The response never contains the key or secrets.
- `503 EMAIL_NOT_CONFIGURED` → `WEB3FORMS_ACCESS_KEY` is missing/malformed. `503 NOT_CONFIGURED` → `CRON_SECRET` is not set (≥ 16 chars). `401` → wrong token.
- The route is POST-only, so visiting it in a browser can never send mail.

Then submit a real enquiry on the site and confirm (a) it appears in `/admin/enquiries`, (b) the email arrives, (c) the admin page shows the notification as `SENT`.

### Known risks (honest list)

- **Web3Forms plan:** Web3Forms may block server-side (API) submissions on its free plan. If the test returns HTTP 403/401, confirm with Web3Forms; the fix is a paid plan or another provider. This was **never verified live** by the developer (no credentials in the build environment).
- **Vercel Cron frequency:** the sweeper runs daily (`0 3 * * *`) so the project deploys on Vercel Hobby. Emails are sent immediately after an enquiry is saved; the sweeper is only a retry safety net, so a failed email can wait up to a day (or be retried by hand from the admin enquiry page). On a Pro plan you may change it to `*/10 * * * *`.
- Delivery is at-least-once: a rare duplicate email is possible if the result of a successful send could not be recorded.

## Verified provider limits (read this before relying on email)

Checked against Web3Forms' public documentation (pricing page returned HTTP 403, so plan prices and monthly limits are **not verified**):

- **Server-side use:** the API reference states _"Server side usage requires paid plan + server IP whitelisting."_ This application sends from a server (Vercel). The free plan is therefore **not expected to work**, and a paid plan would also need the sending IP addresses whitelisted — which is impractical on Vercel, whose outbound addresses are not fixed.
- **Recipients:** mail goes only to the inbox that owns the access key; there is **no per-request recipient**. The application therefore **cannot** email a customer (tracking link, quotation, status update) through this provider.
- **Customer auto-reply** is a paid (Pro) browser-form feature using the `email` field; it is not a general sending API.

**Consequence:** the owner-notification email is unverified and may never deliver on the free plan. Everything customer-facing that needs email (tracking-link email, status-change email, quotation email) is **not implemented** — those parts are blocked, not faked. Enquiries themselves are always saved first, so nothing is lost.

**Recommended decision (needs owner approval; nothing was changed or purchased):** replace the Web3Forms adapter with a server-side transactional email provider that can send to arbitrary recipients. The architecture already isolates the provider behind `src/lib/email/web3forms.ts` and the Supabase outbox (retries, attempts, idempotency), so only the adapter, one environment variable and the outbox `recipient/kind` need to change. Until then the admin can share tracking and quotation links by WhatsApp or by their own email app (the admin screen offers both).
