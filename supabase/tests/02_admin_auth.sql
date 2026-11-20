-- Tests for Phase 7: admin_profiles, is_admin(), authorization, and RLS policies.
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000a2') on conflict do nothing;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000a3') on conflict do nothing;

-- 1. admin_profiles table constraints
do $$
begin
  insert into public.admin_profiles (id, email, full_name, is_active)
  values ('00000000-0000-0000-0000-0000000000a1', 'admin@example.com', 'Sagar Admin', true);
  perform pg_temp.ok((select count(*) from public.admin_profiles) = 1, 'admin profile inserted');
  insert into public.admin_profiles (id, email, full_name, is_active)
  values ('00000000-0000-0000-0000-0000000000a2', 'disabled@example.com', 'Disabled Admin', false);
  perform pg_temp.ok((select count(*) from public.admin_profiles) = 2, 'disabled admin inserted');
end $$;

-- 2. Email format validation check
do $$
begin
  begin
    insert into public.admin_profiles (id, email, full_name, is_active)
    values ('00000000-0000-0000-0000-0000000000a3', 'invalid-email', 'Bad Email', true);
    raise exception 'FAIL: invalid email should have been rejected';
  exception when check_violation then
    null;
  end;
end $$;

-- 3. is_admin() checks
do $$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
  perform pg_temp.ok(public.is_admin() = true, 'active admin is_admin() must be true');
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
  perform pg_temp.ok(public.is_admin() = false, 'inactive admin is_admin() must be false');
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a3', true);
  perform pg_temp.ok(public.is_admin() = false, 'non-admin user is_admin() must be false');
  perform set_config('request.jwt.claim.sub', '', true);
  perform pg_temp.ok(public.is_admin() = false, 'unauthenticated caller is_admin() must be false');
end $$;

-- 4. Verify privilege configuration
do $$
begin
  perform pg_temp.ok(has_function_privilege('anon', 'public.is_admin()', 'execute') = false, 'anon cannot execute is_admin()');
  perform pg_temp.ok(has_function_privilege('authenticated', 'public.is_admin()', 'execute') = true, 'authenticated can execute is_admin()');
  perform pg_temp.ok(has_table_privilege('anon', 'public.admin_profiles', 'select') = false, 'anon cannot select admin_profiles');
  perform pg_temp.ok(has_table_privilege('authenticated', 'public.admin_profiles', 'insert') = false, 'authenticated cannot insert admin_profiles');
  perform pg_temp.ok(has_table_privilege('authenticated', 'public.admin_profiles', 'update') = false, 'authenticated cannot update admin_profiles');
  perform pg_temp.ok(has_table_privilege('authenticated', 'public.admin_profiles', 'delete') = false, 'authenticated cannot delete admin_profiles');
  perform pg_temp.ok(has_table_privilege('authenticated', 'public.admin_profiles', 'select') = true, 'authenticated can select admin_profiles');
  perform pg_temp.ok(has_table_privilege('authenticated', 'public.enquiries', 'select') = true, 'authenticated has select privilege on enquiries for RLS');
end $$;

select 'ADMIN_AUTH_SQL_TESTS_PASSED' as marker;
