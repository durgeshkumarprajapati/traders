-- Sagar Traders — Phase 14 SQL verification (CRM, Attribution, Quotation Approval, Orders, Projects, Contractors, Service Areas).
-- Top-level statements separated by blank lines, NO blank lines inside DO $$ ... $$ blocks.

do $$
declare
  v_e1 jsonb;
  v_e2 jsonb;
  v_e3 jsonb;
  v_c1 uuid;
  v_c2 uuid;
  v_quo jsonb;
  v_resp jsonb;
  v_ord jsonb;
  v_tracked_ord jsonb;
  v_token_hash text := md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text);
  v_ord_hash text := md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text);
  v_admin_id uuid := '00000000-0000-0000-0000-0000000000a1';
begin
  -- 1. Customer resolution on enquiry creation (same mobile -> same customer_id, different mobile -> new customer_id)
  v_e1 := public.create_enquiry(jsonb_build_object(
    'idempotency_key', gen_random_uuid(),
    'type', 'GENERAL',
    'name', 'Ramesh Builders',
    'mobile', '9876543210',
    'message', 'Need 200 bags of PPC cement for site A',
    'attribution', jsonb_build_object('source', 'GOOGLE_SEARCH', 'utm_source', 'google', 'utm_medium', 'organic')
  ));
  v_e2 := public.create_enquiry(jsonb_build_object(
    'idempotency_key', gen_random_uuid(),
    'type', 'GENERAL',
    'name', 'Ramesh Builders',
    'mobile', '9876543210',
    'message', 'Second enquiry from same mobile number'
  ));
  v_e3 := public.create_enquiry(jsonb_build_object(
    'idempotency_key', gen_random_uuid(),
    'type', 'GENERAL',
    'name', 'Ramesh Builders',
    'mobile', '9876543211',
    'message', 'Same name but different mobile must NOT auto-merge'
  ));
  v_c1 := (v_e1->>'customer_id')::uuid;
  v_c2 := (v_e3->>'customer_id')::uuid;
  assert v_c1 is not null, 'customer_id must be set';
  assert v_c1 = (v_e2->>'customer_id')::uuid, 'same mobile must resolve to same customer';
  assert v_c1 <> v_c2, 'same name with different mobile must NOT auto-merge';
  -- 2. Controlled admin merge
  perform set_config('request.jwt.claim.sub', v_admin_id::text, true);
  perform public.merge_customers(v_c2, v_c1);
  assert (select merged_into_id from public.customers where id = v_c2) = v_c1, 'source customer must point to target';
  assert (select customer_id from public.enquiries where id = (v_e3->>'id')::uuid) = v_c1, 'enquiry must move to target customer';
  assert exists (select 1 from public.customer_identity_aliases where alias_mobile = '9876543211' and customer_id = v_c1), 'alias must be recorded';
  -- 3. Quotation draft -> issue -> customer acceptance -> duplicate response rejected
  v_quo := public.create_quotation_draft(jsonb_build_object(
    'enquiry_id', (v_e1->>'id')::uuid,
    'valid_days', 14,
    'items', jsonb_build_array(jsonb_build_object(
      'product_name', 'UltraTech PPC Cement',
      'unit_code', 'BAG',
      'unit_label', 'Bag',
      'quantity', 100,
      'unit_price', 385
    ))
  ));
  perform public.issue_quotation((v_quo->>'id')::uuid, v_token_hash, now() + interval '30 days');
  v_resp := public.respond_to_quotation(v_token_hash, 'ACCEPTED', 'Approved for dispatch');
  assert (v_resp->>'ok')::boolean = true, 'quotation acceptance must succeed';
  assert (select status from public.quotations where id = (v_quo->>'id')::uuid) = 'ACCEPTED', 'quotation status must be ACCEPTED';
  assert (select status from public.enquiries where id = (v_e1->>'id')::uuid) = 'CONFIRMED', 'enquiry status must become CONFIRMED';
  v_resp := public.respond_to_quotation(v_token_hash, 'REJECTED', 'Replay attempt');
  assert (v_resp->>'ok')::boolean = false, 'duplicate/replay response must be rejected';
  -- 4. Order creation from accepted quotation & customer tracking
  v_ord := public.create_order_from_quotation((v_quo->>'id')::uuid, v_ord_hash, now() + interval '90 days', current_date + 3, 'Deliver at main gate');
  assert (v_ord->>'id') is not null, 'order must be created';
  v_tracked_ord := public.get_tracked_order(v_ord_hash);
  assert v_tracked_ord->>'reference' = v_ord->>'reference', 'tracked order reference must match';
  assert v_tracked_ord->>'status' = 'CONFIRMED', 'tracked order status must be CONFIRMED';
  -- 5. Project showcase consent & authenticity check
  begin
    insert into public.projects (title, slug, description, category, status, authenticity_confirmed)
    values ('Test Project', 'test-project-unconfirmed', 'A valid description of ten+ chars', 'Residential', 'PUBLISHED', false);
    raise exception 'expected projects_publish_requires_authenticity to fail';
  exception when check_violation then
    null;
  end;
  -- 6. RLS must be enabled on all new tables
  assert not exists (
    select 1 from pg_tables
    where schemaname = 'public'
      and tablename in ('customers', 'customer_identity_aliases', 'customer_notes', 'customer_interactions', 'customer_followups', 'acquisition_attributions', 'audit_logs', 'quotation_responses', 'orders', 'order_items', 'order_status_history', 'delivery_records', 'order_notes', 'whatsapp_settings', 'whatsapp_message_logs', 'projects', 'project_images', 'contractor_material_lists', 'contractor_material_list_items', 'customer_offers', 'service_areas')
      and rowsecurity = false
  ), 'all Phase 14 tables must have RLS enabled';
end $$;

select 'PHASE_14_SQL_TESTS_PASSED' as marker;
