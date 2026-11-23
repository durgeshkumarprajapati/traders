# Database Migrations Documentation

**Project:** Sagar Traders  
**Database:** PostgreSQL 15+ (Hosted on Supabase)  
**Schema Level:** Production Grade  
**Date:** 2026-11-23

---

## 1. Migration History Overview

| Migration File                         | Version/Timestamp | Description                                                                                                | Status                 |
| -------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------- |
| `20261118000000_enquiries.sql`         | Phase 6           | Baseline enquiries, enquiry items, notification queue, and RLS policies                                    | Applied & Verified     |
| `20261120000000_admin_auth.sql`        | Phase 7           | Administrator profiles, audit log, `is_admin()` security definer function, admin RLS                       | Applied & Verified     |
| `20261123000000_customer_features.sql` | Customer Features | Enquiry tracking tokens & status timeline history, callback requests, digital quotations & items, sequence | Authoritative & Tested |

---

## 2. Migration `20261123000000_customer_features.sql` Details

### 2.1 Enquiry Tracking Columns on `public.enquiries`

- `tracking_token_hash`: `text unique` — SHA-256 hex digest of the raw 32-byte tracking token (`tr_...`). Never stores raw tokens.
- `tracking_token_expires_at`: `timestamptz` — Expiration boundary (default 90 days from creation).
- `tracking_token_revoked_at`: `timestamptz` — Revocation timestamp when manually rotated or invalidated by an administrator.

### 2.2 Status Timeline: `public.enquiry_status_history`

Maintains an immutable audit trail of customer enquiry status transitions:

- `id`: `uuid primary key default gen_random_uuid()`
- `enquiry_id`: `uuid not null references public.enquiries (id) on delete cascade`
- `previous_status`: `text check (previous_status is null or previous_status in ('NEW', 'CONTACTED', 'QUOTATION_SENT', 'CONFIRMED', 'COMPLETED', 'CANCELLED'))`
- `new_status`: `text not null check (new_status in ('NEW', 'CONTACTED', 'QUOTATION_SENT', 'CONFIRMED', 'COMPLETED', 'CANCELLED'))`
- `changed_by`: `uuid references auth.users (id) on delete set null`
- `description`: `text check (description is null or char_length(description) <= 500)`
- `created_at`: `timestamptz not null default now()`
- Indexes: `(enquiry_id, created_at asc)`

### 2.3 Callback Requests: `public.enquiry_callbacks`

Structured 1-to-1 extension table for general enquiries requesting phone assistance:

- `id`: `uuid primary key default gen_random_uuid()`
- `enquiry_id`: `uuid not null references public.enquiries (id) on delete cascade unique`
- `preferred_date`: `date`
- `preferred_time_window`: `text check (preferred_time_window is null or preferred_time_window in ('MORNING', 'AFTERNOON', 'EVENING', 'ANYTIME'))`
- `reason`: `text check (reason is null or char_length(reason) <= 200)`
- `created_at`: `timestamptz not null default now()`
- Indexes: `(enquiry_id)`

### 2.4 Digital Quotations Sequence & Tables

#### Sequence: `public.quotation_reference_seq`

- `as bigint minvalue 1 start 1000`
- Used to format human-readable quotation references: `QT-YYYY-XXXX`

#### Table: `public.quotations`

- `id`: `uuid primary key default gen_random_uuid()`
- `reference`: `text not null unique`
- `enquiry_id`: `uuid not null references public.enquiries (id) on delete cascade`
- `version`: `integer not null default 1 check (version >= 1)`
- `status`: `text not null default 'DRAFT' check (status in ('DRAFT', 'ISSUED', 'REVISED', 'EXPIRED', 'ACCEPTED', 'REJECTED'))`
- `customer_name`: `text not null check (char_length(customer_name) between 2 and 100)`
- `mobile`: `text not null check (mobile ~ '^[6-9][0-9]{9}$')`
- `email`: `text check (email is null or (char_length(email) <= 254 and position('@' in email) > 1))`
- `delivery_location`: `text check (delivery_location is null or char_length(delivery_location) between 3 and 300)`
- `subtotal`: `numeric(14, 2) not null check (subtotal >= 0)`
- `discount_amount`: `numeric(14, 2) not null default 0 check (discount_amount >= 0)`
- `tax_amount`: `numeric(14, 2) not null default 0 check (tax_amount >= 0)`
- `total_amount`: `numeric(14, 2) not null check (total_amount >= 0)`
- `terms_and_conditions`: `text check (terms_and_conditions is null or char_length(terms_and_conditions) <= 3000)`
- `valid_until`: `timestamptz`
- `tracking_token_hash`: `text unique`
- `tracking_token_expires_at`: `timestamptz`
- `tracking_token_revoked_at`: `timestamptz`
- `created_by`: `uuid references auth.users (id) on delete set null`
- `created_at`: `timestamptz not null default now()`
- `updated_at`: `timestamptz not null default now()`
- `issued_at`: `timestamptz`
- Constraints: `unique (enquiry_id, version)`
- Indexes: `(enquiry_id, version desc)`, `(reference)`, `(tracking_token_hash)`

#### Table: `public.quotation_items`

- `id`: `uuid primary key default gen_random_uuid()`
- `quotation_id`: `uuid not null references public.quotations (id) on delete cascade`
- `position`: `smallint not null check (position >= 1)`
- `product_id`: `text check (product_id is null or char_length(product_id) between 1 and 64)`
- `sku`: `text check (sku is null or char_length(sku) <= 64)`
- `product_name`: `text not null check (char_length(product_name) between 1 and 200)`
- `brand_name`: `text check (brand_name is null or char_length(brand_name) <= 100)`
- `unit_code`: `text not null check (unit_code in ('BAG', 'PIECE', 'KG', 'TON', 'METRIC_TON', 'CUBIC_FEET', 'CUBIC_METER', 'BUNDLE', 'BOX', 'METER', 'BRASS', 'BLOCK', 'CUSTOM'))`
- `unit_label`: `text not null check (char_length(unit_label) between 1 and 40)`
- `quantity`: `numeric(12, 3) not null check (quantity > 0 and quantity <= 1000000)`
- `unit_price`: `numeric(14, 2) not null check (unit_price >= 0)`
- `line_total`: `numeric(14, 2) not null check (line_total >= 0)`
- `notes`: `text check (notes is null or char_length(notes) <= 500)`
- `created_at`: `timestamptz not null default now()`
- Constraints: `unique (quotation_id, position)`
- Indexes: `(quotation_id)`

---

## 3. Security and RLS Model

1. **Default Deny**: `revoke all on table public.enquiry_status_history, public.enquiry_callbacks, public.quotations, public.quotation_items from public, anon, authenticated;`
2. **Row Level Security**: Explicitly enabled on all tables:
   - `alter table public.enquiry_status_history enable row level security;`
   - `alter table public.enquiry_callbacks enable row level security;`
   - `alter table public.quotations enable row level security;`
   - `alter table public.quotation_items enable row level security;`
3. **Admin Policies**: Full CRUD access restricted exclusively to verified administrators via `is_admin()`:
   - `admin_all_enquiry_status_history`
   - `admin_all_enquiry_callbacks`
   - `admin_all_quotations`
   - `admin_all_quotation_items`
4. **Service Role (Server Backend)**: Supabase Service Role client bypasses RLS for trusted cryptographic token resolution, timeline status lookups, and callback creation during enquiry submission. Public browser clients have zero direct access to these tables.

---

## 4. Verification Harness Testing

Tested against PostgreSQL single-user mode via `src/lib/supabase/migration.test.ts`:

- All 18 migration unit tests passed.
- Complete SQL syntax, constraints, foreign keys, triggers, and indices validated without warnings.
