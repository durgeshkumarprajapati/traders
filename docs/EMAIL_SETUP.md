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
3. If sending fails, it is retried with backoff by the sweeper (`/api/notifications/process`, scheduled in `vercel.json` every 10 minutes) and can be retried by hand from the admin enquiry page ("Retry Email Notification"). The admin page shows the last error.
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
- **Vercel Cron frequency:** `*/10 * * * *` requires a paid Vercel plan; Hobby allows only daily cron. On Hobby, change the schedule to once a day or use an external scheduler — otherwise the deployment can be rejected.
- Delivery is at-least-once: a rare duplicate email is possible if the result of a successful send could not be recorded.
