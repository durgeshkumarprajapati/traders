# Supabase setup (Phase 6 — enquiries)

> **Status:** the schema and every SQL function were executed against a real PostgreSQL 16 instance in the test-suite (`supabase/tests/*.sql`, run by `src/lib/supabase/migration.test.ts`). **A live Supabase project was never contacted** — no credentials were available. Row Level Security _enforcement_ could not be exercised either (the test instance runs as a superuser). Follow the verification steps at the end after applying the migration.

## 1. Create the project

1. Create a Supabase project (any region close to your customers).
2. Keep the database password in a password manager; it is not used by the app.
3. From **Project Settings → API** copy the **Project URL** and the **service_role** key.

## 2. Apply the migration

Apply `supabase/migrations/20261118000000_enquiries.sql` once, using either:

- **SQL editor:** paste the whole file into _SQL Editor → New query → Run_; or
- **Supabase CLI:** `supabase link --project-ref <ref>` then `supabase db push`.

It creates `enquiries`, `enquiry_items`, `enquiry_notes`, `notification_outbox`, `notification_attempts`, `rate_limits`, the reference sequence, and these functions: `create_enquiry`, `claim_notification`, `record_notification_attempt`, `list_due_notifications`, `retry_notification`, `check_rate_limit`, `purge_rate_limits`.

Security posture (all in the migration):

- RLS is **enabled on every table with no policies** (default deny); table privileges are revoked from `anon` and `authenticated`.
- Functions are `SECURITY DEFINER` with a fixed `search_path`, and `EXECUTE` is granted **only to `service_role`**.
- Therefore the public (anon) key can do nothing with these tables, and the browser never receives the service-role key.
- `admin_profiles` is **not** created: it belongs with admin authentication (Phase 7).

## 3. Configure the app

Set `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RATE_LIMIT_SECRET` (and optionally `WEB3FORMS_ACCESS_KEY`, `CRON_SECRET`) in `.env.local` and in Vercel. See `docs/ENVIRONMENT.md`. Never commit values; the service-role key bypasses RLS.

Recommended for now: in _Authentication → Providers_ disable **Email sign-ups** (no customer accounts exist; admin sign-in is Phase 7).

## 4. Verify (owner checklist — not yet done)

1. Submit a General enquiry on `/contact` → expect a reference like `ENQ-…`; confirm one row in `enquiries` and one `PENDING`/`SENT` row in `notification_outbox`.
2. Submit a Bulk enquiry with two products → confirm `enquiry_items` rows carry the product name, brand, unit and listed price from your sheet (and a blank price for price-on-request items — never 0).
3. In the SQL editor run `select has_function_privilege('anon','public.create_enquiry(jsonb)','execute');` → expect `false`. With the **anon** key, `select` from `enquiries` through the REST API must return an error or no rows.
4. Resubmit the same form after a network drop → still exactly one enquiry (idempotency key).
5. Disable `WEB3FORMS_ACCESS_KEY`, submit → enquiry saved, notification stays `PENDING`; restore the key and call the sweeper (below) → it becomes `SENT`.

## 5. Notification retries (operational)

No scheduler is configured by this repository (no `vercel.json`). Delivery is attempted:

1. right after the response (`after()`), then
2. opportunistically for up to 3 due notifications after each new submission, and
3. by `GET|POST /api/notifications/process` with `Authorization: Bearer $CRON_SECRET`.

To retry automatically, schedule that route (Vercel Cron — check your plan's cron frequency limits — or any external scheduler) every 5–15 minutes. Backoff starts at 60 s and doubles after each failed attempt, capped at 6 h; permanent errors stop retrying and stay `FAILED` (visible in the table). Manual retry: `select public.retry_notification('<outbox id>');` (refuses rows already `SENT`). An admin button arrives with Phase 9.
