# Supabase setup (Phases 6 & 7)

> **Status:** The schemas and every SQL function for Phase 6 (`20261118000000_enquiries.sql`) and Phase 7 (`20261120000000_admin_auth.sql`) were executed against a real PostgreSQL 16 instance in the test suite (`supabase/tests/*.sql`, run by `src/lib/supabase/migration.test.ts`). **A live Supabase project was not contacted** in the development environment. Follow the verification and provisioning steps below when deploying to your live Supabase project.

---

## 1. Create the project

1. Create a Supabase project in the Supabase Dashboard (choose a region close to your business/customers).
2. Store the database password in your password manager.
3. From **Project Settings → API**, copy:
   - **Project URL** (`NEXT_PUBLIC_SUPABASE_URL`)
   - **anon (public)** key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - **service_role (secret)** key (`SUPABASE_SERVICE_ROLE_KEY`)
4. In **Authentication → Providers → Email**:
   - Enable Email provider.
   - **Disable "Confirm email"** for the administrator account (or manually confirm it in the Dashboard).
   - **Disable "Allow new users to sign up"** (ensures there is NO public user registration).

---

## 2. Apply Migrations

Apply the versioned migrations in chronological order:

1. `supabase/migrations/20261118000000_enquiries.sql` (Phase 6: enquiries, items, notes, outbox, rate limits).
2. `supabase/migrations/20261120000000_admin_auth.sql` (Phase 7: admin_profiles, is_admin(), admin RLS policies).

You can apply them via:

- **Supabase Dashboard SQL Editor:** paste each file and click **Run**; or
- **Supabase CLI:** `supabase link --project-ref <ref>` followed by `supabase db push`.

### Security Posture in Migrations

- `admin_profiles` has Row Level Security enabled.
- Anonymous and public roles have all access revoked.
- Authenticated users can only `SELECT` their own profile where `auth.uid() = id AND is_active = true`.
- Functions (`is_admin()`) are `SECURITY DEFINER` with fixed `search_path = public, pg_temp`.
- Admin RLS policies on `enquiries`, `enquiry_items`, `enquiry_notes`, `notification_outbox`, and `notification_attempts` require `public.is_admin() = true`. Non-admin authenticated users receive zero rows.

---

## 3. Manual Administrator Provisioning Procedure

There is **no public registration or admin creation form**. The single v1 administrator must be manually provisioned:

### Step 3.1: Create Auth User

1. Go to **Supabase Dashboard → Authentication → Users**.
2. Click **Add User → Create User**.
3. Enter the administrator's email address and a strong, unique password.
4. Check **Auto Confirm User** (or manually verify the email).
5. Click **Create User**.
6. Copy the newly generated **User UID** (UUID string, e.g. `a1b2c3d4-e5f6-7890-abcd-ef1234567890`).

### Step 3.2: Insert Admin Authorization Record

In the **SQL Editor**, run the following query, replacing `<USER_UID>` and `<ADMIN_EMAIL>` with the values from Step 3.1:

```sql
insert into public.admin_profiles (id, email, full_name, is_active)
values (
  '<USER_UID>'::uuid,
  '<ADMIN_EMAIL>',
  'Sagar Administrator',
  true
);
```

### Step 3.3: Verify Admin Sign In

1. Navigate to `https://your-site.com/admin/login` (or `http://localhost:3000/admin/login`).
2. Enter the administrator email and password.
3. Click **Sign In**.
4. Confirm successful redirection to `/admin/dashboard`.
5. Confirm the console sidebar displays the administrator's name/email and the **Sign Out** button.

### Step 3.4: Deactivating Administrator Access

To disable access without deleting records:

```sql
update public.admin_profiles
set is_active = false, updated_at = now()
where id = '<USER_UID>'::uuid;
```

Once `is_active` is set to `false`, the user is immediately denied access on all protected routes and Server Actions, and will be logged out on the next request.

### Step 3.5: Revoking / Invalidating Active Sessions

1. Go to **Authentication → Users** in the Supabase Dashboard.
2. Click the three dots `...` next to the user.
3. Select **Reset Password** or **Log out user** (revokes all refresh tokens).
4. Any active cookies become invalid on next token refresh.

---

## 4. Verification Checklist (Owner verification)

1. **Unauthenticated access to console:**
   - Open an incognito browser window and navigate to `/admin/dashboard`.
   - Expect automatic redirect to `/admin/login?returnTo=%2Fadmin%2Fdashboard`.
   - Protected dashboard content must NOT be rendered.
2. **Login with invalid credentials:**
   - Submit incorrect password on `/admin/login`.
   - Expect generic error: `"Invalid email or password."`.
3. **Login with non-admin Supabase account:**
   - Create a test user in Supabase Auth _without_ an `admin_profiles` row.
   - Attempt login on `/admin/login`.
   - Expect denied access with `"Invalid email or password."` and session terminated.
4. **Successful administrator login:**
   - Submit provisioned administrator credentials.
   - Expect redirect to `/admin/dashboard`.
5. **Logout:**
   - Click **Sign Out** in the admin sidebar.
   - Expect session invalidated and redirect to `/admin/login`.
   - Back button or visiting `/admin/dashboard` redirects to `/admin/login`.
6. **Direct API request protection:**
   - Make a direct `GET` request using curl: `curl -i http://localhost:3000/api/admin/session`
   - Expect HTTP status `401 Unauthorized` with JSON `{ "error": { "code": "UNAUTHORIZED", ... } }`.
