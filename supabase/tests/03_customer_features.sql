-- Tests for Customer Features: enquiry tracking, callbacks, quotations, and status history.
-- 1. Status history and tracking token fields on enquiries
do $$
declare
  v_enq_id uuid;
  v_tracked jsonb;
begin
  insert into public.enquiries (reference, type, customer_name, mobile, idempotency_key, tracking_token_hash, message)
  values ('ENQ-2026-999001', 'GENERAL', 'Test Customer', '9876543210', '00000000-0000-0000-0000-000000009901', 'test_hash_123', 'Need pricing on cement')
  returning id into v_enq_id;
  insert into public.enquiry_status_history (enquiry_id, previous_status, new_status, description)
  values (v_enq_id, null, 'NEW', 'Enquiry received');
  insert into public.enquiry_status_history (enquiry_id, previous_status, new_status, description)
  values (v_enq_id, 'NEW', 'CONTACTED', 'Customer called by representative');
  perform pg_temp.ok((select count(*) from public.enquiry_status_history where enquiry_id = v_enq_id) = 2, 'two status history rows inserted');
  v_tracked := public.get_tracked_enquiry('ENQ-2026-999001', 'test_hash_123');
  perform pg_temp.ok(v_tracked is not null, 'get_tracked_enquiry returned record');
  perform pg_temp.ok(v_tracked->>'reference' = 'ENQ-2026-999001', 'tracked enquiry reference matches');
  perform pg_temp.ok(jsonb_array_length(v_tracked->'timeline') = 2, 'tracked enquiry timeline has 2 entries');
  perform pg_temp.ok(public.get_tracked_enquiry('ENQ-2026-999001', 'wrong_hash') is null, 'wrong hash returns null');
end $$;

-- 2. Callback details check
do $$
declare
  v_enq_id uuid;
begin
  insert into public.enquiries (reference, type, customer_name, mobile, idempotency_key, message)
  values ('ENQ-2026-999002', 'GENERAL', 'Callback Customer', '9876543210', '00000000-0000-0000-0000-000000009902', 'Callback request')
  returning id into v_enq_id;
  insert into public.enquiry_callbacks (enquiry_id, preferred_date, preferred_time_window, reason)
  values (v_enq_id, current_date, 'MORNING', 'Pricing and delivery time');
  perform pg_temp.ok((select count(*) from public.enquiry_callbacks where enquiry_id = v_enq_id) = 1, 'callback details stored');
end $$;

-- 3. Quotations and line items check
do $$
declare
  v_enq_id uuid;
  v_quo_id uuid;
  v_tracked_quo jsonb;
begin
  select id into v_enq_id from public.enquiries where reference = 'ENQ-2026-999001';
  insert into public.quotations (reference, enquiry_id, version, status, customer_name, mobile, subtotal, discount_amount, tax_amount, total_amount, tracking_token_hash)
  values ('QUO-2026-001001', v_enq_id, 1, 'ISSUED', 'Test Customer', '9876543210', 50000.00, 1000.00, 0.00, 49000.00, 'quo_token_hash_456')
  returning id into v_quo_id;
  insert into public.quotation_items (quotation_id, position, product_name, unit_code, unit_label, quantity, unit_price, line_total)
  values (v_quo_id, 1, 'Fe 550D TMT Rebars 12mm', 'METRIC_TON', 'Metric Ton', 1.000, 49000.00, 49000.00);
  perform pg_temp.ok((select count(*) from public.quotation_items where quotation_id = v_quo_id) = 1, 'quotation item inserted');
  v_tracked_quo := public.get_tracked_quotation('quo_token_hash_456');
  perform pg_temp.ok(v_tracked_quo is not null, 'get_tracked_quotation returned record');
  perform pg_temp.ok(v_tracked_quo->>'reference' = 'QUO-2026-001001', 'quotation reference matches');
  perform pg_temp.ok((v_tracked_quo->>'total_amount')::numeric = 49000.00, 'quotation total matches');
  perform pg_temp.ok(public.get_tracked_quotation('wrong_token') is null, 'wrong quotation token returns null');
end $$;

-- 4. Check function & table privileges
do $$
begin
  perform pg_temp.ok(has_function_privilege('anon', 'public.get_tracked_enquiry(text, text)', 'execute') = false, 'anon cannot execute get_tracked_enquiry');
  perform pg_temp.ok(has_function_privilege('anon', 'public.get_tracked_quotation(text)', 'execute') = false, 'anon cannot execute get_tracked_quotation');
  perform pg_temp.ok(has_function_privilege('service_role', 'public.get_tracked_enquiry(text, text)', 'execute') = true, 'service_role can execute get_tracked_enquiry');
  perform pg_temp.ok(has_table_privilege('anon', 'public.quotations', 'select') = false, 'anon cannot select quotations directly');
  perform pg_temp.ok(has_table_privilege('authenticated', 'public.quotations', 'select') = true, 'authenticated has select privilege on quotations for RLS');
  perform pg_temp.ok(has_table_privilege('authenticated', 'public.enquiry_status_history', 'select') = true, 'authenticated has select privilege on enquiry_status_history for RLS');
end $$;

select 'CUSTOMER_FEATURES_SQL_TESTS_PASSED' as marker;
