-- Sagar Traders — Phases 15–17 SQL verification (delivery confirmation, issue reports, verified reviews, knowledge articles).
-- Top-level statements separated by blank lines, NO blank lines inside DO $$ ... $$ blocks.

do $$
declare
  v_e jsonb;
  v_q jsonb;
  v_ord jsonb;
  v_q_hash text := md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text);
  v_o_hash text := md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text);
  v_res jsonb;
  v_admin_id uuid := '00000000-0000-0000-0000-0000000000a1';
begin
  perform set_config('request.jwt.claim.sub', v_admin_id::text, true);
  v_e := public.create_enquiry(jsonb_build_object('idempotency_key', gen_random_uuid(), 'type', 'GENERAL', 'name', 'Review Tester', 'mobile', '9876543299', 'message', 'Testing delivery confirmation and review flow'));
  v_q := public.create_quotation_draft(jsonb_build_object('enquiry_id', (v_e->>'id')::uuid, 'valid_days', 7, 'items', jsonb_build_array(jsonb_build_object('product_name', 'OPC 53 Cement', 'unit_code', 'BAG', 'unit_label', 'Bag', 'quantity', 20, 'unit_price', 410))));
  perform public.issue_quotation((v_q->>'id')::uuid, v_q_hash, now() + interval '10 days');
  perform public.respond_to_quotation(v_q_hash, 'ACCEPTED', 'Ok');
  v_ord := public.create_order_from_quotation((v_q->>'id')::uuid, v_o_hash, now() + interval '90 days', current_date + 2, 'Call before arriving');
  -- 1. Review blocked before DELIVERED
  v_res := public.submit_order_review(v_o_hash, 5::smallint, 5::smallint, 5::smallint, 5::smallint, 'Great', 'Tester', true);
  assert (v_res->>'ok')::boolean = false and v_res->>'reason' = 'NOT_DELIVERED', 'review must require DELIVERED status';
  -- 2. Move order to DELIVERED and confirm delivery (without admin status overwrite)
  update public.orders set status = 'DELIVERED' where id = (v_ord->>'id')::uuid;
  v_res := public.confirm_order_delivery(v_o_hash, 'Received all 20 bags');
  assert (v_res->>'ok')::boolean = true, 'delivery confirmation must succeed';
  -- 3. Report delivery issue
  v_res := public.report_order_delivery_issue(v_o_hash, 'DELAY', 'Arrived 2 hours late');
  assert (v_res->>'ok')::boolean = true, 'issue report must succeed';
  -- 4. Submit verified review once, reject duplicate
  v_res := public.submit_order_review(v_o_hash, 5::smallint, 5::smallint, 4::smallint, 5::smallint, 'Good quality cement', 'R. Tester', true);
  assert (v_res->>'ok')::boolean = true, 'first review must succeed';
  v_res := public.submit_order_review(v_o_hash, 1::smallint, 1::smallint, 1::smallint, 1::smallint, 'Duplicate', 'R. Tester', true);
  assert (v_res->>'ok')::boolean = false and v_res->>'reason' = 'ALREADY_REVIEWED', 'duplicate review must be rejected';
  -- 5. Knowledge article publish constraint
  begin
    insert into public.knowledge_articles (title, slug, category, summary, body, status, technical_reviewed)
    values ('Cement Guide', 'cement-guide-unreviewed', 'Cement', 'Short summary of cement guide', 'Long enough body text for cement guide article.', 'PUBLISHED', false);
    raise exception 'expected knowledge_publish_requires_review to fail';
  exception when check_violation then
    null;
  end;
  -- 6. RLS enabled on all new tables
  assert not exists (
    select 1 from pg_tables
    where schemaname = 'public'
      and tablename in ('delivery_issue_reports', 'customer_reviews', 'knowledge_articles')
      and rowsecurity = false
  ), 'all Phase 15-17 tables must have RLS enabled';
end $$;

select 'PHASES_15_18_SQL_TESTS_PASSED' as marker;
