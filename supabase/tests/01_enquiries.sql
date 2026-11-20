-- Self-asserting tests: any failed assertion raises an exception → "ERROR:" in the output → the harness fails.
create function pg_temp.ok(c boolean, m text) returns void language plpgsql as $$
begin
  if c is not true then
    raise exception 'FAIL: %', m;
  end if;
end $$;

create function pg_temp.bulk_payload(p_key text, p_items jsonb) returns jsonb language sql as $$
  select jsonb_build_object('idempotency_key', p_key, 'type', 'BULK', 'name', 'Asha Rao', 'mobile', '9876543210', 'email', '', 'delivery_location', 'Pune site', 'message', '', 'items', p_items)
$$;

create function pg_temp.item(p_id text, p_qty numeric, p_price numeric default null, p_unit text default 'BAG') returns jsonb language sql as $$
  select jsonb_build_object('product_id', p_id, 'sku', null, 'product_name', 'Product ' || p_id, 'brand_name', 'Brand One', 'unit_code', p_unit, 'unit_label', 'Unit', 'quantity', p_qty, 'listed_price', p_price, 'stock_status', 'AVAILABLE_ON_ORDER')
$$;

-- 1. A BULK enquiry persists the enquiry, ALL item snapshots and the outbox row together.
do $$
declare
  r jsonb;
begin
  r := public.create_enquiry(pg_temp.bulk_payload('11111111-1111-1111-1111-111111111111', jsonb_build_array(
    jsonb_build_object('product_id', 'p1', 'sku', 'C-1', 'product_name', 'Cement PPC', 'brand_name', 'Brand One', 'unit_code', 'BAG', 'unit_label', 'Bag', 'quantity', 2.5, 'listed_price', 385, 'stock_status', 'IN_STOCK'),
    jsonb_build_object('product_id', 'p2', 'product_name', 'TMT 12mm', 'unit_code', 'CUSTOM', 'unit_label', 'Set', 'quantity', 3, 'listed_price', null, 'stock_status', 'AVAILABLE_ON_ORDER'))));
  perform pg_temp.ok(r->>'reference' ~ '^ENQ-[0-9]{4}-[0-9]{6}$', 'reference format');
  perform pg_temp.ok((r->>'duplicate')::boolean = false, 'first submission is not a duplicate');
  perform pg_temp.ok((select count(*) from enquiries) = 1, 'one enquiry');
  perform pg_temp.ok((select status from enquiries) = 'NEW', 'default status NEW');
  perform pg_temp.ok((select email from enquiries) is null, 'blank email stored as NULL');
  perform pg_temp.ok((select count(*) from enquiry_items) = 2, 'two item snapshots');
  perform pg_temp.ok((select quantity from enquiry_items where product_id = 'p1') = 2.5, 'decimal quantity preserved');
  perform pg_temp.ok((select listed_price from enquiry_items where product_id = 'p1') = 385, 'listed price snapshot');
  perform pg_temp.ok((select listed_price from enquiry_items where product_id = 'p2') is null, 'missing price stays NULL, never 0');
  perform pg_temp.ok((select unit_label from enquiry_items where product_id = 'p2') = 'Set' and (select unit_code from enquiry_items where product_id = 'p2') = 'CUSTOM', 'custom unit snapshot');
  perform pg_temp.ok((select stock_status from enquiry_items where product_id = 'p2') = 'AVAILABLE_ON_ORDER', 'AVAILABLE_ON_ORDER snapshot');
  perform pg_temp.ok((select count(*) from notification_outbox where enquiry_id = (r->>'id')::uuid and status = 'PENDING' and attempt_count = 0) = 1, 'outbox row created PENDING in the same transaction');
  perform pg_temp.ok((r->>'outbox_id')::uuid = (select id from notification_outbox), 'outbox id returned');
end $$;

-- 2. Idempotency: the same key returns the SAME enquiry and creates nothing new.
do $$
declare
  r1 jsonb;
  r2 jsonb;
begin
  r1 := public.create_enquiry(pg_temp.bulk_payload('11111111-1111-1111-1111-111111111111', jsonb_build_array(pg_temp.item('p1', 9))));
  r2 := public.create_enquiry(pg_temp.bulk_payload('11111111-1111-1111-1111-111111111111', jsonb_build_array(pg_temp.item('p1', 9))));
  perform pg_temp.ok((r1->>'duplicate')::boolean and (r2->>'duplicate')::boolean, 'repeat is flagged duplicate');
  perform pg_temp.ok(r1->>'reference' = r2->>'reference', 'same reference returned');
  perform pg_temp.ok((select count(*) from enquiries) = 1, 'no second enquiry');
  perform pg_temp.ok((select count(*) from enquiry_items) = 2, 'items not duplicated or replaced');
  perform pg_temp.ok((select count(*) from notification_outbox) = 1, 'no second outbox row (no duplicate notification)');
end $$;

-- 3. Atomic rollback: a failure at ANY step leaves nothing behind (no enquiry, items or outbox row).
do $$
declare
  v_enq integer;
  v_items integer;
  v_outbox integer;
  v_seen boolean;
  v_case record;
begin
  select count(*) into v_enq from enquiries;
  select count(*) into v_items from enquiry_items;
  select count(*) into v_outbox from notification_outbox;
  for v_case in
    select * from (values
      ('quantity zero', pg_temp.bulk_payload('22222222-0000-0000-0000-000000000001', jsonb_build_array(pg_temp.item('a', 1), pg_temp.item('b', 0)))),
      ('negative quantity', pg_temp.bulk_payload('22222222-0000-0000-0000-000000000002', jsonb_build_array(pg_temp.item('a', -1)))),
      ('price zero is rejected, not stored', pg_temp.bulk_payload('22222222-0000-0000-0000-000000000003', jsonb_build_array(pg_temp.item('a', 1, 0)))),
      ('unknown unit', pg_temp.bulk_payload('22222222-0000-0000-0000-000000000004', jsonb_build_array(pg_temp.item('a', 1, 10, 'BOGUS')))),
      ('duplicate product ids', pg_temp.bulk_payload('22222222-0000-0000-0000-000000000005', jsonb_build_array(pg_temp.item('a', 1), pg_temp.item('a', 2)))),
      ('bulk without items', pg_temp.bulk_payload('22222222-0000-0000-0000-000000000006', '[]'::jsonb)),
      ('invalid mobile', jsonb_set(pg_temp.bulk_payload('22222222-0000-0000-0000-000000000007', jsonb_build_array(pg_temp.item('a', 1))), '{mobile}', '"12345"')),
      ('bulk without location', jsonb_set(pg_temp.bulk_payload('22222222-0000-0000-0000-000000000008', jsonb_build_array(pg_temp.item('a', 1))), '{delivery_location}', '""')),
      ('quantity too large', pg_temp.bulk_payload('22222222-0000-0000-0000-000000000009', jsonb_build_array(pg_temp.item('a', 1000001))))
    ) as t(label, payload)
  loop
    v_seen := false;
    begin
      perform public.create_enquiry(v_case.payload);
    exception when others then
      v_seen := true;
    end;
    perform pg_temp.ok(v_seen, 'must be rejected: ' || v_case.label);
    perform pg_temp.ok((select count(*) from enquiries) = v_enq, 'rolled back enquiry: ' || v_case.label);
    perform pg_temp.ok((select count(*) from enquiry_items) = v_items, 'rolled back items: ' || v_case.label);
    perform pg_temp.ok((select count(*) from notification_outbox) = v_outbox, 'rolled back outbox: ' || v_case.label);
  end loop;
end $$;

-- 4. GENERAL enquiries need no items but do need a real message.
do $$
declare
  r jsonb;
  v_seen boolean := false;
begin
  r := public.create_enquiry(jsonb_build_object('idempotency_key', '33333333-3333-3333-3333-333333333333', 'type', 'GENERAL', 'name', 'Ravi Kumar', 'mobile', '9123456789', 'email', 'ravi@example.test', 'message', 'I need a quotation please'));
  perform pg_temp.ok((select type from enquiries where id = (r->>'id')::uuid) = 'GENERAL', 'GENERAL stored');
  perform pg_temp.ok((select count(*) from enquiry_items where enquiry_id = (r->>'id')::uuid) = 0, 'no items required');
  perform pg_temp.ok((select count(*) from notification_outbox where enquiry_id = (r->>'id')::uuid) = 1, 'GENERAL also gets an outbox row');
  begin
    perform public.create_enquiry(jsonb_build_object('idempotency_key', '33333333-3333-3333-3333-333333333334', 'type', 'GENERAL', 'name', 'Ravi Kumar', 'mobile', '9123456789', 'message', 'short'));
  exception when check_violation then
    v_seen := true;
  end;
  perform pg_temp.ok(v_seen, 'GENERAL message too short is rejected');
  v_seen := false;
  begin
    perform public.create_enquiry(jsonb_build_object('idempotency_key', '33333333-3333-3333-3333-333333333335', 'type', 'PRODUCT', 'name', 'Ravi Kumar', 'mobile', '9123456789', 'message', 'I need a quotation please'));
  exception when check_violation then
    v_seen := true;
  end;
  perform pg_temp.ok(v_seen, 'only BULK and GENERAL exist: PRODUCT is rejected');
end $$;

-- 5. Statuses are constrained; the updated_at trigger fires.
do $$
declare
  s text;
  v_seen boolean := false;
begin
  foreach s in array array['NEW', 'CONTACTED', 'QUOTATION_SENT', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] loop
    update enquiries set status = s where reference = (select reference from enquiries order by created_at limit 1);
  end loop;
  begin
    update enquiries set status = 'BOGUS';
  exception when check_violation then
    v_seen := true;
  end;
  perform pg_temp.ok(v_seen, 'unknown status rejected');
  update enquiries set status = 'NEW';
end $$;

do $$
begin
  perform pg_temp.ok((select bool_and(updated_at > created_at) from enquiries), 'updated_at advanced by the trigger');
end $$;

-- 6. Outbox: lease, failure with backoff, retry, success, stale writers, idempotent end state.
do $$
declare
  v_outbox uuid;
  v_ref text;
  c jsonb;
  rec jsonb;
begin
  select o.id, e.reference into v_outbox, v_ref from notification_outbox o join enquiries e on e.id = o.enquiry_id where e.type = 'BULK';
  c := public.claim_notification(v_outbox);
  perform pg_temp.ok(c is not null and (c->>'attempt_number')::int = 1, 'first claim is attempt 1');
  perform pg_temp.ok(c->'enquiry'->>'reference' = v_ref and jsonb_array_length(c->'items') = 2, 'claim returns enquiry + snapshots');
  perform pg_temp.ok(not (c->'enquiry' ? 'idempotency_key'), 'idempotency key is not leaked to the email builder');
  perform pg_temp.ok(public.claim_notification(v_outbox) is null, 'second concurrent claim is refused while the lease is held');
  rec := public.record_notification_attempt(v_outbox, 1, 'FAILURE', 502, 'HTTP_502', 'provider unavailable', true);
  perform pg_temp.ok((rec->>'recorded')::boolean and rec->>'status' = 'FAILED', 'failure recorded');
  perform pg_temp.ok((select status = 'FAILED' and next_attempt_at > now() and last_error = 'provider unavailable' from notification_outbox where id = v_outbox), 'FAILED with backoff in the future');
  perform pg_temp.ok(public.claim_notification(v_outbox) is null, 'no claim during backoff');
  update notification_outbox set next_attempt_at = now() - interval '1 second' where id = v_outbox;
  c := public.claim_notification(v_outbox);
  perform pg_temp.ok((c->>'attempt_number')::int = 2, 'retry is attempt 2');
  rec := public.record_notification_attempt(v_outbox, 2, 'SUCCESS', 200, null, null, true);
  perform pg_temp.ok(rec->>'status' = 'SENT', 'success recorded');
  perform pg_temp.ok((select status = 'SENT' and sent_at is not null and last_error is null from notification_outbox where id = v_outbox), 'SENT state');
  perform pg_temp.ok((select count(*) from notification_attempts where outbox_id = v_outbox) = 2, 'both attempts are audited');
  perform pg_temp.ok(public.claim_notification(v_outbox) is null, 'a SENT notification can never be claimed again (no duplicate email)');
  perform pg_temp.ok(public.retry_notification(v_outbox)->>'reason' = 'ALREADY_SENT', 'manual retry refuses SENT rows');
  rec := public.record_notification_attempt(v_outbox, 1, 'SUCCESS');
  perform pg_temp.ok(not (rec->>'recorded')::boolean, 'a stale writer cannot overwrite state');
  perform pg_temp.ok((select count(*) from notification_attempts where outbox_id = v_outbox) = 2, 'stale write added no attempt row');
end $$;

-- 7. Lease expiry lets another worker take over; the old worker's late result is ignored.
do $$
declare
  v_outbox uuid;
  c jsonb;
  rec jsonb;
begin
  select o.id into v_outbox from notification_outbox o join enquiries e on e.id = o.enquiry_id where e.type = 'GENERAL';
  c := public.claim_notification(v_outbox, 30);
  perform pg_temp.ok((c->>'attempt_number')::int = 1, 'attempt 1 claimed');
  update notification_outbox set locked_until = now() - interval '1 second' where id = v_outbox;
  c := public.claim_notification(v_outbox);
  perform pg_temp.ok((c->>'attempt_number')::int = 2, 'expired lease is re-claimable as attempt 2');
  rec := public.record_notification_attempt(v_outbox, 1, 'SUCCESS');
  perform pg_temp.ok(not (rec->>'recorded')::boolean, 'late result from the old worker is ignored');
  rec := public.record_notification_attempt(v_outbox, 2, 'FAILURE', null, 'TIMEOUT', 'timed out', false);
  perform pg_temp.ok(rec->>'status' = 'FAILED' and rec->'retry_in_seconds' = 'null'::jsonb, 'non-retryable failure');
  perform pg_temp.ok((select next_attempt_at = 'infinity' from notification_outbox where id = v_outbox), 'non-retryable ⇒ never retried automatically');
  perform pg_temp.ok(not (public.list_due_notifications(10) @> to_jsonb(v_outbox::text)), 'not listed as due');
  perform pg_temp.ok((public.retry_notification(v_outbox)->>'retried')::boolean, 'manual retry resets it');
  perform pg_temp.ok((select status = 'PENDING' and max_attempts >= attempt_count + 3 from notification_outbox where id = v_outbox), 'PENDING again with headroom');
  perform pg_temp.ok(public.list_due_notifications(10) @> to_jsonb(v_outbox::text), 'now listed as due');
end $$;

-- 8. Attempt ceiling: exhausted rows are not claimed or listed; a dead lease on the last attempt is closed as FAILED.
do $$
declare
  v_outbox uuid;
begin
  select o.id into v_outbox from notification_outbox o join enquiries e on e.id = o.enquiry_id where e.type = 'GENERAL';
  update notification_outbox set status = 'IN_PROGRESS', attempt_count = max_attempts, locked_until = now() - interval '1 second' where id = v_outbox;
  perform pg_temp.ok(not (public.list_due_notifications(10) @> to_jsonb(v_outbox::text)), 'exhausted row is not due');
  perform pg_temp.ok((select status from notification_outbox where id = v_outbox) = 'FAILED', 'dead lease on the final attempt is closed as FAILED');
  perform pg_temp.ok(public.claim_notification(v_outbox) is null, 'exhausted row cannot be claimed');
  perform pg_temp.ok(public.retry_notification('00000000-0000-0000-0000-00000000dead')->>'reason' = 'NOT_FOUND', 'unknown id');
end $$;

-- 9. Shared rate limiter.
do $$
declare
  r jsonb;
  i integer;
begin
  for i in 1..3 loop
    r := public.check_rate_limit('test:ip:abc', 3, 60);
    perform pg_temp.ok((r->>'allowed')::boolean, 'hit ' || i || ' allowed');
  end loop;
  r := public.check_rate_limit('test:ip:abc', 3, 60);
  perform pg_temp.ok(not (r->>'allowed')::boolean and (r->>'retry_after_seconds')::int >= 1, 'fourth hit blocked with retry-after');
  perform pg_temp.ok((public.check_rate_limit('test:ip:other', 3, 60)->>'allowed')::boolean, 'other keys are independent');
  update rate_limits set window_start = now() - interval '61 seconds' where key = 'test:ip:abc';
  r := public.check_rate_limit('test:ip:abc', 3, 60);
  perform pg_temp.ok((r->>'allowed')::boolean and (r->>'hits')::int = 1, 'new window resets the counter');
  update rate_limits set window_start = now() - interval '2 days';
  perform pg_temp.ok(public.purge_rate_limits(86400) >= 1, 'stale windows are purged');
end $$;

-- 10. Row Level Security and privileges.
do $$
declare
  t text;
  f record;
begin
  perform pg_temp.ok((select count(*) from pg_policies where schemaname = 'public') = 0, 'no policies yet: nothing is readable by anon/authenticated');
  foreach t in array array['enquiries', 'enquiry_items', 'enquiry_notes', 'notification_outbox', 'notification_attempts', 'rate_limits'] loop
    perform pg_temp.ok((select relrowsecurity from pg_class where oid = ('public.' || t)::regclass), 'RLS enabled on ' || t);
    perform pg_temp.ok(not has_table_privilege('anon', 'public.' || t, 'select, insert, update, delete'), 'anon has no table privileges on ' || t);
    perform pg_temp.ok(not has_table_privilege('authenticated', 'public.' || t, 'select, insert, update, delete'), 'authenticated has no table privileges on ' || t);
    perform pg_temp.ok(has_table_privilege('service_role', 'public.' || t, 'select, insert, update, delete'), 'service_role keeps access to ' || t);
  end loop;
  for f in select p.oid::regprocedure as sig from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('create_enquiry', 'claim_notification', 'record_notification_attempt', 'list_due_notifications', 'retry_notification', 'check_rate_limit', 'purge_rate_limits') loop
    perform pg_temp.ok(not has_function_privilege('anon', f.sig, 'execute'), 'anon cannot execute ' || f.sig::text);
    perform pg_temp.ok(not has_function_privilege('authenticated', f.sig, 'execute'), 'authenticated cannot execute ' || f.sig::text);
    perform pg_temp.ok(has_function_privilege('service_role', f.sig, 'execute'), 'service_role can execute ' || f.sig::text);
  end loop;
end $$;

-- NOTE: RLS *enforcement* cannot be exercised in PostgreSQL standalone single-user mode (the backend is an unrestricted
-- superuser, so even a trivial policy has no effect). What is verified above: RLS is ENABLED on every table, there are NO
-- policies (default deny), and anon/authenticated have no table or function privileges. The privilege layer IS enforced below.

set role anon;

do $$
declare
  v_seen boolean := false;
begin
  begin
    perform count(*) from public.enquiries;
  exception when insufficient_privilege then
    v_seen := true;
  end;
  if not v_seen then
    raise exception 'FAIL: anon must not read enquiries';
  end if;
  v_seen := false;
  begin
    perform public.create_enquiry('{}'::jsonb);
  exception when insufficient_privilege then
    v_seen := true;
  end;
  if not v_seen then
    raise exception 'FAIL: anon must not call create_enquiry';
  end if;
end $$;

reset role;

set role authenticated;

do $$
declare
  v_seen boolean := false;
begin
  begin
    perform count(*) from public.enquiry_items;
  exception when insufficient_privilege then
    v_seen := true;
  end;
  if not v_seen then
    raise exception 'FAIL: authenticated must not read items';
  end if;
  v_seen := false;
  begin
    perform public.check_rate_limit('x', 1, 1);
  exception when insufficient_privilege then
    v_seen := true;
  end;
  if not v_seen then
    raise exception 'FAIL: authenticated must not call functions';
  end if;
end $$;

reset role;

set role service_role;

do $$
begin
  if (select count(*) from public.enquiries) < 1 then
    raise exception 'FAIL: service_role must read enquiries';
  end if;
  perform public.list_due_notifications(1);
end $$;

reset role;

select 'SQL_TESTS_PASSED'::text as marker;
