-- Sagar Traders — hardening of the customer features (forward-only; earlier migrations are NOT modified).
--   1. Non-predictable public enquiry references.
--   2. Atomic, admin-only quotation creation / issuing with server-side exact arithmetic.
--   3. Database-enforced immutability of issued quotations (content and line items).
--   4. Quotation link rotation / revocation, customer view auditing.
--   5. Enquiry-token access to the latest issued quotation; superseded / expired flags.
-- Authoring rule for the test harness: top-level statements are separated by blank lines and there are NO blank lines inside function bodies.

alter table public.enquiries add column tracking_view_count integer not null default 0;

alter table public.enquiries add column tracking_last_viewed_at timestamptz;

alter table public.quotations add column view_count integer not null default 0;

alter table public.quotations add column last_viewed_at timestamptz;

-- Arithmetic integrity (NOT VALID: enforced for every new/updated row without rewriting any existing data).
alter table public.quotations add constraint quotations_total_consistent check (discount_amount <= subtotal and total_amount = subtotal - discount_amount + tax_amount) not valid;

alter table public.quotation_items add constraint quotation_items_line_total_consistent check (line_total = round(quantity * unit_price, 2)) not valid;

-- Customer-view counters must not look like a content change: keep updated_at when ONLY they change.
create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if (to_jsonb(new) - 'tracking_view_count' - 'tracking_last_viewed_at' - 'view_count' - 'last_viewed_at' - 'updated_at') = (to_jsonb(old) - 'tracking_view_count' - 'tracking_last_viewed_at' - 'view_count' - 'last_viewed_at' - 'updated_at') then
    new.updated_at := old.updated_at;
  else
    new.updated_at := now();
  end if;
  return new;
end $$;

-- ── 1. create_enquiry: public reference is random (48 bits from the database CSPRNG), never a counter ──
create or replace function public.create_enquiry(p_payload jsonb) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_key uuid := (p_payload->>'idempotency_key')::uuid;
  v_type text := p_payload->>'type';
  v_id uuid;
  v_ref text;
  v_h text;
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
  loop
    v_h := upper(replace(gen_random_uuid()::text, '-', ''));
    v_ref := 'ENQ-' || substr(v_h, 1, 4) || '-' || substr(v_h, 5, 4) || '-' || substr(v_h, 9, 4);
    exit when not exists (select 1 from enquiries where reference = v_ref);
  end loop;
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

-- ── 2. Immutability of issued quotations ──
create function public.quotations_guard() returns trigger language plpgsql set search_path = public, pg_temp as $$
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

create trigger quotations_immutable before update or delete on public.quotations for each row execute function public.quotations_guard();

create function public.quotation_items_guard() returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  v_status text;
begin
  select status into v_status from quotations where id = coalesce(new.quotation_id, old.quotation_id);
  if v_status is not null and v_status <> 'DRAFT' then
    raise exception 'quotation: line items of an issued quotation cannot be changed' using errcode = '55000';
  end if;
  return coalesce(new, old);
end $$;

create trigger quotation_items_immutable before insert or update or delete on public.quotation_items for each row execute function public.quotation_items_guard();

-- ── 3. create_quotation_draft: ONE transaction; totals computed here (exact numeric), never trusted from the browser ──
create function public.create_quotation_draft(p_payload jsonb) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_enq record;
  v_id uuid;
  v_ref text;
  v_version integer;
  v_item jsonb;
  v_pos integer := 0;
  v_subtotal numeric(14, 2);
  v_discount numeric(14, 2) := round(coalesce((p_payload->>'discount_amount')::numeric, 0), 2);
  v_tax numeric(14, 2) := round(coalesce((p_payload->>'tax_amount')::numeric, 0), 2);
  v_days integer := (p_payload->>'valid_days')::integer;
begin
  if not public.is_admin() then
    raise exception 'quotation: not authorised' using errcode = '42501';
  end if;
  select id, customer_name, mobile, email, delivery_location into v_enq from enquiries where id = (p_payload->>'enquiry_id')::uuid;
  if not found then
    raise exception 'quotation: enquiry not found' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_payload->'items') is distinct from 'array' or jsonb_array_length(p_payload->'items') = 0 then
    raise exception 'quotation: at least one line item is required' using errcode = '22023';
  end if;
  if jsonb_array_length(p_payload->'items') > 100 then
    raise exception 'quotation: too many line items (maximum 100)' using errcode = '22023';
  end if;
  if v_days is null or v_days < 1 or v_days > 90 then
    raise exception 'quotation: validity must be between 1 and 90 days' using errcode = '22023';
  end if;
  if v_discount < 0 or v_tax < 0 then
    raise exception 'quotation: discount and tax cannot be negative' using errcode = '22023';
  end if;
  for v_item in select value from jsonb_array_elements(p_payload->'items') loop
    if coalesce((v_item->>'quantity')::numeric, 0) <= 0 then
      raise exception 'quotation: every quantity must be greater than zero' using errcode = '22023';
    end if;
    if coalesce((v_item->>'unit_price')::numeric, 0) <= 0 then
      raise exception 'quotation: every rate must be greater than zero (enter the quoted rate)' using errcode = '22023';
    end if;
  end loop;
  select coalesce(sum(round((e->>'quantity')::numeric * (e->>'unit_price')::numeric, 2)), 0) into v_subtotal from jsonb_array_elements(p_payload->'items') e;
  if v_discount > v_subtotal then
    raise exception 'quotation: discount cannot exceed the subtotal' using errcode = '22023';
  end if;
  select coalesce(max(version), 0) + 1 into v_version from quotations where enquiry_id = v_enq.id;
  loop
    v_ref := 'QUO-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY') || '-' || lpad(nextval('quotation_reference_seq')::text, 6, '0');
    exit when not exists (select 1 from quotations where reference = v_ref);
  end loop;
  insert into quotations (reference, enquiry_id, version, status, customer_name, mobile, email, delivery_location, subtotal, discount_amount, tax_amount, total_amount, terms_and_conditions, valid_until, created_by)
  values (v_ref, v_enq.id, v_version, 'DRAFT', v_enq.customer_name, v_enq.mobile, v_enq.email, v_enq.delivery_location, v_subtotal, v_discount, v_tax, v_subtotal - v_discount + v_tax, nullif(btrim(p_payload->>'terms'), ''), now() + make_interval(days => v_days), auth.uid())
  returning id into v_id;
  for v_item in select value from jsonb_array_elements(p_payload->'items') loop
    v_pos := v_pos + 1;
    insert into quotation_items (quotation_id, position, product_id, sku, product_name, brand_name, unit_code, unit_label, quantity, unit_price, line_total, notes)
    values (v_id, v_pos, nullif(v_item->>'product_id', ''), nullif(v_item->>'sku', ''), v_item->>'product_name', nullif(v_item->>'brand_name', ''), v_item->>'unit_code', v_item->>'unit_label', (v_item->>'quantity')::numeric, (v_item->>'unit_price')::numeric, round((v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric, 2), nullif(btrim(v_item->>'notes'), ''));
  end loop;
  return jsonb_build_object('id', v_id, 'reference', v_ref, 'version', v_version, 'subtotal', v_subtotal, 'discount_amount', v_discount, 'tax_amount', v_tax, 'total_amount', v_subtotal - v_discount + v_tax);
end $$;

-- ── 4. issue_quotation: DRAFT -> ISSUED only; supersedes earlier versions; moves the enquiry status only when valid, recording the REAL previous status ──
create function public.issue_quotation(p_quotation_id uuid, p_token_hash text, p_expires timestamptz) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_q record;
  v_prev text;
  v_changed boolean := false;
begin
  if not public.is_admin() then
    raise exception 'quotation: not authorised' using errcode = '42501';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'quotation: invalid access token' using errcode = '22023';
  end if;
  if p_expires is null or p_expires <= now() then
    raise exception 'quotation: the access link must expire in the future' using errcode = '22023';
  end if;
  select * into v_q from quotations where id = p_quotation_id for update;
  if not found then
    raise exception 'quotation: not found' using errcode = 'P0002';
  end if;
  if v_q.status <> 'DRAFT' then
    raise exception 'quotation: only a draft can be issued (this one is already %)', v_q.status using errcode = '55000';
  end if;
  if not exists (select 1 from quotation_items where quotation_id = v_q.id) then
    raise exception 'quotation: it has no line items' using errcode = '22023';
  end if;
  if v_q.valid_until is not null and v_q.valid_until <= now() then
    raise exception 'quotation: the validity date has already passed; create a new draft' using errcode = '22023';
  end if;
  update quotations set status = 'REVISED' where enquiry_id = v_q.enquiry_id and id <> v_q.id and status = 'ISSUED';
  update quotations set status = 'ISSUED', issued_at = now(), tracking_token_hash = p_token_hash, tracking_token_expires_at = p_expires, tracking_token_revoked_at = null where id = v_q.id;
  select status into v_prev from enquiries where id = v_q.enquiry_id for update;
  if v_prev in ('NEW', 'CONTACTED') then
    update enquiries set status = 'QUOTATION_SENT' where id = v_q.enquiry_id;
    insert into enquiry_status_history (enquiry_id, previous_status, new_status, changed_by, description)
    values (v_q.enquiry_id, v_prev, 'QUOTATION_SENT', auth.uid(), 'A quotation was issued');
    v_changed := true;
  end if;
  return jsonb_build_object('reference', v_q.reference, 'version', v_q.version, 'enquiry_status_changed', v_changed);
end $$;

create function public.rotate_quotation_token(p_quotation_id uuid, p_token_hash text, p_expires timestamptz) returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then
    raise exception 'quotation: not authorised' using errcode = '42501';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' or p_expires is null or p_expires <= now() then
    raise exception 'quotation: invalid access token' using errcode = '22023';
  end if;
  update quotations set tracking_token_hash = p_token_hash, tracking_token_expires_at = p_expires, tracking_token_revoked_at = null where id = p_quotation_id and status = 'ISSUED';
  if not found then
    raise exception 'quotation: only an issued quotation has an access link' using errcode = '55000';
  end if;
end $$;

create function public.revoke_quotation_token(p_quotation_id uuid) returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then
    raise exception 'quotation: not authorised' using errcode = '42501';
  end if;
  update quotations set tracking_token_revoked_at = now() where id = p_quotation_id and status <> 'DRAFT';
  if not found then
    raise exception 'quotation: only an issued quotation has an access link' using errcode = '55000';
  end if;
end $$;

revoke all on function public.create_quotation_draft(jsonb), public.issue_quotation(uuid, text, timestamptz), public.rotate_quotation_token(uuid, text, timestamptz), public.revoke_quotation_token(uuid) from public, anon;

grant execute on function public.create_quotation_draft(jsonb), public.issue_quotation(uuid, text, timestamptz), public.rotate_quotation_token(uuid, text, timestamptz), public.revoke_quotation_token(uuid) to authenticated;

-- ── 5. get_tracked_quotation: quotation link, OR the enquiry tracking link (latest issued version only); audits views ──
create or replace function public.get_tracked_quotation(p_token_hash text) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_quo quotations%rowtype;
  v_found boolean := false;
  v_enq_ref text;
  v_items jsonb;
  v_latest boolean;
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
       and q.status in ('ISSUED', 'ACCEPTED', 'REJECTED', 'EXPIRED')
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
  update quotations set view_count = view_count + 1, last_viewed_at = now() where id = v_quo.id;
  return jsonb_build_object('reference', v_quo.reference, 'enquiry_reference', v_enq_ref, 'version', v_quo.version, 'status', v_quo.status, 'is_latest', v_latest, 'is_expired', (v_quo.valid_until is not null and v_quo.valid_until < now()), 'customer_name', v_quo.customer_name, 'delivery_location', v_quo.delivery_location, 'subtotal', v_quo.subtotal, 'discount_amount', v_quo.discount_amount, 'tax_amount', v_quo.tax_amount, 'total_amount', v_quo.total_amount, 'terms_and_conditions', v_quo.terms_and_conditions, 'valid_until', v_quo.valid_until, 'issued_at', v_quo.issued_at, 'items', v_items);
end $$;

-- ── 6. get_tracked_enquiry: unchanged contract, plus verified-access auditing for the admin ──
create or replace function public.get_tracked_enquiry(p_reference text, p_token_hash text) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_enquiry record;
  v_timeline jsonb;
  v_items jsonb;
  v_quotation jsonb;
begin
  select id, reference, type, status, delivery_location, created_at, updated_at into v_enquiry from enquiries
   where reference = p_reference and tracking_token_hash = p_token_hash and tracking_token_revoked_at is null and (tracking_token_expires_at is null or tracking_token_expires_at > now());
  if not found then
    return null;
  end if;
  update enquiries set tracking_view_count = tracking_view_count + 1, tracking_last_viewed_at = now() where id = v_enquiry.id;
  select coalesce(jsonb_agg(jsonb_build_object('previous_status', h.previous_status, 'new_status', h.new_status, 'description', h.description, 'created_at', h.created_at) order by h.created_at asc), '[]'::jsonb) into v_timeline from enquiry_status_history h where h.enquiry_id = v_enquiry.id;
  select coalesce(jsonb_agg(jsonb_build_object('position', i.position, 'product_name', i.product_name, 'brand_name', i.brand_name, 'unit_label', i.unit_label, 'quantity', i.quantity, 'listed_price', i.listed_price, 'stock_status', i.stock_status) order by i.position asc), '[]'::jsonb) into v_items from enquiry_items i where i.enquiry_id = v_enquiry.id;
  select jsonb_build_object('reference', q.reference, 'version', q.version, 'status', q.status, 'total_amount', q.total_amount, 'valid_until', q.valid_until, 'issued_at', q.issued_at, 'is_expired', (q.valid_until is not null and q.valid_until < now())) into v_quotation from quotations q where q.enquiry_id = v_enquiry.id and q.status in ('ISSUED', 'ACCEPTED', 'REJECTED', 'EXPIRED') order by q.version desc limit 1;
  return jsonb_build_object('reference', v_enquiry.reference, 'type', v_enquiry.type, 'status', v_enquiry.status, 'delivery_location', v_enquiry.delivery_location, 'created_at', v_enquiry.created_at, 'updated_at', v_enquiry.updated_at, 'timeline', v_timeline, 'items', v_items, 'quotation', v_quotation);
end $$;
