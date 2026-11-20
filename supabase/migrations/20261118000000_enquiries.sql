-- Sagar Traders — Phase 6: enquiries, item snapshots, notes, notification outbox + attempts, rate limits.
-- Applies to Supabase (PostgreSQL 15+). Authoring rule for the test harness: top-level statements are
-- separated by blank lines and there are NO blank lines inside function bodies.

create sequence public.enquiry_reference_seq as bigint minvalue 1 start 1000;

create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  type text not null check (type in ('BULK', 'GENERAL')),
  status text not null default 'NEW' check (status in ('NEW', 'CONTACTED', 'QUOTATION_SENT', 'CONFIRMED', 'COMPLETED', 'CANCELLED')),
  customer_name text not null check (char_length(customer_name) between 2 and 100),
  -- Provisional rule (owner to confirm): 10-digit Indian mobile, stored normalised without country code.
  mobile text not null check (mobile ~ '^[6-9][0-9]{9}$'),
  email text check (email is null or (char_length(email) <= 254 and position('@' in email) > 1)),
  delivery_location text check (delivery_location is null or char_length(delivery_location) between 3 and 300),
  message text check (message is null or char_length(message) <= 1000),
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint enquiries_bulk_needs_location check (type <> 'BULK' or delivery_location is not null),
  constraint enquiries_general_needs_message check (type <> 'GENERAL' or (message is not null and char_length(message) >= 10))
);

create index enquiries_status_created_idx on public.enquiries (status, created_at desc);

create index enquiries_created_idx on public.enquiries (created_at desc);

create index enquiries_mobile_idx on public.enquiries (mobile);

create index enquiries_customer_name_idx on public.enquiries (lower(customer_name));

-- Item snapshots: what the customer asked for, frozen from the AUTHORITATIVE server-side catalogue at submission time.
-- product_id is a plain reference value (the catalogue lives in Google Sheets; there is no foreign key to it).
create table public.enquiry_items (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.enquiries (id) on delete cascade,
  position smallint not null check (position >= 1),
  product_id text not null check (char_length(product_id) between 1 and 64),
  sku text check (sku is null or char_length(sku) <= 64),
  product_name text not null check (char_length(product_name) between 1 and 200),
  brand_name text check (brand_name is null or char_length(brand_name) <= 100),
  unit_code text not null check (unit_code in ('BAG', 'PIECE', 'KG', 'TON', 'METRIC_TON', 'CUBIC_FEET', 'CUBIC_METER', 'BUNDLE', 'BOX', 'METER', 'BRASS', 'BLOCK', 'CUSTOM')),
  unit_label text not null check (char_length(unit_label) between 1 and 40),
  quantity numeric(12, 3) not null check (quantity > 0 and quantity <= 1000000),
  -- NULL means "no valid listed price" (never converted to 0).
  listed_price numeric(14, 2) check (listed_price is null or listed_price > 0),
  stock_status text not null check (stock_status in ('IN_STOCK', 'LIMITED_STOCK', 'OUT_OF_STOCK', 'AVAILABLE_ON_ORDER')),
  created_at timestamptz not null default now(),
  unique (enquiry_id, position),
  unique (enquiry_id, product_id)
);

create index enquiry_items_enquiry_idx on public.enquiry_items (enquiry_id);

-- Internal notes (written by the administrator in Phase 9). author_id = the Supabase Auth user; admin_profiles arrives with Phase 7.
create table public.enquiry_notes (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.enquiries (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete restrict,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index enquiry_notes_enquiry_idx on public.enquiry_notes (enquiry_id, created_at);

-- Durable outbox: one row per notification to deliver. State lives here; every attempt is also logged in notification_attempts.
create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.enquiries (id) on delete cascade,
  channel text not null default 'EMAIL' check (channel in ('EMAIL')),
  kind text not null default 'ENQUIRY_RECEIVED' check (kind in ('ENQUIRY_RECEIVED')),
  status text not null default 'PENDING' check (status in ('PENDING', 'IN_PROGRESS', 'SENT', 'FAILED')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 8 check (max_attempts between 1 and 50),
  -- 'infinity' = never retried automatically (permanent failure); a manual retry resets it.
  next_attempt_at timestamptz not null default now(),
  -- Claim lease: while in the future, nobody else may attempt this row.
  locked_until timestamptz,
  last_error text check (last_error is null or char_length(last_error) <= 300),
  sent_at timestamptz,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enquiry_id, channel, kind)
);

create index notification_outbox_due_idx on public.notification_outbox (next_attempt_at) where status in ('PENDING', 'FAILED', 'IN_PROGRESS');

create table public.notification_attempts (
  id uuid primary key default gen_random_uuid(),
  outbox_id uuid not null references public.notification_outbox (id) on delete cascade,
  attempt_number integer not null check (attempt_number >= 1),
  outcome text not null check (outcome in ('SUCCESS', 'FAILURE', 'TIMEOUT')),
  http_status integer,
  error_code text check (error_code is null or char_length(error_code) <= 60),
  error_summary text check (error_summary is null or char_length(error_summary) <= 300),
  created_at timestamptz not null default now(),
  unique (outbox_id, attempt_number)
);

-- Shared fixed-window rate limiter (works across serverless instances because the state is in the database).
-- `key` holds an HMAC of the client identifier, never a raw IP address or phone number.
create table public.rate_limits (
  key text primary key check (char_length(key) between 1 and 200),
  window_start timestamptz not null,
  hits integer not null check (hits >= 0)
);

create function public.set_updated_at() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger enquiries_set_updated_at before update on public.enquiries for each row execute function public.set_updated_at();

create trigger notification_outbox_set_updated_at before update on public.notification_outbox for each row execute function public.set_updated_at();

-- ── create_enquiry: ONE transaction for enquiry + item snapshots + outbox row (idempotent per idempotency_key) ──
create function public.create_enquiry(p_payload jsonb) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_key uuid := (p_payload->>'idempotency_key')::uuid;
  v_type text := p_payload->>'type';
  v_id uuid;
  v_ref text;
  v_outbox uuid;
  v_item jsonb;
  v_pos integer := 0;
  v_existing record;
begin
  select e.id, e.reference, o.id as outbox_id into v_existing from enquiries e left join notification_outbox o on o.enquiry_id = e.id where e.idempotency_key = v_key;
  if found then
    return jsonb_build_object('id', v_existing.id, 'reference', v_existing.reference, 'outbox_id', v_existing.outbox_id, 'duplicate', true);
  end if;
  v_ref := 'ENQ-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY') || '-' || lpad(nextval('enquiry_reference_seq')::text, 6, '0');
  insert into enquiries (reference, type, customer_name, mobile, email, delivery_location, message, idempotency_key)
  values (v_ref, v_type, p_payload->>'name', p_payload->>'mobile', nullif(p_payload->>'email', ''), nullif(p_payload->>'delivery_location', ''), nullif(p_payload->>'message', ''), v_key)
  returning id into v_id;
  for v_item in select value from jsonb_array_elements(coalesce(p_payload->'items', '[]'::jsonb)) loop
    v_pos := v_pos + 1;
    insert into enquiry_items (enquiry_id, position, product_id, sku, product_name, brand_name, unit_code, unit_label, quantity, listed_price, stock_status)
    values (v_id, v_pos, v_item->>'product_id', nullif(v_item->>'sku', ''), v_item->>'product_name', nullif(v_item->>'brand_name', ''), v_item->>'unit_code', v_item->>'unit_label', (v_item->>'quantity')::numeric, (v_item->>'listed_price')::numeric, v_item->>'stock_status');
  end loop;
  if v_type = 'BULK' and v_pos = 0 then
    raise exception 'a BULK enquiry needs at least one item' using errcode = '23514';
  end if;
  insert into notification_outbox (enquiry_id, idempotency_key) values (v_id, 'enquiry:' || v_id::text || ':email:received') returning id into v_outbox;
  return jsonb_build_object('id', v_id, 'reference', v_ref, 'outbox_id', v_outbox, 'duplicate', false);
exception when unique_violation then
  -- Concurrent submission with the same idempotency key: return the winner's enquiry. Any other unique violation is a real error.
  select e.id, e.reference, o.id as outbox_id into v_existing from enquiries e left join notification_outbox o on o.enquiry_id = e.id where e.idempotency_key = v_key;
  if found then
    return jsonb_build_object('id', v_existing.id, 'reference', v_existing.reference, 'outbox_id', v_existing.outbox_id, 'duplicate', true);
  end if;
  raise;
end $$;

-- ── claim_notification: atomically take a lease on one due outbox row; returns the data needed for the email, or null ──
create function public.claim_notification(p_outbox_id uuid, p_lease_seconds integer default 120) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v notification_outbox%rowtype;
begin
  update notification_outbox o
     set status = 'IN_PROGRESS', attempt_count = o.attempt_count + 1, locked_until = now() + make_interval(secs => greatest(p_lease_seconds, 5))
   where o.id = p_outbox_id
     and o.status in ('PENDING', 'FAILED', 'IN_PROGRESS')
     and o.attempt_count < o.max_attempts
     and o.next_attempt_at <= now()
     and (o.locked_until is null or o.locked_until <= now())
  returning o.* into v;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'outbox_id', v.id,
    'attempt_number', v.attempt_count,
    'enquiry', (select to_jsonb(e) - 'idempotency_key' from enquiries e where e.id = v.enquiry_id),
    'items', (select coalesce(jsonb_agg(to_jsonb(i) order by i.position), '[]'::jsonb) from enquiry_items i where i.enquiry_id = v.enquiry_id)
  );
end $$;

-- ── record_notification_attempt: log the attempt and move the outbox row to SENT / FAILED (only for the lease holder) ──
create function public.record_notification_attempt(p_outbox_id uuid, p_attempt_number integer, p_outcome text, p_http_status integer default null, p_error_code text default null, p_error_summary text default null, p_retryable boolean default true) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v notification_outbox%rowtype;
  v_delay integer;
begin
  select * into v from notification_outbox where id = p_outbox_id for update;
  if not found then
    raise exception 'unknown outbox row' using errcode = 'P0002';
  end if;
  -- A stale writer (its lease expired and another attempt started) must not overwrite newer state.
  if v.status <> 'IN_PROGRESS' or v.attempt_count <> p_attempt_number then
    return jsonb_build_object('recorded', false, 'status', v.status);
  end if;
  insert into notification_attempts (outbox_id, attempt_number, outcome, http_status, error_code, error_summary)
  values (p_outbox_id, p_attempt_number, p_outcome, p_http_status, left(p_error_code, 60), left(p_error_summary, 300));
  if p_outcome = 'SUCCESS' then
    update notification_outbox set status = 'SENT', sent_at = now(), locked_until = null, last_error = null where id = p_outbox_id;
    return jsonb_build_object('recorded', true, 'status', 'SENT');
  end if;
  v_delay := least(60 * power(2, greatest(v.attempt_count - 1, 0))::integer, 21600);
  update notification_outbox
     set status = 'FAILED', locked_until = null, last_error = left(coalesce(p_error_summary, p_error_code, 'delivery failed'), 300),
         next_attempt_at = case when p_retryable then now() + make_interval(secs => v_delay) else 'infinity'::timestamptz end
   where id = p_outbox_id;
  return jsonb_build_object('recorded', true, 'status', 'FAILED', 'retry_in_seconds', case when p_retryable then v_delay else null end);
end $$;

-- ── list_due_notifications: ids of outbox rows that may be attempted now (used by the sweeper) ──
create function public.list_due_notifications(p_limit integer default 10) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- A lease that expired on the LAST allowed attempt can never be claimed again: close it as FAILED.
  update notification_outbox set status = 'FAILED', locked_until = null, last_error = coalesce(last_error, 'attempt did not complete')
   where status = 'IN_PROGRESS' and locked_until <= now() and attempt_count >= max_attempts;
  return (select coalesce(jsonb_agg(s.id order by s.next_attempt_at), '[]'::jsonb)
            from (select id, next_attempt_at from notification_outbox
                   where status in ('PENDING', 'FAILED', 'IN_PROGRESS') and attempt_count < max_attempts and next_attempt_at <= now() and (locked_until is null or locked_until <= now())
                   order by next_attempt_at limit greatest(least(p_limit, 50), 1)) s);
end $$;

-- ── retry_notification: manual retry of a FAILED row (never of a SENT one, so no duplicate email) ──
create function public.retry_notification(p_outbox_id uuid) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v notification_outbox%rowtype;
begin
  select * into v from notification_outbox where id = p_outbox_id for update;
  if not found then
    return jsonb_build_object('retried', false, 'reason', 'NOT_FOUND');
  end if;
  if v.status = 'SENT' then
    return jsonb_build_object('retried', false, 'reason', 'ALREADY_SENT');
  end if;
  if v.status = 'IN_PROGRESS' and v.locked_until > now() then
    return jsonb_build_object('retried', false, 'reason', 'IN_PROGRESS');
  end if;
  update notification_outbox set status = 'PENDING', next_attempt_at = now(), locked_until = null, max_attempts = least(greatest(max_attempts, attempt_count + 3), 50) where id = p_outbox_id;
  return jsonb_build_object('retried', true);
end $$;

-- ── check_rate_limit: atomic fixed-window counter shared by all server instances ──
create function public.check_rate_limit(p_key text, p_limit integer, p_window_seconds integer) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_hits integer;
  v_start timestamptz;
  v_window interval := make_interval(secs => greatest(p_window_seconds, 1));
begin
  insert into rate_limits as r (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update
     set window_start = case when r.window_start <= now() - v_window then now() else r.window_start end,
         hits = case when r.window_start <= now() - v_window then 1 else r.hits + 1 end
  returning r.hits, r.window_start into v_hits, v_start;
  return jsonb_build_object('allowed', v_hits <= p_limit, 'hits', v_hits, 'retry_after_seconds', case when v_hits <= p_limit then 0 else greatest(ceil(extract(epoch from (v_start + v_window - now())))::integer, 1) end);
end $$;

create function public.purge_rate_limits(p_older_than_seconds integer default 86400) returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_deleted integer;
begin
  delete from rate_limits where window_start < now() - make_interval(secs => greatest(p_older_than_seconds, 60));
  get diagnostics v_deleted = row_count;
  return v_deleted;
end $$;

-- ── Row Level Security: enabled everywhere, NO policies yet ⇒ anon/authenticated can read and write nothing. ──
-- Public submissions go through the server (service role). Admin policies are added with admin authentication (Phase 7).
alter table public.enquiries enable row level security;

alter table public.enquiry_items enable row level security;

alter table public.enquiry_notes enable row level security;

alter table public.notification_outbox enable row level security;

alter table public.notification_attempts enable row level security;

alter table public.rate_limits enable row level security;

-- Defence in depth: Supabase grants new public tables to anon/authenticated by default — remove that.
revoke all on table public.enquiries, public.enquiry_items, public.enquiry_notes, public.notification_outbox, public.notification_attempts, public.rate_limits from public, anon, authenticated;

revoke all on sequence public.enquiry_reference_seq from public, anon, authenticated;

grant all on table public.enquiries, public.enquiry_items, public.enquiry_notes, public.notification_outbox, public.notification_attempts, public.rate_limits to service_role;

grant usage, select on sequence public.enquiry_reference_seq to service_role;

-- Functions are SECURITY DEFINER: only the service role may execute them (never anon/authenticated/public).
revoke all on function public.create_enquiry(jsonb), public.claim_notification(uuid, integer), public.record_notification_attempt(uuid, integer, text, integer, text, text, boolean), public.list_due_notifications(integer), public.retry_notification(uuid), public.check_rate_limit(text, integer, integer), public.purge_rate_limits(integer) from public, anon, authenticated;

grant execute on function public.create_enquiry(jsonb), public.claim_notification(uuid, integer), public.record_notification_attempt(uuid, integer, text, integer, text, text, boolean), public.list_due_notifications(integer), public.retry_notification(uuid), public.check_rate_limit(text, integer, integer), public.purge_rate_limits(integer) to service_role;
