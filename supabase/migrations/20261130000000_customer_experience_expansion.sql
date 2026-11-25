-- Sagar Traders — Phases 15–17: Delivery Confirmation & Issue Reports, Verified Customer Reviews, Knowledge Centre.
-- Forward-only additive migration. Authoring rule: top-level statements separated by blank lines, NO blank lines inside function bodies.

alter table public.orders add column customer_confirmed_at timestamptz;

alter table public.orders add column customer_confirmed_note text check (customer_confirmed_note is null or char_length(customer_confirmed_note) <= 500);

create table public.delivery_issue_reports (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  issue_type text not null check (issue_type in ('DELAY', 'MISSING_MATERIAL', 'DAMAGED_MATERIAL', 'INCORRECT_MATERIAL', 'OTHER')),
  description text not null check (char_length(description) between 5 and 2000),
  status text not null default 'OPEN' check (status in ('OPEN', 'ACKNOWLEDGED', 'RESOLVED')),
  created_at timestamptz not null default now()
);

create index delivery_issue_reports_order_idx on public.delivery_issue_reports (order_id, created_at desc);

create table public.customer_reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  overall_rating smallint not null check (overall_rating between 1 and 5),
  quality_rating smallint not null check (quality_rating between 1 and 5),
  delivery_rating smallint not null check (delivery_rating between 1 and 5),
  service_rating smallint not null check (service_rating between 1 and 5),
  feedback text check (feedback is null or char_length(feedback) <= 2000),
  reviewer_display_name text check (reviewer_display_name is null or char_length(reviewer_display_name) <= 100),
  consent_to_publish boolean not null default false,
  verified_purchase boolean not null default true,
  moderation_status text not null default 'PENDING' check (moderation_status in ('PENDING', 'APPROVED', 'REJECTED', 'HIDDEN')),
  moderated_by uuid references auth.users (id) on delete set null,
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customer_reviews_status_idx on public.customer_reviews (moderation_status, created_at desc);

create trigger customer_reviews_set_updated_at before update on public.customer_reviews for each row execute function public.set_updated_at();

create table public.knowledge_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  category text not null check (char_length(category) between 2 and 100),
  tags text[] not null default '{}',
  summary text not null check (char_length(summary) between 10 and 500),
  body text not null check (char_length(body) between 20 and 20000),
  translations jsonb not null default '{}'::jsonb,
  related_product_slugs text[] not null default '{}',
  technical_reviewed boolean not null default false,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_publish_requires_review check (status <> 'PUBLISHED' or technical_reviewed = true)
);

create index knowledge_articles_status_idx on public.knowledge_articles (status, published_at desc);

create trigger knowledge_articles_set_updated_at before update on public.knowledge_articles for each row execute function public.set_updated_at();

-- ── Row Level Security ──
alter table public.delivery_issue_reports enable row level security;

alter table public.customer_reviews enable row level security;

alter table public.knowledge_articles enable row level security;

revoke all on table public.delivery_issue_reports, public.customer_reviews, public.knowledge_articles from public, anon, authenticated;

grant all on table public.delivery_issue_reports, public.customer_reviews, public.knowledge_articles to service_role;

grant select, insert, update, delete on table public.delivery_issue_reports, public.customer_reviews, public.knowledge_articles to authenticated;

create policy admin_delivery_issue_reports_policy on public.delivery_issue_reports for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy admin_customer_reviews_policy on public.customer_reviews for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy admin_knowledge_articles_policy on public.knowledge_articles for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Public read access ONLY for approved reviews (safe columns only) and published knowledge articles.
grant select (id, overall_rating, quality_rating, delivery_rating, service_rating, feedback, reviewer_display_name, consent_to_publish, verified_purchase, created_at) on table public.customer_reviews to anon;

grant select on table public.knowledge_articles to anon;

create policy public_approved_reviews_read on public.customer_reviews for select to anon using (moderation_status = 'APPROVED');

create policy public_published_knowledge_read on public.knowledge_articles for select to anon using (status = 'PUBLISHED');

-- ── Update get_tracked_order to include confirmation, instructions, contact, issues & review eligibility ──
create or replace function public.get_tracked_order(p_token_hash text) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_o orders%rowtype;
  v_items jsonb;
  v_history jsonb;
  v_del record;
  v_issues jsonb;
  v_reviewed boolean;
begin
  select * into v_o from orders
   where tracking_token_hash = p_token_hash
     and tracking_token_revoked_at is null
     and (tracking_token_expires_at is null or tracking_token_expires_at > now());
  if not found then
    return null;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('position', i.position, 'product_id', i.product_id, 'product_name', i.product_name, 'brand_name', i.brand_name, 'unit_code', i.unit_code, 'unit_label', i.unit_label, 'quantity', i.quantity, 'unit_price', i.unit_price, 'line_total', i.line_total) order by i.position asc), '[]'::jsonb) into v_items from order_items i where i.order_id = v_o.id;
  select coalesce(jsonb_agg(jsonb_build_object('previous_status', h.previous_status, 'new_status', h.new_status, 'description', h.description, 'created_at', h.created_at) order by h.created_at asc), '[]'::jsonb) into v_history from order_status_history h where h.order_id = v_o.id;
  select delivery_address, contact_person, contact_number, expected_delivery_date, dispatched_at, actual_delivery_date into v_del from delivery_records where order_id = v_o.id;
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'issue_type', r.issue_type, 'description', r.description, 'status', r.status, 'created_at', r.created_at) order by r.created_at desc), '[]'::jsonb) into v_issues from delivery_issue_reports r where r.order_id = v_o.id;
  select exists (select 1 from customer_reviews cr where cr.order_id = v_o.id) into v_reviewed;
  return jsonb_build_object('reference', v_o.reference, 'status', v_o.status, 'customer_name', v_o.customer_name, 'delivery_address', coalesce(v_del.delivery_address, v_o.delivery_address), 'contact_person', v_del.contact_person, 'contact_number', v_del.contact_number, 'customer_instructions', v_o.customer_instructions, 'expected_delivery_date', coalesce(v_del.expected_delivery_date, v_o.expected_delivery_date), 'dispatched_at', v_del.dispatched_at, 'actual_delivery_date', v_del.actual_delivery_date, 'customer_confirmed_at', v_o.customer_confirmed_at, 'subtotal', v_o.subtotal, 'discount_amount', v_o.discount_amount, 'tax_amount', v_o.tax_amount, 'total_amount', v_o.total_amount, 'created_at', v_o.created_at, 'items', v_items, 'timeline', v_history, 'issues', v_issues, 'has_review', v_reviewed);
end $$;

-- ── Customer delivery confirmation (does NOT mutate administrative order status) ──
create function public.confirm_order_delivery(p_token_hash text, p_note text default null) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_o orders%rowtype;
begin
  select * into v_o from orders
   where tracking_token_hash = p_token_hash
     and tracking_token_revoked_at is null
     and (tracking_token_expires_at is null or tracking_token_expires_at > now())
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'NOT_FOUND');
  end if;
  if v_o.status not in ('DISPATCHED', 'OUT_FOR_DELIVERY', 'DELIVERED') then
    return jsonb_build_object('ok', false, 'reason', 'NOT_DISPATCHED');
  end if;
  if v_o.customer_confirmed_at is not null then
    return jsonb_build_object('ok', true, 'already_confirmed', true, 'confirmed_at', v_o.customer_confirmed_at);
  end if;
  update orders set customer_confirmed_at = now(), customer_confirmed_note = nullif(btrim(p_note), '') where id = v_o.id;
  insert into audit_logs (actor_type, action, entity_type, entity_id, details)
  values ('CUSTOMER', 'ORDER_DELIVERY_CONFIRMED', 'order', v_o.id::text, jsonb_build_object('reference', v_o.reference));
  return jsonb_build_object('ok', true, 'already_confirmed', false, 'confirmed_at', now());
end $$;

-- ── Customer delivery issue report (saved to delivery_issue_reports + audit_logs) ──
create function public.report_order_delivery_issue(p_token_hash text, p_issue_type text, p_description text) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_o orders%rowtype;
  v_issue_id uuid;
begin
  if p_issue_type not in ('DELAY', 'MISSING_MATERIAL', 'DAMAGED_MATERIAL', 'INCORRECT_MATERIAL', 'OTHER') then
    raise exception 'order: invalid issue type' using errcode = '22023';
  end if;
  select * into v_o from orders
   where tracking_token_hash = p_token_hash
     and tracking_token_revoked_at is null
     and (tracking_token_expires_at is null or tracking_token_expires_at > now());
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'NOT_FOUND');
  end if;
  insert into delivery_issue_reports (order_id, customer_id, issue_type, description)
  values (v_o.id, v_o.customer_id, p_issue_type, btrim(p_description))
  returning id into v_issue_id;
  insert into audit_logs (actor_type, action, entity_type, entity_id, details)
  values ('CUSTOMER', 'DELIVERY_ISSUE_REPORTED', 'order', v_o.id::text, jsonb_build_object('issue_id', v_issue_id, 'issue_type', p_issue_type));
  return jsonb_build_object('ok', true, 'issue_id', v_issue_id);
end $$;

-- ── Verified-purchase review submission (DELIVERED orders only, 1 per order) ──
create function public.submit_order_review(p_token_hash text, p_overall smallint, p_quality smallint, p_delivery smallint, p_service smallint, p_feedback text default null, p_display_name text default null, p_consent boolean default false) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_o orders%rowtype;
  v_rev_id uuid;
begin
  select * into v_o from orders
   where tracking_token_hash = p_token_hash
     and tracking_token_revoked_at is null
     and (tracking_token_expires_at is null or tracking_token_expires_at > now());
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'NOT_FOUND');
  end if;
  if v_o.status <> 'DELIVERED' then
    return jsonb_build_object('ok', false, 'reason', 'NOT_DELIVERED');
  end if;
  insert into customer_reviews (order_id, customer_id, overall_rating, quality_rating, delivery_rating, service_rating, feedback, reviewer_display_name, consent_to_publish, verified_purchase, moderation_status)
  values (v_o.id, v_o.customer_id, p_overall, p_quality, p_delivery, p_service, nullif(btrim(p_feedback), ''), case when p_consent then nullif(btrim(p_display_name), '') else null end, coalesce(p_consent, false), true, 'PENDING')
  returning id into v_rev_id;
  insert into audit_logs (actor_type, action, entity_type, entity_id, details)
  values ('CUSTOMER', 'REVIEW_SUBMITTED', 'customer_review', v_rev_id::text, jsonb_build_object('order_id', v_o.id));
  return jsonb_build_object('ok', true, 'review_id', v_rev_id);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'reason', 'ALREADY_REVIEWED');
end $$;

revoke all on function public.confirm_order_delivery(text, text), public.report_order_delivery_issue(text, text, text), public.submit_order_review(text, smallint, smallint, smallint, smallint, text, text, boolean) from public, anon, authenticated;

grant execute on function public.confirm_order_delivery(text, text), public.report_order_delivery_issue(text, text, text), public.submit_order_review(text, smallint, smallint, smallint, smallint, text, text, boolean) to service_role;
