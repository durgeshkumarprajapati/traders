-- Sagar Traders — Customer Features: Enquiry tracking, Callback requests, Quotation management.
-- Applies to Supabase (PostgreSQL 15+). Authoring rule for the test harness: top-level statements are
-- separated by blank lines and there are NO blank lines inside function bodies.

alter table public.enquiries add column tracking_token_hash text unique;

alter table public.enquiries add column tracking_token_expires_at timestamptz;

alter table public.enquiries add column tracking_token_revoked_at timestamptz;

create table public.enquiry_status_history (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.enquiries (id) on delete cascade,
  previous_status text check (previous_status is null or previous_status in ('NEW', 'CONTACTED', 'QUOTATION_SENT', 'CONFIRMED', 'COMPLETED', 'CANCELLED')),
  new_status text not null check (new_status in ('NEW', 'CONTACTED', 'QUOTATION_SENT', 'CONFIRMED', 'COMPLETED', 'CANCELLED')),
  changed_by uuid references auth.users (id) on delete set null,
  description text check (description is null or char_length(description) <= 500),
  created_at timestamptz not null default now()
);

create index enquiry_status_history_enquiry_idx on public.enquiry_status_history (enquiry_id, created_at asc);

create table public.enquiry_callbacks (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.enquiries (id) on delete cascade unique,
  preferred_date date,
  preferred_time_window text check (preferred_time_window is null or preferred_time_window in ('MORNING', 'AFTERNOON', 'EVENING', 'ANYTIME')),
  reason text check (reason is null or char_length(reason) <= 200),
  created_at timestamptz not null default now()
);

create index enquiry_callbacks_enquiry_idx on public.enquiry_callbacks (enquiry_id);

create sequence public.quotation_reference_seq as bigint minvalue 1 start 1000;

create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  enquiry_id uuid not null references public.enquiries (id) on delete cascade,
  version integer not null default 1 check (version >= 1),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'ISSUED', 'REVISED', 'EXPIRED', 'ACCEPTED', 'REJECTED')),
  customer_name text not null check (char_length(customer_name) between 2 and 100),
  mobile text not null check (mobile ~ '^[6-9][0-9]{9}$'),
  email text check (email is null or (char_length(email) <= 254 and position('@' in email) > 1)),
  delivery_location text check (delivery_location is null or char_length(delivery_location) between 3 and 300),
  subtotal numeric(14, 2) not null check (subtotal >= 0),
  discount_amount numeric(14, 2) not null default 0 check (discount_amount >= 0),
  tax_amount numeric(14, 2) not null default 0 check (tax_amount >= 0),
  total_amount numeric(14, 2) not null check (total_amount >= 0),
  terms_and_conditions text check (terms_and_conditions is null or char_length(terms_and_conditions) <= 3000),
  valid_until timestamptz,
  tracking_token_hash text unique,
  tracking_token_expires_at timestamptz,
  tracking_token_revoked_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  issued_at timestamptz,
  unique (enquiry_id, version)
);

create index quotations_enquiry_idx on public.quotations (enquiry_id, version desc);

create index quotations_reference_idx on public.quotations (reference);

create index quotations_token_hash_idx on public.quotations (tracking_token_hash);

create table public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  position smallint not null check (position >= 1),
  product_id text check (product_id is null or char_length(product_id) between 1 and 64),
  sku text check (sku is null or char_length(sku) <= 64),
  product_name text not null check (char_length(product_name) between 1 and 200),
  brand_name text check (brand_name is null or char_length(brand_name) <= 100),
  unit_code text not null check (unit_code in ('BAG', 'PIECE', 'KG', 'TON', 'METRIC_TON', 'CUBIC_FEET', 'CUBIC_METER', 'BUNDLE', 'BOX', 'METER', 'BRASS', 'BLOCK', 'CUSTOM')),
  unit_label text not null check (char_length(unit_label) between 1 and 40),
  quantity numeric(12, 3) not null check (quantity > 0 and quantity <= 1000000),
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  line_total numeric(14, 2) not null check (line_total >= 0),
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  unique (quotation_id, position)
);

create index quotation_items_quotation_idx on public.quotation_items (quotation_id);

create trigger quotations_set_updated_at before update on public.quotations for each row execute function public.set_updated_at();

-- ── Row Level Security: enable on all new tables ──
alter table public.enquiry_status_history enable row level security;

alter table public.enquiry_callbacks enable row level security;

alter table public.quotations enable row level security;

alter table public.quotation_items enable row level security;

-- Default deny: revoke from anon, authenticated, public.
revoke all on table public.enquiry_status_history, public.enquiry_callbacks, public.quotations, public.quotation_items from public, anon, authenticated;

revoke all on sequence public.quotation_reference_seq from public, anon, authenticated;

grant all on table public.enquiry_status_history, public.enquiry_callbacks, public.quotations, public.quotation_items to service_role;

grant usage, select on sequence public.quotation_reference_seq to service_role;

-- Admin policies: authenticated users who pass is_admin() get full access.
grant select, insert, update, delete on table public.enquiry_status_history, public.enquiry_callbacks, public.quotations, public.quotation_items to authenticated;

create policy admin_enquiry_status_history_policy on public.enquiry_status_history for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy admin_enquiry_callbacks_policy on public.enquiry_callbacks for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy admin_quotations_policy on public.quotations for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy admin_quotation_items_policy on public.quotation_items for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ── create_enquiry: updated to store tracking token hash and initial status history ──
create or replace function public.create_enquiry(p_payload jsonb) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_key uuid := (p_payload->>'idempotency_key')::uuid;
  v_type text := p_payload->>'type';
  v_id uuid;
  v_ref text;
  v_outbox uuid;
  v_item jsonb;
  v_pos integer := 0;
  v_existing record;
  v_token_hash text := p_payload->>'tracking_token_hash';
  v_token_expires timestamptz := case when p_payload->>'tracking_token_expires_at' is not null then (p_payload->>'tracking_token_expires_at')::timestamptz else (now() + interval '90 days') end;
  v_cb jsonb := p_payload->'callback';
  v_msg text := coalesce(nullif(p_payload->>'message', ''), case when p_payload->'callback' is not null then ('Callback requested' || case when nullif(p_payload->'callback'->>'reason', '') is not null then ': ' || (p_payload->'callback'->>'reason') else '' end) else null end);
begin
  select e.id, e.reference, o.id as outbox_id into v_existing from enquiries e left join notification_outbox o on o.enquiry_id = e.id where e.idempotency_key = v_key;
  if found then
    return jsonb_build_object('id', v_existing.id, 'reference', v_existing.reference, 'outbox_id', v_existing.outbox_id, 'duplicate', true);
  end if;
  v_ref := 'ENQ-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY') || '-' || lpad(nextval('enquiry_reference_seq')::text, 6, '0');
  insert into enquiries (reference, type, customer_name, mobile, email, delivery_location, message, idempotency_key, tracking_token_hash, tracking_token_expires_at)
  values (v_ref, v_type, p_payload->>'name', p_payload->>'mobile', nullif(p_payload->>'email', ''), nullif(p_payload->>'delivery_location', ''), v_msg, v_key, nullif(v_token_hash, ''), v_token_expires)
  returning id into v_id;
  insert into enquiry_status_history (enquiry_id, previous_status, new_status, description)
  values (v_id, null, 'NEW', 'Enquiry received');
  if v_cb is not null then
    insert into enquiry_callbacks (enquiry_id, preferred_date, preferred_time_window, reason)
    values (v_id, nullif(v_cb->>'preferred_date', '')::date, nullif(v_cb->>'preferred_time_window', ''), nullif(v_cb->>'reason', ''));
  end if;
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
  select e.id, e.reference, o.id as outbox_id into v_existing from enquiries e left join notification_outbox o on o.enquiry_id = e.id where e.idempotency_key = v_key;
  if found then
    return jsonb_build_object('id', v_existing.id, 'reference', v_existing.reference, 'outbox_id', v_existing.outbox_id, 'duplicate', true);
  end if;
  raise;
end $$;

-- ── get_tracked_enquiry: customer-safe enquiry tracking by public reference + tracking token hash ──
create function public.get_tracked_enquiry(p_reference text, p_token_hash text) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_enquiry record;
  v_timeline jsonb;
  v_items jsonb;
  v_quotation jsonb;
begin
  select id, reference, type, status, delivery_location, created_at, updated_at
    into v_enquiry
    from enquiries
   where reference = p_reference
     and tracking_token_hash = p_token_hash
     and tracking_token_revoked_at is null
     and (tracking_token_expires_at is null or tracking_token_expires_at > now());
  if not found then
    return null;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'previous_status', h.previous_status,
    'new_status', h.new_status,
    'description', h.description,
    'created_at', h.created_at
  ) order by h.created_at asc), '[]'::jsonb)
    into v_timeline
    from enquiry_status_history h
   where h.enquiry_id = v_enquiry.id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'position', i.position,
    'product_name', i.product_name,
    'brand_name', i.brand_name,
    'unit_label', i.unit_label,
    'quantity', i.quantity,
    'listed_price', i.listed_price,
    'stock_status', i.stock_status
  ) order by i.position asc), '[]'::jsonb)
    into v_items
    from enquiry_items i
   where i.enquiry_id = v_enquiry.id;
  select jsonb_build_object(
    'reference', q.reference,
    'version', q.version,
    'status', q.status,
    'total_amount', q.total_amount,
    'valid_until', q.valid_until,
    'issued_at', q.issued_at
  )
    into v_quotation
    from quotations q
   where q.enquiry_id = v_enquiry.id and q.status in ('ISSUED', 'ACCEPTED', 'EXPIRED')
   order by q.version desc
   limit 1;
  return jsonb_build_object(
    'reference', v_enquiry.reference,
    'type', v_enquiry.type,
    'status', v_enquiry.status,
    'delivery_location', v_enquiry.delivery_location,
    'created_at', v_enquiry.created_at,
    'updated_at', v_enquiry.updated_at,
    'timeline', v_timeline,
    'items', v_items,
    'quotation', v_quotation
  );
end $$;

-- ── get_tracked_quotation: customer-safe quotation access by tracking token hash ──
create function public.get_tracked_quotation(p_token_hash text) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_quo record;
  v_enq record;
  v_items jsonb;
begin
  select q.*, e.reference as enquiry_reference
    into v_quo
    from quotations q
    join enquiries e on e.id = q.enquiry_id
   where q.tracking_token_hash = p_token_hash
     and q.tracking_token_revoked_at is null
     and (q.tracking_token_expires_at is null or q.tracking_token_expires_at > now());
  if not found then
    return null;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'position', i.position,
    'product_name', i.product_name,
    'brand_name', i.brand_name,
    'unit_label', i.unit_label,
    'quantity', i.quantity,
    'unit_price', i.unit_price,
    'line_total', i.line_total,
    'notes', i.notes
  ) order by i.position asc), '[]'::jsonb)
    into v_items
    from quotation_items i
   where i.quotation_id = v_quo.id;
  return jsonb_build_object(
    'reference', v_quo.reference,
    'enquiry_reference', v_quo.enquiry_reference,
    'version', v_quo.version,
    'status', v_quo.status,
    'customer_name', v_quo.customer_name,
    'delivery_location', v_quo.delivery_location,
    'subtotal', v_quo.subtotal,
    'discount_amount', v_quo.discount_amount,
    'tax_amount', v_quo.tax_amount,
    'total_amount', v_quo.total_amount,
    'terms_and_conditions', v_quo.terms_and_conditions,
    'valid_until', v_quo.valid_until,
    'issued_at', v_quo.issued_at,
    'items', v_items
  );
end $$;

revoke all on function public.get_tracked_enquiry(text, text), public.get_tracked_quotation(text) from public, anon, authenticated;

grant execute on function public.get_tracked_enquiry(text, text), public.get_tracked_quotation(text) to service_role;
