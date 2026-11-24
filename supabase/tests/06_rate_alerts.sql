-- Tests for Phase 13 rate alerts: consent, double opt-in, exact price comparison, idempotency, unsubscribe, privileges.

-- 1. Subscribing creates a PENDING subscription; a repeat for the same live product+email creates nothing (no enumeration, no duplicate).
do $$
declare
  r jsonb;
begin
  r := public.subscribe_rate_alert('66666666-6666-4666-8666-666666666601', 'p-cement', 'Buyer@Example.com', 'ANY_CHANGE', null, 'I agree to receive rate alerts for this product.', 'confirm-hash-1', 'unsub-hash-1');
  perform pg_temp.ok((r->>'created')::boolean, 'first subscription created');
  perform pg_temp.ok((select status from public.rate_alert_subscriptions where id = '66666666-6666-4666-8666-666666666601') = 'PENDING', 'new subscription is PENDING, not active');
  perform pg_temp.ok((select email from public.rate_alert_subscriptions where id = '66666666-6666-4666-8666-666666666601') = 'buyer@example.com', 'email stored lower-case');
  perform pg_temp.ok((select consent_text <> '' and consented_at is not null from public.rate_alert_subscriptions where id = '66666666-6666-4666-8666-666666666601'), 'consent text and time recorded');
  r := public.subscribe_rate_alert('66666666-6666-4666-8666-666666666602', 'p-cement', 'buyer@example.com', 'ANY_CHANGE', null, 'I agree to receive rate alerts for this product.', 'confirm-hash-2', 'unsub-hash-2');
  perform pg_temp.ok(not (r->>'created')::boolean, 'duplicate live subscription is not created');
  perform pg_temp.ok((select count(*) from public.rate_alert_subscriptions where product_id = 'p-cement') = 1, 'still exactly one row');
end $$;

-- 2. Only the emailed token activates a subscription, once.
do $$
begin
  perform pg_temp.ok(not public.confirm_rate_alert('wrong-hash'), 'wrong confirmation token does nothing');
  perform pg_temp.ok((select status from public.rate_alert_subscriptions where id = '66666666-6666-4666-8666-666666666601') = 'PENDING', 'still pending after a wrong token');
  perform pg_temp.ok(public.confirm_rate_alert('confirm-hash-1'), 'right token activates');
  perform pg_temp.ok((select status from public.rate_alert_subscriptions where id = '66666666-6666-4666-8666-666666666601') = 'ACTIVE', 'subscription ACTIVE');
  perform pg_temp.ok(not public.confirm_rate_alert('confirm-hash-1'), 'token is single use');
end $$;

-- 3. Detection is exact (integer paise) and idempotent. A pending subscription is never queued.
do $$
declare
  v_n integer;
begin
  perform public.subscribe_rate_alert('66666666-6666-4666-8666-666666666603', 'p-steel', 'pending@example.com', 'ANY_CHANGE', null, 'I agree to receive rate alerts for this product.', 'confirm-hash-3', 'unsub-hash-3');
  perform public.record_price_snapshots('2026-11-01', '[{"product_id":"p-cement","price_paise":40000},{"product_id":"p-steel","price_paise":6000000}]'::jsonb);
  v_n := public.queue_rate_alert_notifications('2026-11-01');
  perform pg_temp.ok(v_n = 0, 'first snapshot day queues nothing (no previous price to compare)');
  perform public.record_price_snapshots('2026-11-02', '[{"product_id":"p-cement","price_paise":40000},{"product_id":"p-steel","price_paise":6000001}]'::jsonb);
  perform pg_temp.ok(public.queue_rate_alert_notifications('2026-11-02') = 0, 'unchanged price queues nothing; pending subscription is ignored even though its product changed by 1 paisa');
  perform public.record_price_snapshots('2026-11-03', '[{"product_id":"p-cement","price_paise":40001}]'::jsonb);
  perform pg_temp.ok(public.queue_rate_alert_notifications('2026-11-03') = 1, 'a 1-paisa change is detected exactly');
  perform pg_temp.ok(public.queue_rate_alert_notifications('2026-11-03') = 0, 'running the detector again queues nothing (idempotent)');
  perform pg_temp.ok(public.record_price_snapshots('2026-11-03', '[{"product_id":"p-cement","price_paise":99999}]'::jsonb) = 0, 're-recording a day does not overwrite the snapshot');
  perform pg_temp.ok((select price_to_paise from public.rate_alert_notifications where snapshot_date = '2026-11-03') = 40001 and (select price_from_paise from public.rate_alert_notifications where snapshot_date = '2026-11-03') = 40000, 'from/to prices recorded');
end $$;

-- 4. Sending: success records the notified price; failures are retried up to 5 attempts and then stop.
do $$
declare
  v_id uuid;
  i integer;
begin
  select id into v_id from public.rate_alert_notifications where snapshot_date = '2026-11-03';
  perform pg_temp.ok((select count(*) from public.list_rate_alerts_due(10) where id = v_id) = 1, 'queued notification is due');
  perform public.record_rate_alert_result(v_id, false, 'provider timeout');
  perform pg_temp.ok((select status from public.rate_alert_notifications where id = v_id) = 'FAILED' and (select attempts from public.rate_alert_notifications where id = v_id) = 1, 'failure recorded');
  perform pg_temp.ok((select count(*) from public.list_rate_alerts_due(10) where id = v_id) = 1, 'failed notification is retried');
  perform public.record_rate_alert_result(v_id, true, null);
  perform pg_temp.ok((select status from public.rate_alert_notifications where id = v_id) = 'SENT', 'marked SENT');
  perform pg_temp.ok((select last_notified_price_paise from public.rate_alert_subscriptions where id = '66666666-6666-4666-8666-666666666601') = 40001, 'subscription remembers the notified price');
  perform pg_temp.ok((select count(*) from public.list_rate_alerts_due(10) where id = v_id) = 0, 'a sent notification is never due again');
  perform public.record_rate_alert_result(v_id, false, 'late failure');
  perform pg_temp.ok((select status from public.rate_alert_notifications where id = v_id) = 'SENT', 'a SENT notification cannot be flipped back to FAILED');
  perform public.record_price_snapshots('2026-11-04', '[{"product_id":"p-cement","price_paise":40500}]'::jsonb);
  perform public.queue_rate_alert_notifications('2026-11-04');
  select id into v_id from public.rate_alert_notifications where snapshot_date = '2026-11-04';
  for i in 1..5 loop
    perform public.record_rate_alert_result(v_id, false, 'down');
  end loop;
  perform pg_temp.ok((select count(*) from public.list_rate_alerts_due(10) where id = v_id) = 0, 'after 5 failed attempts the notification stops retrying');
end $$;

-- 5. DROPS_BELOW: only at or below the target, and not repeated at the same price.
do $$
begin
  perform public.subscribe_rate_alert('66666666-6666-4666-8666-666666666604', 'p-sand', 'drop@example.com', 'DROPS_BELOW', 5000, 'I agree to receive rate alerts for this product.', 'confirm-hash-4', 'unsub-hash-4');
  perform public.confirm_rate_alert('confirm-hash-4');
  perform public.record_price_snapshots('2026-11-05', '[{"product_id":"p-sand","price_paise":5001}]'::jsonb);
  perform pg_temp.ok(public.queue_rate_alert_notifications('2026-11-05') = 0, 'price above target does not alert');
  perform public.record_price_snapshots('2026-11-06', '[{"product_id":"p-sand","price_paise":5000}]'::jsonb);
  perform pg_temp.ok(public.queue_rate_alert_notifications('2026-11-06') = 1, 'price equal to target alerts');
  perform public.record_rate_alert_result((select id from public.rate_alert_notifications where snapshot_date = '2026-11-06'), true, null);
  perform public.record_price_snapshots('2026-11-07', '[{"product_id":"p-sand","price_paise":5000}]'::jsonb);
  perform pg_temp.ok(public.queue_rate_alert_notifications('2026-11-07') = 0, 'same price is not re-announced the next day');
  perform public.record_price_snapshots('2026-11-08', '[{"product_id":"p-sand","price_paise":4900}]'::jsonb);
  perform pg_temp.ok(public.queue_rate_alert_notifications('2026-11-08') = 1, 'a further drop alerts again');
end $$;

-- 6. Unsubscribe is idempotent, works for an unknown token without revealing anything, and stops alerts; the customer can subscribe again.
do $$
begin
  perform pg_temp.ok(public.unsubscribe_rate_alert('unsub-hash-4'), 'valid token unsubscribes');
  perform pg_temp.ok(public.unsubscribe_rate_alert('unsub-hash-4'), 'unsubscribing twice is not an error');
  perform pg_temp.ok(not public.unsubscribe_rate_alert('no-such-token'), 'unknown token reports not found');
  perform pg_temp.ok((select status from public.rate_alert_subscriptions where id = '66666666-6666-4666-8666-666666666604') = 'UNSUBSCRIBED', 'status UNSUBSCRIBED');
  perform public.record_price_snapshots('2026-11-09', '[{"product_id":"p-sand","price_paise":4000}]'::jsonb);
  perform pg_temp.ok(public.queue_rate_alert_notifications('2026-11-09') = 0, 'an unsubscribed address is never queued');
  perform pg_temp.ok((public.subscribe_rate_alert('66666666-6666-4666-8666-666666666605', 'p-sand', 'drop@example.com', 'ANY_CHANGE', null, 'I agree to receive rate alerts for this product.', 'confirm-hash-5', 'unsub-hash-5')->>'created')::boolean, 'can subscribe again after unsubscribing');
end $$;

-- 7. Constraints reject bad data.
do $$
declare
  v_failed integer := 0;
begin
  begin
    insert into public.rate_alert_subscriptions (id, product_id, email, alert_type, consent_text, unsubscribe_token_hash) values (gen_random_uuid(), 'p1', 'UPPER@example.com', 'ANY_CHANGE', 'I agree to receive alerts.', 'h-a');
  exception when check_violation then v_failed := v_failed + 1; end;
  begin
    insert into public.rate_alert_subscriptions (id, product_id, email, alert_type, consent_text, unsubscribe_token_hash) values (gen_random_uuid(), 'p1', 'x@example.com', 'DROPS_BELOW', 'I agree to receive alerts.', 'h-b');
  exception when check_violation then v_failed := v_failed + 1; end;
  begin
    insert into public.rate_alert_subscriptions (id, product_id, email, alert_type, consent_text, unsubscribe_token_hash) values (gen_random_uuid(), 'bad id!', 'x@example.com', 'ANY_CHANGE', 'I agree to receive alerts.', 'h-c');
  exception when check_violation then v_failed := v_failed + 1; end;
  begin
    insert into public.rate_alert_subscriptions (id, product_id, email, alert_type, consent_text, unsubscribe_token_hash) values (gen_random_uuid(), 'p1', 'x@example.com', 'ANY_CHANGE', 'short', 'h-d');
  exception when check_violation then v_failed := v_failed + 1; end;
  perform pg_temp.ok(v_failed = 4, 'uppercase email, DROPS_BELOW without target, malformed product id and missing consent text are all rejected');
end $$;

-- 8. Privileges: customer-facing roles cannot call the functions, and admins cannot read token hashes.
do $$
begin
  perform pg_temp.ok(has_function_privilege('anon', 'public.subscribe_rate_alert(uuid, text, text, text, bigint, text, text, text)', 'execute') = false and has_function_privilege('authenticated', 'public.unsubscribe_rate_alert(text)', 'execute') = false, 'rate-alert functions are not callable by anon or authenticated');
  perform pg_temp.ok(has_function_privilege('service_role', 'public.queue_rate_alert_notifications(date)', 'execute'), 'service_role can run the detector');
  perform pg_temp.ok(has_column_privilege('authenticated', 'public.rate_alert_subscriptions', 'email', 'select') and not has_column_privilege('authenticated', 'public.rate_alert_subscriptions', 'unsubscribe_token_hash', 'select') and not has_column_privilege('authenticated', 'public.rate_alert_subscriptions', 'confirm_token_hash', 'select'), 'admins can read subscriptions but never the token hashes');
  perform pg_temp.ok(not has_table_privilege('anon', 'public.rate_alert_subscriptions', 'select') and not has_table_privilege('anon', 'public.product_price_snapshots', 'select') and not has_table_privilege('authenticated', 'public.rate_alert_subscriptions', 'insert'), 'anon has no table access; authenticated cannot write');
  perform pg_temp.ok((select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname in ('rate_alert_subscriptions', 'product_price_snapshots', 'rate_alert_notifications') and c.relrowsecurity) = 3, 'RLS enabled on all three tables');
end $$;

select 'RATE_ALERTS_SQL_TESTS_PASSED' as marker;
