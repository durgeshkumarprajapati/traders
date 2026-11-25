-- Sagar Traders — Phase 14 (Stage 4): Online Quotation Approval, Orders & Delivery Tracking.
-- Forward-only additive migration. Authoring rule: top-level statements separated by blank lines, NO blank lines inside function bodies.

alter table public.quotations drop constraint if exists quotations_status_check;

alter table public.quotations add constraint quotations_status_check check (status in ('DRAFT', 'ISSUED', 'REVISED', 'EXPIRED', 'ACCEPTED', 'REJECTED', 'CHANGE_REQUESTED'));

create table public.quotation_responses (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null unique references public.quotations (id) on delete cascade,
  quotation_version integer not null check (quotation_version >= 1),
  response_type text not null check (response_type in ('ACCEPTED', 'CHANGE_REQUESTED', 'REJECTED')),
  comment text check (comment is null or char_length(comment) <= 2000),
  responded_at timestamptz not null default now()
);

create index quotation_responses_quotation_idx on public.quotation_responses (quotation_id, responded_at desc);

alter table public.quotation_responses enable row level security;

revoke all on table public.quotation_responses from public, anon, authenticated;

grant all on table public.quotation_responses to service_role;

grant select on table public.quotation_responses to authenticated;

create policy admin_quotation_responses_read on public.quotation_responses for select to authenticated using (public.is_admin());

-- Allow ISSUED -> ACCEPTED / REJECTED / CHANGE_REQUESTED while keeping content and line items immutable.
create or replace function public.quotations_guard() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'DRAFT' then
      raise exception 'quotation: issued quotations cannot be deleted' using errcode = '55000';
    end if;
    return old;
  end if;
  if old.status <> 'DRAFT' then
    if (new.id, new.reference, new.enquiry_id, new.version, new.customer_name, new.mobile, new.email, new.delivery_location, new.subtotal, new.discount_amount, new.tax_amount, new.total_amount, new.terms_and_conditions, new.valid_until, new.issued_at, new.created_by, new.created_at)
       is distinct from
       (old.id, old.reference, old.enquiry_id, old.version, old.customer_name, old.mobile, old.email, old.delivery_location, old.subtotal, old.discount_amount, old.tax_amount, old.total_amount, old.terms_and_conditions, old.valid_until, old.issued_at, old.created_by, old.created_at) then
      raise exception 'quotation: the content of an issued quotation cannot be changed; create a revision instead' using errcode = '55000';
    end if;
    if new.status = 'DRAFT' then
      raise exception 'quotation: an issued quotation cannot return to draft' using errcode = '55000';
    end if;
  end if;
  return new;
end $$;

-- Update get_tracked_quotation to include CHANGE_REQUESTED status and response details.
create or replace function public.get_tracked_quotation(p_token_hash text) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_quo quotations%rowtype;
  v_found boolean := false;
  v_enq_ref text;
  v_items jsonb;
  v_latest boolean;
  v_resp record;
begin
  select q.* into v_quo from quotations q
   where q.tracking_token_hash = p_token_hash
     and q.status <> 'DRAFT'
     and q.tracking_token_revoked_at is null
     and (q.tracking_token_expires_at is null or q.tracking_token_expires_at > now());
  v_found := found;
  if not v_found then
    select q.* into v_quo from enquiries e join quotations q on q.enquiry_id = e.id
     where e.tracking_token_hash = p_token_hash
       and e.tracking_token_revoked_at is null
       and (e.tracking_token_expires_at is null or e.tracking_token_expires_at > now())
       and q.status in ('ISSUED', 'ACCEPTED', 'REJECTED', 'CHANGE_REQUESTED', 'EXPIRED')
     order by q.version desc
     limit 1;
    v_found := found;
  end if;
  if not v_found then
    return null;
  end if;
  select reference into v_enq_ref from enquiries where id = v_quo.enquiry_id;
  select not exists (select 1 from quotations x where x.enquiry_id = v_quo.enquiry_id and x.version > v_quo.version and x.status <> 'DRAFT') into v_latest;
  select coalesce(jsonb_agg(jsonb_build_object('position', i.position, 'product_name', i.product_name, 'brand_name', i.brand_name, 'unit_label', i.unit_label, 'quantity', i.quantity, 'unit_price', i.unit_price, 'line_total', i.line_total, 'notes', i.notes) order by i.position asc), '[]'::jsonb) into v_items from quotation_items i where i.quotation_id = v_quo.id;
  select response_type, comment, responded_at into v_resp from quotation_responses where quotation_id = v_quo.id;
  update quotations set view_count = view_count + 1, last_viewed_at = now() where id = v_quo.id;
  return jsonb_build_object('reference', v_quo.reference, 'enquiry_reference', v_enq_ref, 'version', v_quo.version, 'status', v_quo.status, 'is_latest', v_latest, 'is_expired', (v_quo.valid_until is not null and v_quo.valid_until < now()), 'customer_name', v_quo.customer_name, 'delivery_location', v_quo.delivery_location, 'subtotal', v_quo.subtotal, 'discount_amount', v_quo.discount_amount, 'tax_amount', v_quo.tax_amount, 'total_amount', v_quo.total_amount, 'terms_and_conditions', v_quo.terms_and_conditions, 'valid_until', v_quo.valid_until, 'issued_at', v_quo.issued_at, 'items', v_items, 'response', case when v_resp.response_type is not null then jsonb_build_object('response_type', v_resp.response_type, 'comment', v_resp.comment, 'responded_at', v_resp.responded_at) else null end);
end $$;

-- Customer-safe, idempotent quotation response (prevents duplicate/replay responses).
create function public.respond_to_quotation(p_token_hash text, p_response_type text, p_comment text default null) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_quo quotations%rowtype;
  v_enq enquiries%rowtype;
  v_latest boolean;
begin
  if p_response_type not in ('ACCEPTED', 'CHANGE_REQUESTED', 'REJECTED') then
    raise exception 'quotation: invalid response type' using errcode = '22023';
  end if;
  select q.* into v_quo from quotations q
   where q.tracking_token_hash = p_token_hash
     and q.status <> 'DRAFT'
     and q.tracking_token_revoked_at is null
     and (q.tracking_token_expires_at is null or q.tracking_token_expires_at > now())
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'NOT_FOUND');
  end if;
  select not exists (select 1 from quotations x where x.enquiry_id = v_quo.enquiry_id and x.version > v_quo.version and x.status <> 'DRAFT') into v_latest;
  if not v_latest then
    return jsonb_build_object('ok', false, 'reason', 'SUPERSEDED');
  end if;
  if v_quo.valid_until is not null and v_quo.valid_until < now() then
    return jsonb_build_object('ok', false, 'reason', 'EXPIRED');
  end if;
  if v_quo.status <> 'ISSUED' then
    return jsonb_build_object('ok', false, 'reason', 'ALREADY_RESPONDED', 'status', v_quo.status);
  end if;
  insert into quotation_responses (quotation_id, quotation_version, response_type, comment)
  values (v_quo.id, v_quo.version, p_response_type, nullif(btrim(p_comment), ''));
  update quotations set status = p_response_type where id = v_quo.id;
  select * into v_enq from enquiries where id = v_quo.enquiry_id for update;
  if p_response_type = 'ACCEPTED' and v_enq.status in ('NEW', 'CONTACTED', 'QUOTATION_SENT') then
    update enquiries set status = 'CONFIRMED' where id = v_enq.id;
    insert into enquiry_status_history (enquiry_id, previous_status, new_status, description)
    values (v_enq.id, v_enq.status, 'CONFIRMED', 'Customer accepted quotation ' || v_quo.reference);
  elsif p_response_type = 'CHANGE_REQUESTED' then
    insert into enquiry_status_history (enquiry_id, previous_status, new_status, description)
    values (v_enq.id, v_enq.status, v_enq.status, 'Customer requested changes on quotation ' || v_quo.reference);
  elsif p_response_type = 'REJECTED' then
    insert into enquiry_status_history (enquiry_id, previous_status, new_status, description)
    values (v_enq.id, v_enq.status, v_enq.status, 'Customer declined quotation ' || v_quo.reference);
  end if;
  insert into audit_logs (actor_type, action, entity_type, entity_id, details)
  values ('CUSTOMER', 'QUOTATION_' || p_response_type, 'quotation', v_quo.id::text, jsonb_build_object('reference', v_quo.reference, 'version', v_quo.version));
  return jsonb_build_object('ok', true, 'quotation_id', v_quo.id, 'enquiry_id', v_quo.enquiry_id, 'reference', v_quo.reference, 'status', p_response_type);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'reason', 'ALREADY_RESPONDED');
end $$;

revoke all on function public.respond_to_quotation(text, text, text) from public, anon, authenticated;

grant execute on function public.respond_to_quotation(text, text, text) to service_role;

-- ── Orders & Delivery Tracking ──
create sequence public.order_reference_seq as bigint minvalue 1 start 1000;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  customer_id uuid references public.customers (id) on delete set null,
  enquiry_id uuid references public.enquiries (id) on delete set null,
  quotation_id uuid references public.quotations (id) on delete set null,
  quotation_version integer,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'CONFIRMED', 'PREPARING', 'READY_FOR_DISPATCH', 'DISPATCHED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED')),
  customer_name text not null check (char_length(customer_name) between 2 and 100),
  mobile text not null check (mobile ~ '^[6-9][0-9]{9}$'),
  email text check (email is null or (char_length(email) <= 254 and position('@' in email) > 1)),
  delivery_address text check (delivery_address is null or char_length(delivery_address) <= 300),
  customer_instructions text check (customer_instructions is null or char_length(customer_instructions) <= 1000),
  subtotal numeric(14, 2) not null check (subtotal >= 0),
  discount_amount numeric(14, 2) not null default 0 check (discount_amount >= 0),
  tax_amount numeric(14, 2) not null default 0 check (tax_amount >= 0),
  total_amount numeric(14, 2) not null check (total_amount >= 0),
  expected_delivery_date date,
  tracking_token_hash text unique,
  tracking_token_expires_at timestamptz,
  tracking_token_revoked_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_total_consistent check (discount_amount <= subtotal and total_amount = subtotal - discount_amount + tax_amount)
);

create index orders_status_created_idx on public.orders (status, created_at desc);

create index orders_customer_idx on public.orders (customer_id, created_at desc);

create index orders_quotation_idx on public.orders (quotation_id);

create trigger orders_set_updated_at before update on public.orders for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
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
  unique (order_id, position)
);

create index order_items_order_idx on public.order_items (order_id);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  previous_status text,
  new_status text not null check (new_status in ('DRAFT', 'CONFIRMED', 'PREPARING', 'READY_FOR_DISPATCH', 'DISPATCHED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED')),
  changed_by uuid references auth.users (id) on delete set null,
  description text check (description is null or char_length(description) <= 500),
  created_at timestamptz not null default now()
);

create index order_status_history_order_idx on public.order_status_history (order_id, created_at asc);

create table public.delivery_records (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  delivery_address text check (delivery_address is null or char_length(delivery_address) <= 300),
  contact_person text check (contact_person is null or char_length(contact_person) <= 100),
  contact_number text check (contact_number is null or char_length(contact_number) <= 20),
  vehicle_number text check (vehicle_number is null or char_length(vehicle_number) <= 40),
  driver_name text check (driver_name is null or char_length(driver_name) <= 100),
  dispatched_at timestamptz,
  expected_delivery_date date,
  actual_delivery_date timestamptz,
  delivery_notes text check (delivery_notes is null or char_length(delivery_notes) <= 1000),
  proof_of_delivery_url text check (proof_of_delivery_url is null or char_length(proof_of_delivery_url) <= 500),
  updated_at timestamptz not null default now()
);

create trigger delivery_records_set_updated_at before update on public.delivery_records for each row execute function public.set_updated_at();

create table public.order_notes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete restrict,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index order_notes_order_idx on public.order_notes (order_id, created_at desc);

alter table public.orders enable row level security;

alter table public.order_items enable row level security;

alter table public.order_status_history enable row level security;

alter table public.delivery_records enable row level security;

alter table public.order_notes enable row level security;

revoke all on table public.orders, public.order_items, public.order_status_history, public.delivery_records, public.order_notes from public, anon, authenticated;

revoke all on sequence public.order_reference_seq from public, anon, authenticated;

grant all on table public.orders, public.order_items, public.order_status_history, public.delivery_records, public.order_notes to service_role;

grant usage, select on sequence public.order_reference_seq to service_role;

grant select, insert, update, delete on table public.orders, public.order_items, public.order_status_history, public.delivery_records, public.order_notes to authenticated;

create policy admin_orders_policy on public.orders for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy admin_order_items_policy on public.order_items for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy admin_order_status_history_policy on public.order_status_history for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy admin_delivery_records_policy on public.delivery_records for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy admin_order_notes_policy on public.order_notes for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ── create_order_from_quotation: admin-only atomic snapshot copy ──
create function public.create_order_from_quotation(p_quotation_id uuid, p_token_hash text, p_expires timestamptz, p_expected_delivery_date date default null, p_instructions text default null) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_q quotations%rowtype;
  v_id uuid;
  v_ref text;
  v_customer_id uuid;
begin
  if not public.is_admin() then
    raise exception 'order: not authorised' using errcode = '42501';
  end if;
  select * into v_q from quotations where id = p_quotation_id for update;
  if not found then
    raise exception 'order: quotation not found' using errcode = 'P0002';
  end if;
  if v_q.status <> 'ACCEPTED' then
    raise exception 'order: only an accepted quotation can be converted to an order' using errcode = '55000';
  end if;
  if exists (select 1 from orders where quotation_id = v_q.id and status <> 'CANCELLED') then
    raise exception 'order: an active order already exists for this quotation' using errcode = '55000';
  end if;
  v_customer_id := coalesce(v_q.customer_id, public.resolve_customer(v_q.customer_name, v_q.mobile, v_q.email, v_q.delivery_location, null));
  loop
    v_ref := 'ORD-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY') || '-' || lpad(nextval('order_reference_seq')::text, 6, '0');
    exit when not exists (select 1 from orders where reference = v_ref);
  end loop;
  insert into orders (reference, customer_id, enquiry_id, quotation_id, quotation_version, status, customer_name, mobile, email, delivery_address, customer_instructions, subtotal, discount_amount, tax_amount, total_amount, expected_delivery_date, tracking_token_hash, tracking_token_expires_at, created_by)
  values (v_ref, v_customer_id, v_q.enquiry_id, v_q.id, v_q.version, 'CONFIRMED', v_q.customer_name, v_q.mobile, v_q.email, v_q.delivery_location, nullif(btrim(p_instructions), ''), v_q.subtotal, v_q.discount_amount, v_q.tax_amount, v_q.total_amount, p_expected_delivery_date, nullif(p_token_hash, ''), p_expires, auth.uid())
  returning id into v_id;
  insert into order_items (order_id, position, product_id, sku, product_name, brand_name, unit_code, unit_label, quantity, unit_price, line_total)
  select v_id, position, product_id, sku, product_name, brand_name, unit_code, unit_label, quantity, unit_price, line_total from quotation_items where quotation_id = v_q.id order by position asc;
  insert into order_status_history (order_id, previous_status, new_status, changed_by, description)
  values (v_id, null, 'CONFIRMED', auth.uid(), 'Order created from quotation ' || v_q.reference);
  insert into delivery_records (order_id, delivery_address, contact_person, contact_number, expected_delivery_date)
  values (v_id, v_q.delivery_location, v_q.customer_name, v_q.mobile, p_expected_delivery_date);
  insert into audit_logs (actor_id, actor_type, action, entity_type, entity_id, details)
  values (auth.uid(), 'ADMIN', 'ORDER_CREATED', 'order', v_id::text, jsonb_build_object('reference', v_ref, 'quotation_id', v_q.id, 'total_amount', v_q.total_amount));
  return jsonb_build_object('id', v_id, 'reference', v_ref);
end $$;

revoke all on function public.create_order_from_quotation(uuid, text, timestamptz, date, text) from public, anon;

grant execute on function public.create_order_from_quotation(uuid, text, timestamptz, date, text) to authenticated, service_role;

-- ── get_tracked_order: customer-safe order tracking by token hash ──
create function public.get_tracked_order(p_token_hash text) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_o orders%rowtype;
  v_items jsonb;
  v_history jsonb;
  v_del record;
begin
  select * into v_o from orders
   where tracking_token_hash = p_token_hash
     and tracking_token_revoked_at is null
     and (tracking_token_expires_at is null or tracking_token_expires_at > now());
  if not found then
    return null;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('position', i.position, 'product_name', i.product_name, 'brand_name', i.brand_name, 'unit_label', i.unit_label, 'quantity', i.quantity, 'unit_price', i.unit_price, 'line_total', i.line_total) order by i.position asc), '[]'::jsonb) into v_items from order_items i where i.order_id = v_o.id;
  select coalesce(jsonb_agg(jsonb_build_object('previous_status', h.previous_status, 'new_status', h.new_status, 'description', h.description, 'created_at', h.created_at) order by h.created_at asc), '[]'::jsonb) into v_history from order_status_history h where h.order_id = v_o.id;
  select delivery_address, expected_delivery_date, dispatched_at, actual_delivery_date into v_del from delivery_records where order_id = v_o.id;
  return jsonb_build_object('reference', v_o.reference, 'status', v_o.status, 'customer_name', v_o.customer_name, 'delivery_address', coalesce(v_del.delivery_address, v_o.delivery_address), 'expected_delivery_date', coalesce(v_del.expected_delivery_date, v_o.expected_delivery_date), 'dispatched_at', v_del.dispatched_at, 'actual_delivery_date', v_del.actual_delivery_date, 'subtotal', v_o.subtotal, 'discount_amount', v_o.discount_amount, 'tax_amount', v_o.tax_amount, 'total_amount', v_o.total_amount, 'created_at', v_o.created_at, 'items', v_items, 'timeline', v_history);
end $$;

revoke all on function public.get_tracked_order(text) from public, anon, authenticated;

grant execute on function public.get_tracked_order(text) to service_role;
