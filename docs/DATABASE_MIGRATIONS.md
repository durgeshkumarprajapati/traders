# Database migrations

All migrations are **forward-only** and live in `supabase/migrations/`. Applied migrations are never edited; changes arrive as a new file.

| File                                                 | Adds                                                                                                                                                                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `20261118000000_enquiries.sql`                       | `enquiries`, `enquiry_items`, `enquiry_notes`, `notification_outbox`, `notification_attempts`, `rate_limits`, `create_enquiry` and the outbox / rate-limit functions; RLS on, no policies, service-role only |
| `20261120000000_admin_auth.sql`                      | `admin_profiles`, `is_admin()`, admin RLS policies                                                                                                                                                           |
| `20261123000000_customer_features.sql`               | tracking-token columns on `enquiries`, `enquiry_status_history`, `enquiry_callbacks`, `quotations`, `quotation_items`, `get_tracked_enquiry`, `get_tracked_quotation`; `create_enquiry` extended             |
| **`20261124000000_customer_features_hardening.sql`** | **this phase's corrections** — see below                                                                                                                                                                     |

## What `20261124000000` does

1. **Random public enquiry reference** — `create_enquiry` (replaced with `create or replace`, same signature and grants) now generates `ENQ-XXXX-XXXX-XXXX` from `gen_random_uuid()` with a uniqueness retry. Existing rows are untouched.
2. **Atomic admin quotation functions** — `create_quotation_draft`, `issue_quotation`, `rotate_quotation_token`, `revoke_quotation_token`. `SECURITY DEFINER`, fixed `search_path`, each begins with `if not public.is_admin() then raise …`; `EXECUTE` revoked from `public`/`anon`, granted to `authenticated`. Totals are computed in SQL.
3. **Immutability triggers** on `quotations` and `quotation_items` (no change/delete/return-to-draft once issued).
4. **Integrity constraints** (`NOT VALID`, so they apply to every new/updated row without rescanning or failing on any pre-existing row): `quotations_total_consistent`, `quotation_items_line_total_consistent`.
5. **Audit counters**: `enquiries.tracking_view_count / tracking_last_viewed_at`, `quotations.view_count / last_viewed_at`.
6. `get_tracked_enquiry` / `get_tracked_quotation` replaced (same grants: **service_role only**): the quotation lookup also accepts the enquiry token (latest issued version) and returns `is_latest` / `is_expired`.
7. `set_updated_at()` no longer bumps `updated_at` when only the view counters change.

## Row Level Security summary

| Object                                                                       | anon                    | authenticated (non-admin)                                   | authenticated admin                   | service_role       |
| ---------------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------- | ------------------------------------- | ------------------ |
| Every enquiry / quotation / callback / history table                         | no privileges (revoked) | RLS: no matching policy → nothing                           | RLS policy `is_admin()` → full access | full (server only) |
| `get_tracked_*`, `create_enquiry`, outbox / rate-limit functions             | no execute              | no execute                                                  | no execute                            | execute            |
| `create_quotation_draft`, `issue_quotation`, `rotate/revoke_quotation_token` | no execute              | execute, but **refused** by the internal `is_admin()` check | allowed                               | not used           |

Customers have **no direct database access at all**: every public read or write goes through a Next.js Server Action / route handler that validates input, rate-limits, and calls one narrowly scoped function with the service-role key (server-only).

## How to apply (owner) — NOT yet applied to any live database by the developer

1. Back up: Supabase Dashboard → Database → Backups (or `pg_dump`).
2. Apply **in order**, skipping files already applied: SQL Editor → paste `20261124000000_customer_features_hardening.sql` → Run; **or** `supabase link --project-ref <ref>` then `supabase db push`.
3. Verify (SQL Editor):

```sql
select proname from pg_proc where proname in ('create_quotation_draft','issue_quotation','rotate_quotation_token','revoke_quotation_token');            -- 4 rows
select tgname from pg_trigger where tgname in ('quotations_immutable','quotation_items_immutable');                                                      -- 2 rows
select has_function_privilege('anon','public.get_tracked_enquiry(text,text)','execute');                                                                 -- false
select has_function_privilege('anon','public.create_quotation_draft(jsonb)','execute');                                                                  -- false
select conname from pg_constraint where conname in ('quotations_total_consistent','quotation_items_line_total_consistent');                              -- 2 rows
```

4. Create a test enquiry on the site: its reference should look like `ENQ-1A2B-3C4D-5E6F`.

## Test evidence

`src/lib/supabase/migration.test.ts` runs **all four migrations and the self-asserting SQL files** (`supabase/tests/0*.sql`) on a throwaway **PostgreSQL 16** (single-user mode) — random references, the admin gate, exact arithmetic, atomic rejection (no partial rows), issue / supersede with the real previous status, immutability (update / insert / delete / return-to-draft), token rotation and revocation, expiry, view auditing, `updated_at` preservation, and function privileges. **Limitation:** single-user mode runs as a superuser, so **RLS policy enforcement itself is not exercised** — only the privilege grants, the `is_admin()` function gate, triggers and constraints are. Verify RLS on the real project with the anon key (see `SUPABASE_SETUP.md`).

## Rollback / recovery

The migration only adds objects and replaces functions; no data is rewritten. To undo (only if no quotation has been issued under the new rules):

```sql
drop trigger if exists quotations_immutable on public.quotations;
drop trigger if exists quotation_items_immutable on public.quotation_items;
drop function if exists public.quotations_guard(), public.quotation_items_guard();
drop function if exists public.create_quotation_draft(jsonb), public.issue_quotation(uuid, text, timestamptz),
  public.rotate_quotation_token(uuid, text, timestamptz), public.revoke_quotation_token(uuid);
alter table public.quotations drop constraint if exists quotations_total_consistent;
alter table public.quotation_items drop constraint if exists quotation_items_line_total_consistent;
```

Then re-run the `create or replace function` statements for `create_enquiry`, `get_tracked_enquiry`, `get_tracked_quotation` and `set_updated_at` from the earlier migration files to restore their previous definitions. The added columns are harmless and may stay. The application code of this phase requires the migration: **deploy the migration first, then the code.**
