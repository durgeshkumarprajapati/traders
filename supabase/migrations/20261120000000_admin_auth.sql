-- Sagar Traders — Phase 7: admin profiles, administrator authorization, admin RLS policies.
-- Applies to Supabase (PostgreSQL 15+). Authoring rule for the test harness: top-level statements are
-- separated by blank lines and there are NO blank lines inside function bodies.

create table public.admin_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null check (char_length(email) <= 254 and position('@' in email) > 1),
  full_name text not null default 'Administrator' check (char_length(full_name) between 1 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index admin_profiles_email_idx on public.admin_profiles (lower(email));

create index admin_profiles_active_idx on public.admin_profiles (is_active) where is_active = true;

-- Helper to check if the caller is an active administrator.
create function public.is_admin() returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.admin_profiles
    where id = auth.uid() and is_active = true
  );
$$;

-- ── Row Level Security: admin_profiles ──
alter table public.admin_profiles enable row level security;

-- Default deny: revoke everything from public, anon, authenticated.
revoke all on table public.admin_profiles from public, anon, authenticated;

grant all on table public.admin_profiles to service_role;

-- Authenticated users can only SELECT their own profile if they are active.
grant select on table public.admin_profiles to authenticated;

create policy admin_profiles_read_own on public.admin_profiles for select to authenticated using (auth.uid() = id and is_active = true);

-- Lock is_admin() function execution.
revoke all on function public.is_admin() from public, anon;

grant execute on function public.is_admin() to authenticated, service_role;

-- ── Admin access to enquiries, items, notes, outbox, attempts ──
grant select, update, delete on table public.enquiries, public.enquiry_items, public.enquiry_notes, public.notification_outbox, public.notification_attempts to authenticated;

grant insert on table public.enquiry_notes to authenticated;

create policy admin_enquiries_policy on public.enquiries for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy admin_enquiry_items_policy on public.enquiry_items for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy admin_enquiry_notes_policy on public.enquiry_notes for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy admin_outbox_policy on public.notification_outbox for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy admin_attempts_policy on public.notification_attempts for all to authenticated using (public.is_admin()) with check (public.is_admin());
