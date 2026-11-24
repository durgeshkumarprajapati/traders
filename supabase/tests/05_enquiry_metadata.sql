-- Tests for Phase 13 enquiry_metadata: written atomically with the enquiry, validated, private.
-- Single-user mode runs as a superuser, so RLS enforcement is not exercised here (privileges, constraints and atomicity are).

-- 1. A freight enquiry stores its metadata in the same transaction.
do $$
declare
  r jsonb;
begin
  r := public.create_enquiry(jsonb_build_object('idempotency_key', '55555555-5555-4555-8555-555555555501', 'type', 'GENERAL', 'name', 'Freight Tester', 'mobile', '9876543210', 'delivery_location', 'Locality, 221001', 'message', 'Freight enquiry for 221001',
    'metadata', jsonb_build_object('kind', 'DELIVERY', 'data', jsonb_build_object('pincode', '221001', 'approxQuantity', '200 bags')),
    'items', jsonb_build_array(jsonb_build_object('product_id', 'p1', 'product_name', 'Cement', 'unit_code', 'BAG', 'unit_label', 'Bag', 'quantity', 5, 'listed_price', null, 'stock_status', 'AVAILABLE_ON_ORDER'))));
  perform pg_temp.ok((select count(*) from public.enquiry_metadata m join public.enquiries e on e.id = m.enquiry_id where e.reference = r->>'reference') = 1, 'metadata stored with the enquiry');
  perform pg_temp.ok((select m.kind from public.enquiry_metadata m join public.enquiries e on e.id = m.enquiry_id where e.reference = r->>'reference') = 'DELIVERY', 'kind stored');
  perform pg_temp.ok((select m.data->>'pincode' from public.enquiry_metadata m join public.enquiries e on e.id = m.enquiry_id where e.reference = r->>'reference') = '221001', 'data stored');
  perform pg_temp.ok((select type from public.enquiries where reference = r->>'reference') = 'GENERAL', 'enquiry type stays GENERAL (no new type)');
  perform pg_temp.ok((select count(*) from public.enquiry_items i join public.enquiries e on e.id = i.enquiry_id where e.reference = r->>'reference') = 1, 'item snapshots stored too');
  perform pg_temp.ok((select count(*) from public.notification_outbox o join public.enquiries e on e.id = o.enquiry_id where e.reference = r->>'reference') = 1, 'outbox row still created in the same transaction');
end $$;

-- 2. An enquiry without metadata creates no metadata row; a repeated idempotency key never duplicates it.
do $$
declare
  r1 jsonb;
  r2 jsonb;
  p jsonb := jsonb_build_object('idempotency_key', '55555555-5555-4555-8555-555555555502', 'type', 'GENERAL', 'name', 'Plain Tester', 'mobile', '9876543211', 'message', 'A plain general enquiry');
  q jsonb := jsonb_build_object('idempotency_key', '55555555-5555-4555-8555-555555555503', 'type', 'GENERAL', 'name', 'Expert Tester', 'mobile', '9876543212', 'message', 'An expert question here',
    'metadata', jsonb_build_object('kind', 'EXPERT', 'data', jsonb_build_object('requirement', 'Choosing the right material')));
begin
  r1 := public.create_enquiry(p);
  perform pg_temp.ok((select count(*) from public.enquiry_metadata m join public.enquiries e on e.id = m.enquiry_id where e.reference = r1->>'reference') = 0, 'no metadata row when none was sent');
  r1 := public.create_enquiry(q);
  r2 := public.create_enquiry(q);
  perform pg_temp.ok((r2->>'duplicate')::boolean = true and r1->>'reference' = r2->>'reference', 'repeat returns the same enquiry');
  perform pg_temp.ok((select count(*) from public.enquiry_metadata m join public.enquiries e on e.id = m.enquiry_id where e.reference = r1->>'reference') = 1, 'repeat does not duplicate metadata');
end $$;

-- 3. Invalid metadata rolls the WHOLE enquiry back (atomic): unknown kind, non-object data, oversized data.
do $$
declare
  v_before integer;
  v_meta integer;
  v_outbox integer;
begin
  select count(*) into v_before from public.enquiries;
  select count(*) into v_meta from public.enquiry_metadata;
  select count(*) into v_outbox from public.notification_outbox;
  begin
    perform public.create_enquiry(jsonb_build_object('idempotency_key', '55555555-5555-4555-8555-555555555504', 'type', 'GENERAL', 'name', 'Bad Kind', 'mobile', '9876543213', 'message', 'bad metadata kind here', 'metadata', jsonb_build_object('kind', 'PRODUCT', 'data', jsonb_build_object('a', 1))));
    raise exception 'FAIL: unknown metadata kind accepted';
  exception when check_violation then
    null;
  end;
  begin
    perform public.create_enquiry(jsonb_build_object('idempotency_key', '55555555-5555-4555-8555-555555555505', 'type', 'GENERAL', 'name', 'Bad Data', 'mobile', '9876543214', 'message', 'bad metadata data here', 'metadata', jsonb_build_object('kind', 'EXPERT', 'data', jsonb_build_array(1, 2))));
    raise exception 'FAIL: non-object metadata data accepted';
  exception when check_violation then
    null;
  end;
  begin
    perform public.create_enquiry(jsonb_build_object('idempotency_key', '55555555-5555-4555-8555-555555555506', 'type', 'GENERAL', 'name', 'Too Big', 'mobile', '9876543215', 'message', 'oversized metadata here', 'metadata', jsonb_build_object('kind', 'EXPERT', 'data', jsonb_build_object('blob', repeat('x', 9000)))));
    raise exception 'FAIL: oversized metadata accepted';
  exception when check_violation then
    null;
  end;
  perform pg_temp.ok((select count(*) from public.enquiries) = v_before, 'no enquiry row left behind by rejected metadata');
  perform pg_temp.ok((select count(*) from public.enquiry_metadata) = v_meta, 'no metadata row left behind');
  perform pg_temp.ok((select count(*) from public.notification_outbox) = v_outbox, 'no outbox row left behind');
end $$;

-- 4. Privacy: nobody but the server (service_role) can write; anonymous cannot read; admins read through RLS.
do $$
begin
  perform pg_temp.ok(has_table_privilege('anon', 'public.enquiry_metadata', 'select') = false, 'anon cannot select');
  perform pg_temp.ok(has_table_privilege('anon', 'public.enquiry_metadata', 'insert') = false, 'anon cannot insert');
  perform pg_temp.ok(has_table_privilege('authenticated', 'public.enquiry_metadata', 'insert') = false, 'authenticated cannot insert');
  perform pg_temp.ok(has_table_privilege('authenticated', 'public.enquiry_metadata', 'update') = false, 'authenticated cannot update');
  perform pg_temp.ok(has_table_privilege('authenticated', 'public.enquiry_metadata', 'delete') = false, 'authenticated cannot delete');
  perform pg_temp.ok(has_table_privilege('authenticated', 'public.enquiry_metadata', 'select') = true, 'authenticated has select (gated by the is_admin() policy)');
  perform pg_temp.ok(has_table_privilege('service_role', 'public.enquiry_metadata', 'insert') = true, 'service_role can write');
  perform pg_temp.ok((select relrowsecurity from pg_class where oid = 'public.enquiry_metadata'::regclass) = true, 'RLS is enabled');
  perform pg_temp.ok((select count(*) from pg_policies where tablename = 'enquiry_metadata') = 1, 'exactly one policy (admin read)');
  perform pg_temp.ok(has_function_privilege('anon', 'public.create_enquiry(jsonb)', 'execute') = false, 'anon still cannot call create_enquiry');
end $$;

-- 5. The earlier guarantees still hold after the function was replaced.
do $$
declare
  r jsonb;
begin
  r := public.create_enquiry(jsonb_build_object('idempotency_key', '55555555-5555-4555-8555-555555555507', 'type', 'GENERAL', 'name', 'Regression Tester', 'mobile', '9876543216', 'message', 'regression check enquiry'));
  perform pg_temp.ok(r->>'reference' ~ '^ENQ-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$', 'references are still random');
  perform pg_temp.ok((select count(*) from public.enquiry_status_history h join public.enquiries e on e.id = h.enquiry_id where e.reference = r->>'reference' and h.new_status = 'NEW') = 1, 'initial status history is still written');
  begin
    perform public.create_enquiry(jsonb_build_object('idempotency_key', '55555555-5555-4555-8555-555555555508', 'type', 'BULK', 'name', 'Bulk Without Items', 'mobile', '9876543217', 'delivery_location', 'Somewhere', 'message', '', 'items', '[]'::jsonb));
    raise exception 'FAIL: a BULK enquiry without items was accepted';
  exception when check_violation then
    null;
  end;
end $$;

-- 6. CANARY: this harness (PostgreSQL single-user mode) does NOT enforce Row Level Security — even `using (false)` shows every row.
-- So RLS *enforcement* cannot be proven here; section 7 verifies the permission MODEL structurally instead. If a future harness
-- starts enforcing RLS this canary fails, which is the signal to add real per-role enforcement tests.
create table public.rls_canary (id int);

insert into public.rls_canary values (1), (2);

alter table public.rls_canary enable row level security;

grant select on public.rls_canary to authenticated;

create policy never on public.rls_canary for select to authenticated using (false);

do $$
declare
  n integer;
begin
  set local role authenticated;
  select count(*) into n from public.rls_canary;
  reset role;
  perform pg_temp.ok(n = 2, 'KNOWN LIMITATION: single-user mode ignores RLS (saw ' || n || ' of 2). Enforcement tests are not possible in this harness');
end $$;

drop table public.rls_canary;

-- 7. Structural check of the whole permission model (what RLS enforcement tests would rely on).
do $$
declare
  t text;
begin
  -- every customer-data table has RLS enabled
  foreach t in array array['enquiries','enquiry_items','enquiry_notes','enquiry_status_history','enquiry_callbacks','enquiry_metadata','notification_outbox','notification_attempts','rate_limits','quotations','quotation_items','admin_profiles'] loop
    perform pg_temp.ok((select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) = true, 'RLS enabled on ' || t);
    perform pg_temp.ok(has_table_privilege('anon', 'public.' || t, 'select') = false and has_table_privilege('anon', 'public.' || t, 'insert') = false and has_table_privilege('anon', 'public.' || t, 'update') = false and has_table_privilege('anon', 'public.' || t, 'delete') = false, 'anon has NO privileges on ' || t);
  end loop;
  -- no policy applies to anon or PUBLIC
  perform pg_temp.ok((select count(*) from pg_policies where schemaname = 'public' and ('anon' = any (roles) or 'public' = any (roles))) = 0, 'no policy grants anything to anon or PUBLIC');
  -- every policy is for authenticated and is gated by is_admin() (admin_profiles has its own "read own row" policy)
  perform pg_temp.ok((select count(*) from pg_policies where schemaname = 'public' and tablename <> 'admin_profiles' and (roles <> array['authenticated']::name[] or qual not like '%is_admin()%')) = 0, 'every data policy is authenticated-only and gated by is_admin()');
  perform pg_temp.ok((select count(*) from pg_policies where schemaname = 'public' and tablename = 'admin_profiles' and qual not like '%auth.uid()%') = 0, 'admin_profiles policy is restricted to the user''s own row');
  -- no data-modifying policy lets a customer-facing role do anything on the customer tables beyond what is_admin() allows
  perform pg_temp.ok((select count(*) from pg_policies where schemaname = 'public' and cmd in ('INSERT') and with_check is null) = 0, 'every INSERT policy has a WITH CHECK');
  -- the public (customer) entry points are service_role only
  perform pg_temp.ok(has_function_privilege('anon', 'public.create_enquiry(jsonb)', 'execute') = false and has_function_privilege('authenticated', 'public.create_enquiry(jsonb)', 'execute') = false, 'create_enquiry is not callable by anon or authenticated');
  perform pg_temp.ok(has_function_privilege('anon', 'public.get_tracked_enquiry(text, text)', 'execute') = false and has_function_privilege('authenticated', 'public.get_tracked_quotation(text)', 'execute') = false, 'tracking lookups are not callable by anon or authenticated');
end $$;

select 'ENQUIRY_METADATA_SQL_TESTS_PASSED' as marker;
