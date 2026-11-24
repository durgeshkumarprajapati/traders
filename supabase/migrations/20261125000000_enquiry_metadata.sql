-- Sagar Traders — Phase 13: structured details for freight (delivery) and "ask an expert" enquiries.
-- Forward-only. Reuses the existing GENERAL enquiry type (no new enquiry type or status); the structured, validated details live in
-- one small table written in the SAME transaction as the enquiry by create_enquiry. Authoring rule for the test harness: top-level
-- statements are separated by blank lines and there are NO blank lines inside function bodies.

create table public.enquiry_metadata (
  enquiry_id uuid primary key references public.enquiries (id) on delete cascade,
  kind text not null check (kind in ('DELIVERY', 'EXPERT')),
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 8192),
  created_at timestamptz not null default now()
);

create index enquiry_metadata_kind_idx on public.enquiry_metadata (kind, created_at desc);

alter table public.enquiry_metadata enable row level security;

revoke all on table public.enquiry_metadata from public, anon, authenticated;

grant all on table public.enquiry_metadata to service_role;

-- Administrators may READ the details (through RLS); only the server-side create_enquiry function writes them.
grant select on table public.enquiry_metadata to authenticated;

create policy admin_enquiry_metadata_read on public.enquiry_metadata for select to authenticated using (public.is_admin());

-- create_enquiry: unchanged behaviour, plus an optional payload->'metadata' {kind, data} stored atomically with the enquiry.
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
  if jsonb_typeof(p_payload->'metadata') = 'object' then
    insert into enquiry_metadata (enquiry_id, kind, data) values (v_id, p_payload->'metadata'->>'kind', p_payload->'metadata'->'data');
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
  return jsonb_build_object('id', v_id, 'reference', v_ref, 'outbox_id', v_outbox, 'duplicate', false);
exception when unique_violation then
  select e.id, e.reference, o.id as outbox_id into v_existing from enquiries e left join notification_outbox o on o.enquiry_id = e.id where e.idempotency_key = v_key;
  if found then
    return jsonb_build_object('id', v_existing.id, 'reference', v_existing.reference, 'outbox_id', v_existing.outbox_id, 'duplicate', true);
  end if;
  raise;
end $$;
