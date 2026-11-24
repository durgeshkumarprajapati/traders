-- Sagar Traders — Phase 13: rate-alert foundation (subscriptions, daily price snapshots, notification queue).
-- Forward-only. NOT applied automatically. Customer-facing subscription stays DISABLED in the application until the owner approves
-- a verified transactional email provider (Web3Forms is a contact-form relay and cannot email customers). Prices are stored as integer
-- paise (bigint) so comparisons are exact. Authoring rule for the test harness: top-level statements are separated by blank lines and
-- there are NO blank lines inside function bodies.

create table public.rate_alert_subscriptions (
  id uuid primary key,
  product_id text not null check (product_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  email text not null check (email = lower(email) and char_length(email) between 5 and 254 and email !~ '\s'),
  alert_type text not null check (alert_type in ('ANY_CHANGE', 'DROPS_BELOW')),
  target_price_paise bigint check (target_price_paise is null or target_price_paise > 0),
  status text not null default 'PENDING' check (status in ('PENDING', 'ACTIVE', 'UNSUBSCRIBED')),
  consent_text text not null check (char_length(consent_text) between 10 and 500),
  consented_at timestamptz not null default now(),
  confirm_token_hash text unique,
  unsubscribe_token_hash text not null unique,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  last_notified_price_paise bigint,
  created_at timestamptz not null default now(),
  check ((alert_type = 'DROPS_BELOW') = (target_price_paise is not null))
);

-- One live (pending or active) subscription per product and email.
create unique index rate_alert_subscriptions_live_idx on public.rate_alert_subscriptions (product_id, email) where status <> 'UNSUBSCRIBED';

create index rate_alert_subscriptions_status_idx on public.rate_alert_subscriptions (status, product_id);

create table public.product_price_snapshots (
  product_id text not null check (product_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  captured_on date not null,
  price_paise bigint not null check (price_paise > 0),
  primary key (product_id, captured_on)
);

create table public.rate_alert_notifications (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.rate_alert_subscriptions (id) on delete cascade,
  snapshot_date date not null,
  price_from_paise bigint,
  price_to_paise bigint not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'SENT', 'FAILED')),
  attempts integer not null default 0,
  last_error text check (last_error is null or char_length(last_error) <= 300),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  -- Idempotency: running the detector twice for the same day never queues a second email.
  unique (subscription_id, snapshot_date)
);

create index rate_alert_notifications_status_idx on public.rate_alert_notifications (status, created_at);

alter table public.rate_alert_subscriptions enable row level security;

alter table public.product_price_snapshots enable row level security;

alter table public.rate_alert_notifications enable row level security;

revoke all on table public.rate_alert_subscriptions, public.product_price_snapshots, public.rate_alert_notifications from public, anon, authenticated;

grant all on table public.rate_alert_subscriptions, public.product_price_snapshots, public.rate_alert_notifications to service_role;

-- Administrators may read (never the token hashes) through RLS; every write goes through the SECURITY DEFINER functions below.
grant select (id, product_id, email, alert_type, target_price_paise, status, consented_at, confirmed_at, unsubscribed_at, last_notified_price_paise, created_at) on table public.rate_alert_subscriptions to authenticated;

grant select on table public.product_price_snapshots, public.rate_alert_notifications to authenticated;

create policy admin_rate_alert_subscriptions_read on public.rate_alert_subscriptions for select to authenticated using (public.is_admin());

create policy admin_product_price_snapshots_read on public.product_price_snapshots for select to authenticated using (public.is_admin());

create policy admin_rate_alert_notifications_read on public.rate_alert_notifications for select to authenticated using (public.is_admin());

-- Creates a PENDING subscription (consent recorded). Returns {created:false} for an existing live one so the caller can answer identically.
create function public.subscribe_rate_alert(p_id uuid, p_product_id text, p_email text, p_alert_type text, p_target_price_paise bigint, p_consent_text text, p_confirm_hash text, p_unsubscribe_hash text) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if exists (select 1 from rate_alert_subscriptions where product_id = p_product_id and email = lower(p_email) and status <> 'UNSUBSCRIBED') then
    return jsonb_build_object('created', false);
  end if;
  insert into rate_alert_subscriptions (id, product_id, email, alert_type, target_price_paise, consent_text, confirm_token_hash, unsubscribe_token_hash) values (p_id, p_product_id, lower(p_email), p_alert_type, p_target_price_paise, p_consent_text, p_confirm_hash, p_unsubscribe_hash);
  return jsonb_build_object('created', true);
end $$;

-- Double opt-in: only the emailed token activates a subscription. The token is single-use.
create function public.confirm_rate_alert(p_confirm_hash text) returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_n integer;
begin
  update rate_alert_subscriptions set status = 'ACTIVE', confirmed_at = now(), confirm_token_hash = null where confirm_token_hash = p_confirm_hash and status = 'PENDING';
  get diagnostics v_n = row_count;
  return v_n = 1;
end $$;

-- Idempotent: unsubscribing twice is not an error. Returns whether the token matched a subscription.
create function public.unsubscribe_rate_alert(p_unsubscribe_hash text) returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_found boolean;
begin
  select true into v_found from rate_alert_subscriptions where unsubscribe_token_hash = p_unsubscribe_hash;
  update rate_alert_subscriptions set status = 'UNSUBSCRIBED', unsubscribed_at = coalesce(unsubscribed_at, now()), confirm_token_hash = null where unsubscribe_token_hash = p_unsubscribe_hash and status <> 'UNSUBSCRIBED';
  return coalesce(v_found, false);
end $$;

-- Stores today's authoritative prices (from the Google Sheet). p_prices = [{"product_id": "...", "price_paise": 12345}, ...]. Re-running is a no-op.
create function public.record_price_snapshots(p_date date, p_prices jsonb) returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_n integer;
begin
  if jsonb_typeof(p_prices) <> 'array' or jsonb_array_length(p_prices) > 5000 then
    raise exception 'invalid prices' using errcode = '22023';
  end if;
  insert into product_price_snapshots (product_id, captured_on, price_paise) select e->>'product_id', p_date, (e->>'price_paise')::bigint from jsonb_array_elements(p_prices) e on conflict (product_id, captured_on) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Compares today's snapshot with the previous one (exact integers) and queues ONE notification per subscription per day.
-- ANY_CHANGE: price differs from the last snapshot before today. DROPS_BELOW: price <= target and not already notified at this price.
create function public.queue_rate_alert_notifications(p_date date) returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_n integer;
begin
  insert into rate_alert_notifications (subscription_id, snapshot_date, price_from_paise, price_to_paise)
  select s.id, p_date, prev.price_paise, cur.price_paise
  from rate_alert_subscriptions s
  join product_price_snapshots cur on cur.product_id = s.product_id and cur.captured_on = p_date
  left join lateral (select price_paise from product_price_snapshots x where x.product_id = s.product_id and x.captured_on < p_date order by x.captured_on desc limit 1) prev on true
  where s.status = 'ACTIVE'
    and ((s.alert_type = 'ANY_CHANGE' and prev.price_paise is not null and prev.price_paise <> cur.price_paise)
      or (s.alert_type = 'DROPS_BELOW' and cur.price_paise <= s.target_price_paise and s.last_notified_price_paise is distinct from cur.price_paise))
  on conflict (subscription_id, snapshot_date) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Pending (or retryable failed) notifications with what the email needs. Capped at 5 attempts.
create function public.list_rate_alerts_due(p_limit integer) returns table (id uuid, subscription_id uuid, email text, product_id text, price_from_paise bigint, price_to_paise bigint, attempts integer) language sql security definer set search_path = public, pg_temp as $$
  select n.id, n.subscription_id, s.email, s.product_id, n.price_from_paise, n.price_to_paise, n.attempts from rate_alert_notifications n join rate_alert_subscriptions s on s.id = n.subscription_id where n.status in ('PENDING', 'FAILED') and n.attempts < 5 and s.status = 'ACTIVE' order by n.created_at limit greatest(least(p_limit, 100), 1);
$$;

create function public.record_rate_alert_result(p_id uuid, p_sent boolean, p_error text) returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_sent then
    update rate_alert_notifications set status = 'SENT', attempts = attempts + 1, sent_at = now(), last_error = null where id = p_id and status <> 'SENT';
    update rate_alert_subscriptions set last_notified_price_paise = (select price_to_paise from rate_alert_notifications where id = p_id) where id = (select subscription_id from rate_alert_notifications where id = p_id);
  else
    update rate_alert_notifications set status = 'FAILED', attempts = attempts + 1, last_error = left(coalesce(p_error, 'unknown'), 300) where id = p_id and status <> 'SENT';
  end if;
end $$;

revoke all on function public.subscribe_rate_alert(uuid, text, text, text, bigint, text, text, text), public.confirm_rate_alert(text), public.unsubscribe_rate_alert(text), public.record_price_snapshots(date, jsonb), public.queue_rate_alert_notifications(date), public.list_rate_alerts_due(integer), public.record_rate_alert_result(uuid, boolean, text) from public, anon, authenticated;

grant execute on function public.subscribe_rate_alert(uuid, text, text, text, bigint, text, text, text), public.confirm_rate_alert(text), public.unsubscribe_rate_alert(text), public.record_price_snapshots(date, jsonb), public.queue_rate_alert_notifications(date), public.list_rate_alerts_due(integer), public.record_rate_alert_result(uuid, boolean, text) to service_role;
