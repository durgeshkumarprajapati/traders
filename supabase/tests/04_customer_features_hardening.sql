-- Tests for the hardening migration: random references, atomic quotations, immutability, token rotation, audit.
-- Single-user mode runs as a superuser: RLS enforcement is not exercised here, but the function-level is_admin() gate,
-- triggers, constraints, atomicity and privileges are.

create table pg_temp.ctx (k text primary key, v text);

-- 1. Public enquiry references are random, well-formed, unique and not derived from a counter.
do $$
declare
  r1 jsonb;
  r2 jsonb;
begin
  r1 := public.create_enquiry(jsonb_build_object('idempotency_key', '44444444-4444-4444-4444-444444444401', 'type', 'GENERAL', 'name', 'Ref Tester One', 'mobile', '9876543210', 'message', 'Please call me about cement rates'));
  r2 := public.create_enquiry(jsonb_build_object('idempotency_key', '44444444-4444-4444-4444-444444444402', 'type', 'GENERAL', 'name', 'Ref Tester Two', 'mobile', '9876543211', 'message', 'Please call me about steel rates'));
  perform pg_temp.ok(r1->>'reference' ~ '^ENQ-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$', 'new reference is ENQ-XXXX-XXXX-XXXX (hex)');
  perform pg_temp.ok(r1->>'reference' <> r2->>'reference', 'two references differ');
  perform pg_temp.ok(r1->>'reference' !~ '^ENQ-[0-9]{4}-[0-9]{6}$', 'reference is no longer the sequential format');
  perform pg_temp.ok((public.create_enquiry(jsonb_build_object('idempotency_key', '44444444-4444-4444-4444-444444444401', 'type', 'GENERAL', 'name', 'Ref Tester One', 'mobile', '9876543210', 'message', 'Please call me about cement rates'))->>'reference') = r1->>'reference', 'a repeated idempotency key still returns the SAME reference');
  perform pg_temp.ok((select count(*) from public.enquiry_status_history h join public.enquiries e on e.id = h.enquiry_id where e.reference = r1->>'reference' and h.new_status = 'NEW') = 1, 'initial status history row exists');
end $$;

-- 2. Admin gate: a non-admin caller can neither draft, issue, rotate nor revoke.
do $$
declare
  v_enq uuid;
  v_count integer;
begin
  select id into v_enq from public.enquiries where idempotency_key = '44444444-4444-4444-4444-444444444401';
  select count(*) into v_count from public.quotations;
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform public.create_quotation_draft(jsonb_build_object('enquiry_id', v_enq, 'valid_days', 7, 'items', jsonb_build_array(jsonb_build_object('product_name', 'X', 'unit_code', 'BAG', 'unit_label', 'Bag', 'quantity', 1, 'unit_price', 10))));
    raise exception 'FAIL: anonymous caller created a quotation';
  exception when insufficient_privilege then
    null;
  end;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a3', true);
  begin
    perform public.create_quotation_draft(jsonb_build_object('enquiry_id', v_enq, 'valid_days', 7, 'items', jsonb_build_array(jsonb_build_object('product_name', 'X', 'unit_code', 'BAG', 'unit_label', 'Bag', 'quantity', 1, 'unit_price', 10))));
    raise exception 'FAIL: non-admin user created a quotation';
  exception when insufficient_privilege then
    null;
  end;
  perform pg_temp.ok((select count(*) from public.quotations) = v_count, 'no quotation rows were created by unauthorised callers');
  perform pg_temp.ok(has_function_privilege('anon', 'public.create_quotation_draft(jsonb)', 'execute') = false, 'anon has no execute on create_quotation_draft');
  perform pg_temp.ok(has_function_privilege('anon', 'public.issue_quotation(uuid, text, timestamptz)', 'execute') = false, 'anon has no execute on issue_quotation');
  perform pg_temp.ok(has_function_privilege('authenticated', 'public.issue_quotation(uuid, text, timestamptz)', 'execute') = true, 'authenticated can call issue_quotation (is_admin() gates it)');
end $$;

-- 3. Exact arithmetic is computed by the database; invalid input is rejected and nothing is partially written.
do $$
declare
  v_enq uuid;
  r jsonb;
  v_before integer;
begin
  select id into v_enq from public.enquiries where reference = (select reference from public.enquiries where idempotency_key = '44444444-4444-4444-4444-444444444401');
  insert into pg_temp.ctx values ('enq', v_enq::text);
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
  r := public.create_quotation_draft(jsonb_build_object('enquiry_id', v_enq, 'valid_days', 7, 'discount_amount', 0.10, 'tax_amount', 0, 'terms', '  ', 'items', jsonb_build_array(
    jsonb_build_object('product_name', 'Cement PPC', 'unit_code', 'BAG', 'unit_label', 'Bag', 'quantity', 3, 'unit_price', 0.10),
    jsonb_build_object('product_name', 'Sand', 'unit_code', 'CUBIC_FEET', 'unit_label', 'cu ft', 'quantity', 0.333, 'unit_price', 0.30))));
  perform pg_temp.ok((r->>'subtotal')::numeric = 0.40, 'subtotal is exact: 3 x 0.10 + round(0.333 x 0.30 = 0.0999) = 0.30 + 0.10');
  perform pg_temp.ok((r->>'total_amount')::numeric = 0.30, 'total = subtotal - discount + tax');
  perform pg_temp.ok((r->>'version')::int = 1, 'first version is 1');
  perform pg_temp.ok(r->>'reference' ~ '^QUO-[0-9]{4}-[0-9]{6}$', 'quotation reference format');
  perform pg_temp.ok((select terms_and_conditions from public.quotations where id = (r->>'id')::uuid) is null, 'blank terms are stored as NULL (no invented default terms)');
  perform pg_temp.ok((select count(*) from public.quotation_items where quotation_id = (r->>'id')::uuid) = 2, 'two line items stored with the draft');
  select count(*) into v_before from public.quotations;
  begin
    perform public.create_quotation_draft(jsonb_build_object('enquiry_id', v_enq, 'valid_days', 7, 'items', jsonb_build_array(jsonb_build_object('product_name', 'Zero rate', 'unit_code', 'BAG', 'unit_label', 'Bag', 'quantity', 1, 'unit_price', 0))));
    raise exception 'FAIL: zero rate accepted';
  exception when invalid_parameter_value then
    null;
  end;
  begin
    perform public.create_quotation_draft(jsonb_build_object('enquiry_id', v_enq, 'valid_days', 7, 'discount_amount', 5, 'items', jsonb_build_array(jsonb_build_object('product_name', 'A', 'unit_code', 'BAG', 'unit_label', 'Bag', 'quantity', 1, 'unit_price', 1))));
    raise exception 'FAIL: discount above subtotal accepted';
  exception when invalid_parameter_value then
    null;
  end;
  begin
    perform public.create_quotation_draft(jsonb_build_object('enquiry_id', v_enq, 'valid_days', 0, 'items', jsonb_build_array(jsonb_build_object('product_name', 'A', 'unit_code', 'BAG', 'unit_label', 'Bag', 'quantity', 1, 'unit_price', 1))));
    raise exception 'FAIL: zero validity accepted';
  exception when invalid_parameter_value then
    null;
  end;
  begin
    perform public.create_quotation_draft(jsonb_build_object('enquiry_id', v_enq, 'valid_days', 7, 'items', jsonb_build_array(jsonb_build_object('product_name', 'Bad unit', 'unit_code', 'FURLONG', 'unit_label', 'f', 'quantity', 1, 'unit_price', 1))));
    raise exception 'FAIL: unknown unit accepted';
  exception when check_violation then
    null;
  end;
  perform pg_temp.ok((select count(*) from public.quotations) = v_before, 'rejected drafts left NO quotation rows behind (atomic)');
  perform pg_temp.ok((select count(*) from public.quotation_items i where not exists (select 1 from public.quotations q where q.id = i.quotation_id)) = 0, 'no orphan line items');
end $$;

-- 4. Issue: DRAFT only, real previous status recorded, earlier versions superseded, content immutable afterwards.
do $$
declare
  v_enq uuid;
  v_q1 uuid;
  v_q2 uuid;
  r jsonb;
  h1 text := repeat('a', 64);
  h2 text := repeat('b', 64);
begin
  select v::uuid into v_enq from pg_temp.ctx where k = 'enq';
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
  select id into v_q1 from public.quotations where enquiry_id = v_enq and version = 1;
  begin
    perform public.issue_quotation(v_q1, 'short', now() + interval '10 days');
    raise exception 'FAIL: malformed token hash accepted';
  exception when invalid_parameter_value then
    null;
  end;
  update public.enquiries set status = 'CONTACTED' where id = v_enq;
  r := public.issue_quotation(v_q1, h1, now() + interval '30 days');
  perform pg_temp.ok((r->>'enquiry_status_changed')::boolean = true, 'enquiry moved to QUOTATION_SENT');
  perform pg_temp.ok((select status from public.enquiries where id = v_enq) = 'QUOTATION_SENT', 'enquiry status is QUOTATION_SENT');
  perform pg_temp.ok((select previous_status from public.enquiry_status_history where enquiry_id = v_enq and new_status = 'QUOTATION_SENT') = 'CONTACTED', 'history records the REAL previous status (CONTACTED), not an assumed one');
  begin
    perform public.issue_quotation(v_q1, h2, now() + interval '30 days');
    raise exception 'FAIL: an issued quotation was issued again';
  exception when object_not_in_prerequisite_state then
    null;
  end;
  begin
    update public.quotations set total_amount = total_amount + 1, subtotal = subtotal + 1 where id = v_q1;
    raise exception 'FAIL: issued quotation content was modified';
  exception when object_not_in_prerequisite_state then
    null;
  end;
  begin
    update public.quotations set terms_and_conditions = 'changed' where id = v_q1;
    raise exception 'FAIL: issued quotation terms were modified';
  exception when object_not_in_prerequisite_state then
    null;
  end;
  begin
    update public.quotation_items set unit_price = 99, line_total = 99 where quotation_id = v_q1;
    raise exception 'FAIL: issued line items were modified';
  exception when object_not_in_prerequisite_state then
    null;
  end;
  begin
    insert into public.quotation_items (quotation_id, position, product_name, unit_code, unit_label, quantity, unit_price, line_total) values (v_q1, 9, 'Sneaky', 'BAG', 'Bag', 1, 1, 1);
    raise exception 'FAIL: line item added to an issued quotation';
  exception when object_not_in_prerequisite_state then
    null;
  end;
  begin
    delete from public.quotations where id = v_q1;
    raise exception 'FAIL: issued quotation deleted';
  exception when object_not_in_prerequisite_state then
    null;
  end;
  begin
    update public.quotations set status = 'DRAFT' where id = v_q1;
    raise exception 'FAIL: issued quotation returned to draft';
  exception when object_not_in_prerequisite_state then
    null;
  end;
  r := public.create_quotation_draft(jsonb_build_object('enquiry_id', v_enq, 'valid_days', 14, 'items', jsonb_build_array(jsonb_build_object('product_name', 'Cement PPC', 'unit_code', 'BAG', 'unit_label', 'Bag', 'quantity', 10, 'unit_price', 12.5))));
  v_q2 := (r->>'id')::uuid;
  perform pg_temp.ok((r->>'version')::int = 2, 'revision is version 2');
  r := public.issue_quotation(v_q2, h2, now() + interval '30 days');
  perform pg_temp.ok((r->>'enquiry_status_changed')::boolean = false, 'enquiry already QUOTATION_SENT: status NOT changed again');
  perform pg_temp.ok((select count(*) from public.enquiry_status_history where enquiry_id = v_enq and new_status = 'QUOTATION_SENT') = 1, 'no duplicate history row for the revision');
  perform pg_temp.ok((select status from public.quotations where id = v_q1) = 'REVISED', 'version 1 is marked REVISED (superseded)');
  perform pg_temp.ok((select status from public.quotations where id = v_q2) = 'ISSUED', 'version 2 is ISSUED');
  perform pg_temp.ok((select total_amount from public.quotations where id = v_q1) = 0.30, 'version 1 content preserved exactly');
end $$;

-- 5. Customer access: quotation link, enquiry link (latest version only), superseded flag, expiry, revoke, rotate, audit.
do $$
declare
  v_enq uuid;
  v_q1 uuid;
  v_q2 uuid;
  a jsonb;
  b jsonb;
  hq1 text := repeat('a', 64);
  hq2 text := repeat('b', 64);
  hq3 text := repeat('c', 64);
  henq text := repeat('d', 64);
begin
  select v::uuid into v_enq from pg_temp.ctx where k = 'enq';
  select id into v_q1 from public.quotations where enquiry_id = v_enq and version = 1;
  select id into v_q2 from public.quotations where enquiry_id = v_enq and version = 2;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
  a := public.get_tracked_quotation(hq1);
  perform pg_temp.ok(a->>'version' = '1' and (a->>'is_latest')::boolean = false and a->>'status' = 'REVISED', 'old link still works but is flagged as superseded');
  b := public.get_tracked_quotation(hq2);
  perform pg_temp.ok(b->>'version' = '2' and (b->>'is_latest')::boolean = true, 'latest link is flagged as latest');
  perform pg_temp.ok(b ? 'customer_name' and not (b ? 'created_by') and not (b ? 'id') and not (b ? 'tracking_token_hash'), 'customer payload has no internal fields');
  perform pg_temp.ok((select view_count from public.quotations where id = v_q2) = 1, 'a customer view is counted');
  perform pg_temp.ok(public.get_tracked_quotation(repeat('0', 64)) is null, 'unknown token returns null (no detail)');
  update public.enquiries set tracking_token_hash = henq, tracking_token_expires_at = now() + interval '10 days', tracking_token_revoked_at = null where id = v_enq;
  b := public.get_tracked_quotation(henq);
  perform pg_temp.ok(b->>'version' = '2', 'the ENQUIRY tracking link opens the LATEST issued quotation');
  update public.enquiries set tracking_token_revoked_at = now() where id = v_enq;
  perform pg_temp.ok(public.get_tracked_quotation(henq) is null, 'a revoked enquiry link no longer opens the quotation');
  perform public.revoke_quotation_token(v_q2);
  perform pg_temp.ok(public.get_tracked_quotation(hq2) is null, 'a revoked quotation link returns null');
  perform public.rotate_quotation_token(v_q2, hq3, now() + interval '5 days');
  perform pg_temp.ok(public.get_tracked_quotation(hq3) is not null, 'a rotated link works');
  perform pg_temp.ok(public.get_tracked_quotation(hq2) is null, 'the old link stays dead after rotation');
  begin
    perform public.rotate_quotation_token(v_q1, hq1, now() + interval '5 days');
    raise exception 'FAIL: a superseded quotation link was rotated';
  exception when object_not_in_prerequisite_state then
    null;
  end;
  update public.quotations set tracking_token_expires_at = now() - interval '1 minute' where id = v_q2;
  perform pg_temp.ok(public.get_tracked_quotation(hq3) is null, 'an expired link returns null');
end $$;

-- 6. Enquiry tracking: audited, reference + token both required, expiry and revocation honoured, no private data.
do $$
declare
  v_ref text;
  v_id uuid;
  t jsonb;
  v_updated timestamptz;
begin
  select e.reference, e.id into v_ref, v_id from public.enquiries e where idempotency_key = '44444444-4444-4444-4444-444444444401';
  update public.enquiries set tracking_token_hash = repeat('e', 64), tracking_token_expires_at = now() + interval '1 day', tracking_token_revoked_at = null where id = v_id;
  select updated_at into v_updated from public.enquiries where id = v_id;
  t := public.get_tracked_enquiry(v_ref, repeat('e', 64));
  perform pg_temp.ok(t is not null, 'valid reference + token returns the enquiry');
  perform pg_temp.ok(not (t ? 'id') and not (t ? 'mobile') and not (t ? 'email') and not (t ? 'notes') and not (t ? 'idempotency_key'), 'no internal id, contact data, notes or keys in the customer payload');
  perform pg_temp.ok((select tracking_view_count from public.enquiries where id = v_id) = 1, 'verified tracking access is counted');
  perform pg_temp.ok((select updated_at from public.enquiries where id = v_id) = v_updated, 'a customer view does NOT change updated_at');
  perform pg_temp.ok(public.get_tracked_enquiry(v_ref, repeat('f', 64)) is null, 'wrong token returns null');
  perform pg_temp.ok(public.get_tracked_enquiry('ENQ-0000-0000-0000', repeat('e', 64)) is null, 'right token with a wrong reference returns null');
  update public.enquiries set tracking_token_expires_at = now() - interval '1 second' where id = v_id;
  perform pg_temp.ok(public.get_tracked_enquiry(v_ref, repeat('e', 64)) is null, 'expired token returns null');
  update public.enquiries set tracking_token_expires_at = now() + interval '1 day', tracking_token_revoked_at = now() where id = v_id;
  perform pg_temp.ok(public.get_tracked_enquiry(v_ref, repeat('e', 64)) is null, 'revoked token returns null');
  perform pg_temp.ok(has_function_privilege('anon', 'public.get_tracked_enquiry(text, text)', 'execute') = false, 'anon cannot call get_tracked_enquiry directly');
  perform pg_temp.ok(has_function_privilege('anon', 'public.get_tracked_quotation(text)', 'execute') = false, 'anon cannot call get_tracked_quotation directly');
end $$;

select 'CUSTOMER_FEATURES_HARDENING_SQL_TESTS_PASSED' as marker;
