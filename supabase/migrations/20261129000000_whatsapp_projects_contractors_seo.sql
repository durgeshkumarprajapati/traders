-- Sagar Traders — Phase 14 (Stages 5, 6, 7): WhatsApp Integration, Project Showcase, Contractor Programme & Service Areas.
-- Forward-only additive migration. Authoring rule: top-level statements separated by blank lines, NO blank lines inside function bodies.

-- Extend notification_outbox channels & kinds while preserving existing EMAIL / ENQUIRY_RECEIVED rows.
alter table public.notification_outbox drop constraint if exists notification_outbox_channel_check;

alter table public.notification_outbox add constraint notification_outbox_channel_check check (channel in ('EMAIL', 'WHATSAPP'));

alter table public.notification_outbox drop constraint if exists notification_outbox_kind_check;

alter table public.notification_outbox add constraint notification_outbox_kind_check check (kind in ('ENQUIRY_RECEIVED', 'QUOTATION_RESPONSE', 'ORDER_STATUS', 'FOLLOWUP_REMINDER', 'WHATSAPP_EVENT'));

create table public.whatsapp_settings (
  id integer primary key default 1 check (id = 1),
  automated_enabled boolean not null default false,
  provider text not null default 'NONE' check (provider in ('NONE', 'META_CLOUD_API')),
  enabled_events text[] not null default '{}',
  template_mappings jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.whatsapp_settings (id, automated_enabled, provider) values (1, false, 'NONE') on conflict (id) do nothing;

create trigger whatsapp_settings_set_updated_at before update on public.whatsapp_settings for each row execute function public.set_updated_at();

create table public.whatsapp_message_logs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers (id) on delete set null,
  enquiry_id uuid references public.enquiries (id) on delete set null,
  quotation_id uuid references public.quotations (id) on delete set null,
  order_id uuid references public.orders (id) on delete set null,
  recipient_mobile text not null check (char_length(recipient_mobile) between 8 and 20),
  event_type text not null check (char_length(event_type) between 1 and 80),
  delivery_mode text not null check (delivery_mode in ('MANUAL_LINK', 'AUTOMATED_API')),
  template_name text check (template_name is null or char_length(template_name) <= 120),
  status text not null default 'PENDING' check (status in ('LINK_GENERATED', 'PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED')),
  provider_message_id text check (provider_message_id is null or char_length(provider_message_id) <= 200),
  error_summary text check (error_summary is null or char_length(error_summary) <= 300),
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index whatsapp_message_logs_created_idx on public.whatsapp_message_logs (created_at desc);

create index whatsapp_message_logs_customer_idx on public.whatsapp_message_logs (customer_id, created_at desc);

create trigger whatsapp_message_logs_set_updated_at before update on public.whatsapp_message_logs for each row execute function public.set_updated_at();

-- ── Project Showcase & Customer Stories ──
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text not null check (char_length(description) between 10 and 5000),
  category text not null check (char_length(category) between 2 and 100),
  location text check (location is null or char_length(location) <= 200),
  completion_date date,
  materials_supplied text[] not null default '{}',
  brands_supplied text[] not null default '{}',
  customer_testimonial text check (customer_testimonial is null or char_length(customer_testimonial) <= 2000),
  customer_display_name text check (customer_display_name is null or char_length(customer_display_name) <= 120),
  is_anonymized boolean not null default false,
  authenticity_confirmed boolean not null default false,
  customer_consent_obtained boolean not null default false,
  consent_recorded_at timestamptz,
  seo_title text check (seo_title is null or char_length(seo_title) <= 120),
  seo_description text check (seo_description is null or char_length(seo_description) <= 300),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_publish_requires_authenticity check (status <> 'PUBLISHED' or authenticity_confirmed = true),
  constraint projects_identifiable_requires_consent check (status <> 'PUBLISHED' or is_anonymized = true or (customer_display_name is null and customer_testimonial is null) or customer_consent_obtained = true)
);

create index projects_status_published_idx on public.projects (status, published_at desc);

create trigger projects_set_updated_at before update on public.projects for each row execute function public.set_updated_at();

create table public.project_images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  image_url text not null check (char_length(image_url) between 10 and 500),
  cloudinary_public_id text check (cloudinary_public_id is null or char_length(cloudinary_public_id) <= 200),
  alt_text text not null check (char_length(alt_text) between 2 and 200),
  position smallint not null default 1 check (position >= 1),
  created_at timestamptz not null default now(),
  unique (project_id, position)
);

create index project_images_project_idx on public.project_images (project_id, position asc);

-- ── Contractor Programme: Material Lists & Commercial Offers ──
create table public.contractor_material_lists (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contractor_material_lists_customer_idx on public.contractor_material_lists (customer_id, updated_at desc);

create trigger contractor_material_lists_set_updated_at before update on public.contractor_material_lists for each row execute function public.set_updated_at();

create table public.contractor_material_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.contractor_material_lists (id) on delete cascade,
  position smallint not null check (position >= 1),
  product_id text not null check (char_length(product_id) between 1 and 64),
  product_name text not null check (char_length(product_name) between 1 and 200),
  brand_name text check (brand_name is null or char_length(brand_name) <= 100),
  unit_code text not null check (unit_code in ('BAG', 'PIECE', 'KG', 'TON', 'METRIC_TON', 'CUBIC_FEET', 'CUBIC_METER', 'BUNDLE', 'BOX', 'METER', 'BRASS', 'BLOCK', 'CUSTOM')),
  unit_label text not null check (char_length(unit_label) between 1 and 40),
  quantity numeric(12, 3) not null check (quantity > 0 and quantity <= 1000000),
  notes text check (notes is null or char_length(notes) <= 500),
  unique (list_id, position)
);

create index contractor_material_list_items_list_idx on public.contractor_material_list_items (list_id, position asc);

create table public.customer_offers (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 150),
  description text check (description is null or char_length(description) <= 1000),
  valid_from date,
  valid_until date,
  eligible_categories text[] not null default '{}',
  eligible_product_ids text[] not null default '{}',
  discount_type text check (discount_type is null or discount_type in ('PERCENTAGE', 'FIXED_AMOUNT', 'CUSTOM_TERM')),
  discount_value numeric(14, 2) check (discount_value is null or discount_value >= 0),
  is_active boolean not null default false,
  approved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customer_offers_customer_idx on public.customer_offers (customer_id, is_active);

create trigger customer_offers_set_updated_at before update on public.customer_offers for each row execute function public.set_updated_at();

-- ── Local SEO: Configurable Service Areas ──
create table public.service_areas (
  id uuid primary key default gen_random_uuid(),
  area_name text not null check (char_length(area_name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text not null check (char_length(description) between 10 and 3000),
  delivery_coverage text check (delivery_coverage is null or char_length(delivery_coverage) <= 300),
  relevant_product_ids text[] not null default '{}',
  seo_title text check (seo_title is null or char_length(seo_title) <= 120),
  seo_description text check (seo_description is null or char_length(seo_description) <= 300),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index service_areas_status_idx on public.service_areas (status, area_name);

create trigger service_areas_set_updated_at before update on public.service_areas for each row execute function public.set_updated_at();

-- ── Row Level Security ──
alter table public.whatsapp_settings enable row level security;

alter table public.whatsapp_message_logs enable row level security;

alter table public.projects enable row level security;

alter table public.project_images enable row level security;

alter table public.contractor_material_lists enable row level security;

alter table public.contractor_material_list_items enable row level security;

alter table public.customer_offers enable row level security;

alter table public.service_areas enable row level security;

revoke all on table public.whatsapp_settings, public.whatsapp_message_logs, public.projects, public.project_images, public.contractor_material_lists, public.contractor_material_list_items, public.customer_offers, public.service_areas from public, anon, authenticated;

grant all on table public.whatsapp_settings, public.whatsapp_message_logs, public.projects, public.project_images, public.contractor_material_lists, public.contractor_material_list_items, public.customer_offers, public.service_areas to service_role;

grant select, insert, update, delete on table public.whatsapp_settings, public.whatsapp_message_logs, public.projects, public.project_images, public.contractor_material_lists, public.contractor_material_list_items, public.customer_offers, public.service_areas to authenticated;

create policy admin_whatsapp_settings_policy on public.whatsapp_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy admin_whatsapp_message_logs_policy on public.whatsapp_message_logs for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy admin_projects_policy on public.projects for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy admin_project_images_policy on public.project_images for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy admin_contractor_lists_policy on public.contractor_material_lists for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy admin_contractor_list_items_policy on public.contractor_material_list_items for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy admin_customer_offers_policy on public.customer_offers for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy admin_service_areas_policy on public.service_areas for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Public read access ONLY for PUBLISHED projects, their images, and PUBLISHED service areas.
grant select on table public.projects, public.project_images, public.service_areas to anon;

create policy public_published_projects_read on public.projects for select to anon using (status = 'PUBLISHED');

create policy public_published_project_images_read on public.project_images for select to anon using (exists (select 1 from public.projects p where p.id = project_id and p.status = 'PUBLISHED'));

create policy public_published_service_areas_read on public.service_areas for select to anon using (status = 'PUBLISHED');
