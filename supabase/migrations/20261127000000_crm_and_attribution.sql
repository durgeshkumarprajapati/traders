-- Sagar Traders — Phase 14 (Stage 2 & 3): CRM, Customer Identity Resolution, Notes, Interactions, Follow-ups, Attribution & Audit Logs.
-- Forward-only additive migration. Authoring rule: top-level statements separated by blank lines, NO blank lines inside function bodies.

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  mobile text not null unique check (mobile ~ '^[6-9][0-9]{9}$'),
  raw_mobile text check (raw_mobile is null or char_length(raw_mobile) <= 30),
  email text check (email is null or (char_length(email) <= 254 and position('@' in email) > 1)),
  company_name text check (company_name is null or char_length(company_name) <= 150),
  address text check (address is null or char_length(address) <= 300),
  customer_type text not null default 'INDIVIDUAL' check (customer_type in ('INDIVIDUAL', 'CONTRACTOR', 'BUILDER', 'ARCHITECT', 'DEALER', 'COMMERCIAL', 'OTHER')),
  relationship_tier text not null default 'STANDARD' check (relationship_tier in ('STANDARD', 'REGULAR', 'PREFERRED', 'STRATEGIC')),
  is_contractor boolean not null default false,
  contractor_classification text check (contractor_classification is null or char_length(contractor_classification) <= 100),
  service_area text check (service_area is null or char_length(service_area) <= 150),
  preferred_categories text[] not null default '{}',
  preferred_brands text[] not null default '{}',
  relationship_manager_id uuid references auth.users (id) on delete set null,
  programme_status text not null default 'NONE' check (programme_status in ('NONE', 'ACTIVE', 'PAUSED', 'INACTIVE')),
  lifecycle_status text not null default 'LEAD' check (lifecycle_status in ('LEAD', 'ACTIVE', 'REPEAT', 'INACTIVE')),
  whatsapp_opt_in boolean not null default false,
  whatsapp_opt_in_at timestamptz,
  whatsapp_opt_out_at timestamptz,
  first_interaction_at timestamptz not null default now(),
  last_interaction_at timestamptz not null default now(),
  merged_into_id uuid references public.customers (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customers_mobile_idx on public.customers (mobile);

create index customers_name_idx on public.customers (lower(name));

create index customers_last_interaction_idx on public.customers (last_interaction_at desc);

create index customers_type_tier_idx on public.customers (customer_type, relationship_tier);

create trigger customers_set_updated_at before update on public.customers for each row execute function public.set_updated_at();

create table public.customer_identity_aliases (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  alias_mobile text not null unique check (alias_mobile ~ '^[6-9][0-9]{9}$'),
  alias_name text,
  source_customer_id uuid,
  merged_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index customer_identity_aliases_customer_idx on public.customer_identity_aliases (customer_id);

alter table public.enquiries add column customer_id uuid references public.customers (id) on delete set null;

create index enquiries_customer_idx on public.enquiries (customer_id, created_at desc);

alter table public.quotations add column customer_id uuid references public.customers (id) on delete set null;

create index quotations_customer_idx on public.quotations (customer_id, created_at desc);

create table public.customer_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete restrict,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customer_notes_customer_idx on public.customer_notes (customer_id, created_at desc);

create trigger customer_notes_set_updated_at before update on public.customer_notes for each row execute function public.set_updated_at();

create table public.customer_interactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  enquiry_id uuid references public.enquiries (id) on delete set null,
  interaction_type text not null check (interaction_type in ('PHONE_CALL', 'WHATSAPP', 'IN_PERSON', 'EMAIL', 'OTHER')),
  occurred_at timestamptz not null default now(),
  summary text not null check (char_length(summary) between 1 and 2000),
  next_action text check (next_action is null or char_length(next_action) <= 500),
  author_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index customer_interactions_customer_idx on public.customer_interactions (customer_id, occurred_at desc);

create table public.customer_followups (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  enquiry_id uuid references public.enquiries (id) on delete set null,
  quotation_id uuid references public.quotations (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  description text check (description is null or char_length(description) <= 1000),
  due_at timestamptz not null,
  priority text not null default 'MEDIUM' check (priority in ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  status text not null default 'PENDING' check (status in ('PENDING', 'COMPLETED', 'CANCELLED')),
  assigned_to uuid references auth.users (id) on delete set null,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customer_followups_due_idx on public.customer_followups (status, due_at asc);

create index customer_followups_customer_idx on public.customer_followups (customer_id, due_at desc);

create trigger customer_followups_set_updated_at before update on public.customer_followups for each row execute function public.set_updated_at();

create table public.acquisition_attributions (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid unique references public.enquiries (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  source text not null default 'UNKNOWN' check (source in ('GOOGLE_SEARCH', 'GOOGLE_MAPS', 'DIRECT_WEBSITE', 'WHATSAPP', 'QR_CODE', 'REFERRAL', 'SOCIAL_MEDIA', 'EXISTING_CUSTOMER', 'OTHER', 'UNKNOWN')),
  first_touch_source text not null default 'UNKNOWN',
  latest_touch_source text not null default 'UNKNOWN',
  landing_page text check (landing_page is null or char_length(landing_page) <= 500),
  referrer text check (referrer is null or char_length(referrer) <= 500),
  utm_source text check (utm_source is null or char_length(utm_source) <= 150),
  utm_medium text check (utm_medium is null or char_length(utm_medium) <= 150),
  utm_campaign text check (utm_campaign is null or char_length(utm_campaign) <= 150),
  qr_campaign text check (qr_campaign is null or char_length(qr_campaign) <= 150),
  corrected_by uuid references auth.users (id) on delete set null,
  corrected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index acquisition_attributions_source_idx on public.acquisition_attributions (source, created_at desc);

create index acquisition_attributions_customer_idx on public.acquisition_attributions (customer_id);

create trigger acquisition_attributions_set_updated_at before update on public.acquisition_attributions for each row execute function public.set_updated_at();

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  actor_type text not null default 'ADMIN' check (actor_type in ('ADMIN', 'CUSTOMER', 'SYSTEM')),
  action text not null check (char_length(action) between 1 and 100),
  entity_type text not null check (char_length(entity_type) between 1 and 60),
  entity_id text not null check (char_length(entity_id) between 1 and 100),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);

-- ── Row Level Security ──
alter table public.customers enable row level security;

alter table public.customer_identity_aliases enable row level security;

alter table public.customer_notes enable row level security;

alter table public.customer_interactions enable row level security;

alter table public.customer_followups enable row level security;

alter table public.acquisition_attributions enable row level security;

alter table public.audit_logs enable row level security;

revoke all on table public.customers, public.customer_identity_aliases, public.customer_notes, public.customer_interactions, public.customer_followups, public.acquisition_attributions, public.audit_logs from public, anon, authenticated;

grant all on table public.customers, public.customer_identity_aliases, public.customer_notes, public.customer_interactions, public.customer_followups, public.acquisition_attributions, public.audit_logs to service_role;

grant select, insert, update, delete on table public.customers, public.customer_identity_aliases, public.customer_notes, public.customer_interactions, public.customer_followups, public.acquisition_attributions to authenticated;

grant select, insert on table public.audit_logs to authenticated;

create policy admin_customers_policy on public.customers for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy admin_customer_aliases_policy on public.customer_identity_aliases for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy admin_customer_notes_policy on public.customer_notes for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy admin_customer_interactions_policy on public.customer_interactions for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy admin_customer_followups_policy on public.customer_followups for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy admin_acquisition_attributions_policy on public.acquisition_attributions for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy admin_audit_logs_policy on public.audit_logs for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ── Helper: resolve or create customer safely by normalized Indian mobile (handles concurrency & aliases) ──
create function public.resolve_customer(p_name text, p_mobile text, p_email text default null, p_address text default null, p_raw_mobile text default null) returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_customer_id uuid;
begin
  select c.id into v_customer_id from customers c where c.mobile = p_mobile and c.merged_into_id is null;
  if found then
    update customers set last_interaction_at = now(), email = coalesce(email, nullif(p_email, '')), address = coalesce(address, nullif(p_address, '')) where id = v_customer_id;
    return v_customer_id;
  end if;
  select a.customer_id into v_customer_id from customer_identity_aliases a join customers c on c.id = a.customer_id where a.alias_mobile = p_mobile and c.merged_into_id is null;
  if found then
    update customers set last_interaction_at = now(), email = coalesce(email, nullif(p_email, '')), address = coalesce(address, nullif(p_address, '')) where id = v_customer_id;
    return v_customer_id;
  end if;
  insert into customers (name, mobile, raw_mobile, email, address)
  values (p_name, p_mobile, nullif(p_raw_mobile, ''), nullif(p_email, ''), nullif(p_address, ''))
  on conflict (mobile) do update set last_interaction_at = now(), email = coalesce(customers.email, excluded.email), address = coalesce(customers.address, excluded.address)
  returning id into v_customer_id;
  return v_customer_id;
end $$;

-- ── Backfill existing enquiries and quotations into customers safely ──
insert into public.customers (name, mobile, email, address, first_interaction_at, last_interaction_at)
select distinct on (e.mobile) e.customer_name, e.mobile, e.email, e.delivery_location, min(e.created_at) over (partition by e.mobile), max(e.created_at) over (partition by e.mobile)
from public.enquiries e
order by e.mobile, e.created_at asc
on conflict (mobile) do nothing;

update public.enquiries e set customer_id = c.id from public.customers c where e.mobile = c.mobile and e.customer_id is null;

update public.quotations q set customer_id = e.customer_id from public.enquiries e where q.enquiry_id = e.id and q.customer_id is null;

-- ── Update create_enquiry: resolve customer + store optional attribution atomically ──
create or replace function public.create_enquiry(p_payload jsonb) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_key uuid := (p_payload->>'idempotency_key')::uuid;
  v_type text := p_payload->>'type';
  v_id uuid;
  v_customer_id uuid;
  v_ref text;
  v_h text;
  v_outbox uuid;
  v_item jsonb;
  v_pos integer := 0;
  v_existing record;
  v_token_hash text := p_payload->>'tracking_token_hash';
  v_token_expires timestamptz := case when p_payload->>'tracking_token_expires_at' is not null then (p_payload->>'tracking_token_expires_at')::timestamptz else (now() + interval '90 days') end;
  v_cb jsonb := p_payload->'callback';
  v_attr jsonb := p_payload->'attribution';
  v_msg text := coalesce(nullif(p_payload->>'message', ''), case when p_payload->'callback' is not null then ('Callback requested' || case when nullif(p_payload->'callback'->>'reason', '') is not null then ': ' || (p_payload->'callback'->>'reason') else '' end) else null end);
begin
  select e.id, e.reference, o.id as outbox_id into v_existing from enquiries e left join notification_outbox o on o.enquiry_id = e.id where e.idempotency_key = v_key;
  if found then
    return jsonb_build_object('id', v_existing.id, 'reference', v_existing.reference, 'outbox_id', v_existing.outbox_id, 'duplicate', true);
  end if;
  v_customer_id := public.resolve_customer(p_payload->>'name', p_payload->>'mobile', p_payload->>'email', p_payload->>'delivery_location', p_payload->>'raw_mobile');
  loop
    v_h := upper(replace(gen_random_uuid()::text, '-', ''));
    v_ref := 'ENQ-' || substr(v_h, 1, 4) || '-' || substr(v_h, 5, 4) || '-' || substr(v_h, 9, 4);
    exit when not exists (select 1 from enquiries where reference = v_ref);
  end loop;
  insert into enquiries (reference, type, customer_name, mobile, email, delivery_location, message, idempotency_key, tracking_token_hash, tracking_token_expires_at, customer_id)
  values (v_ref, v_type, p_payload->>'name', p_payload->>'mobile', nullif(p_payload->>'email', ''), nullif(p_payload->>'delivery_location', ''), v_msg, v_key, nullif(v_token_hash, ''), v_token_expires, v_customer_id)
  returning id into v_id;
  insert into enquiry_status_history (enquiry_id, previous_status, new_status, description)
  values (v_id, null, 'NEW', 'Enquiry received');
  if jsonb_typeof(p_payload->'metadata') = 'object' then
    insert into enquiry_metadata (enquiry_id, kind, data) values (v_id, p_payload->'metadata'->>'kind', p_payload->'metadata'->'data');
  end if;
  if jsonb_typeof(v_attr) = 'object' then
    insert into acquisition_attributions (enquiry_id, customer_id, source, first_touch_source, latest_touch_source, landing_page, referrer, utm_source, utm_medium, utm_campaign, qr_campaign)
    values (v_id, v_customer_id, coalesce(nullif(v_attr->>'source', ''), 'UNKNOWN'), coalesce(nullif(v_attr->>'first_touch_source', ''), coalesce(nullif(v_attr->>'source', ''), 'UNKNOWN')), coalesce(nullif(v_attr->>'latest_touch_source', ''), coalesce(nullif(v_attr->>'source', ''), 'UNKNOWN')), nullif(v_attr->>'landing_page', ''), nullif(v_attr->>'referrer', ''), nullif(v_attr->>'utm_source', ''), nullif(v_attr->>'utm_medium', ''), nullif(v_attr->>'utm_campaign', ''), nullif(v_attr->>'qr_campaign', ''));
  end if;
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
  return jsonb_build_object('id', v_id, 'reference', v_ref, 'outbox_id', v_outbox, 'customer_id', v_customer_id, 'duplicate', false);
exception when unique_violation then
  select e.id, e.reference, o.id as outbox_id into v_existing from enquiries e left join notification_outbox o on o.enquiry_id = e.id where e.idempotency_key = v_key;
  if found then
    return jsonb_build_object('id', v_existing.id, 'reference', v_existing.reference, 'outbox_id', v_existing.outbox_id, 'duplicate', true);
  end if;
  raise;
end $$;

-- ── Admin-only controlled customer merge ──
create function public.merge_customers(p_source_id uuid, p_target_id uuid) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_src customers%rowtype;
  v_tgt customers%rowtype;
begin
  if not public.is_admin() then
    raise exception 'crm: not authorised' using errcode = '42501';
  end if;
  if p_source_id = p_target_id then
    raise exception 'crm: cannot merge a customer into themselves' using errcode = '22023';
  end if;
  select * into v_src from customers where id = p_source_id for update;
  select * into v_tgt from customers where id = p_target_id for update;
  if v_src.id is null or v_tgt.id is null then
    raise exception 'crm: customer not found' using errcode = 'P0002';
  end if;
  if v_src.merged_into_id is not null or v_tgt.merged_into_id is not null then
    raise exception 'crm: cannot merge an already merged customer' using errcode = '55000';
  end if;
  update enquiries set customer_id = p_target_id where customer_id = p_source_id;
  update quotations set customer_id = p_target_id where customer_id = p_source_id;
  update customer_notes set customer_id = p_target_id where customer_id = p_source_id;
  update customer_interactions set customer_id = p_target_id where customer_id = p_source_id;
  update customer_followups set customer_id = p_target_id where customer_id = p_source_id;
  update acquisition_attributions set customer_id = p_target_id where customer_id = p_source_id;
  update customers set merged_into_id = p_target_id, lifecycle_status = 'INACTIVE' where id = p_source_id;
  update customers set first_interaction_at = least(first_interaction_at, v_src.first_interaction_at), last_interaction_at = greatest(last_interaction_at, v_src.last_interaction_at), email = coalesce(email, v_src.email), company_name = coalesce(company_name, v_src.company_name), address = coalesce(address, v_src.address) where id = p_target_id;
  insert into customer_identity_aliases (customer_id, alias_mobile, alias_name, source_customer_id, merged_by) values (p_target_id, v_src.mobile, v_src.name, p_source_id, auth.uid()) on conflict (alias_mobile) do update set customer_id = p_target_id;
  insert into audit_logs (actor_id, actor_type, action, entity_type, entity_id, details) values (auth.uid(), 'ADMIN', 'CUSTOMER_MERGED', 'customer', p_target_id::text, jsonb_build_object('source_id', p_source_id, 'source_mobile', v_src.mobile, 'target_mobile', v_tgt.mobile));
  return jsonb_build_object('merged', true, 'target_id', p_target_id, 'source_id', p_source_id);
end $$;

revoke all on function public.resolve_customer(text, text, text, text, text) from public, anon, authenticated;

grant execute on function public.resolve_customer(text, text, text, text, text) to service_role;

revoke all on function public.merge_customers(uuid, uuid) from public, anon;

grant execute on function public.merge_customers(uuid, uuid) to authenticated, service_role;
