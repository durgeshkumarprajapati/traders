// @vitest-environment node
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { STOCK_STATUSES } from "@/features/products/stock";
import { UNIT_CODES } from "@/features/products/units";

const root = process.cwd();
const migration = readFileSync(
  join(root, "supabase/migrations/20261118000000_enquiries.sql"),
  "utf8",
);
const authMigration = readFileSync(
  join(root, "supabase/migrations/20261120000000_admin_auth.sql"),
  "utf8",
);
const customerFeaturesMigration = readFileSync(
  join(root, "supabase/migrations/20261123000000_customer_features.sql"),
  "utf8",
);
const stub = readFileSync(join(root, "supabase/tests/00_stub.sql"), "utf8");
const sqlTests = readFileSync(join(root, "supabase/tests/01_enquiries.sql"), "utf8");
const authSqlTests = readFileSync(join(root, "supabase/tests/02_admin_auth.sql"), "utf8");
const customerFeaturesSqlTests = readFileSync(
  join(root, "supabase/tests/03_customer_features.sql"),
  "utf8",
);

describe("migration (static checks — always run)", () => {
  const tables = [...migration.matchAll(/create table public\.(\w+)/g)].map((m) => m[1]);

  it("creates exactly the approved tables", () => {
    expect(tables.sort()).toEqual([
      "enquiries",
      "enquiry_items",
      "enquiry_notes",
      "notification_attempts",
      "notification_outbox",
      "rate_limits",
    ]);
  });

  it("enables Row Level Security on EVERY table and defines no permissive policies", () => {
    for (const t of tables)
      expect(migration, t).toMatch(
        new RegExp(`alter table public\\.${t} enable row level security`),
      );
    expect(migration).not.toMatch(/create policy/i);
  });

  it("revokes table access from anon/authenticated/public and grants only to service_role", () => {
    expect(migration).toMatch(/revoke all on table[^;]*from public, anon, authenticated/);
    for (const t of tables)
      expect(migration.match(/revoke all on table[^;]*;/)![0]).toContain(`public.${t}`);
    expect(migration).not.toMatch(/grant [^;]* to (anon|authenticated|public)\b/i);
  });

  it("locks every SECURITY DEFINER function to service_role", () => {
    const fns = [
      ...migration.matchAll(/create function public\.(\w+)\([^)]*\)[^$]*security definer/g),
    ].map((m) => m[1]);
    expect(fns.sort()).toEqual([
      "check_rate_limit",
      "claim_notification",
      "create_enquiry",
      "list_due_notifications",
      "purge_rate_limits",
      "record_notification_attempt",
      "retry_notification",
    ]);
    const revoke = migration.match(/revoke all on function[^;]*;/)![0];
    const grant = migration.match(/grant execute on function[^;]*;/)![0];
    for (const f of fns) {
      expect(revoke, f).toContain(`public.${f}(`);
      expect(grant, f).toContain(`public.${f}(`);
    }
    expect(revoke).toMatch(/from public, anon, authenticated/);
    expect(grant).toMatch(/to service_role;$/);
    expect(migration.match(/security definer set search_path = public, pg_temp/g)?.length).toBe(
      fns.length,
    ); // no search_path hijacking
  });

  it("keeps SQL check constraints in sync with the TypeScript constants", () => {
    const list = (v: readonly string[]) => v.map((x) => `'${x}'`).join(", ");
    expect(migration).toContain(`unit_code in (${list(UNIT_CODES)})`);
    expect(migration).toContain(`stock_status in (${list(STOCK_STATUSES)})`);
    expect(migration).toContain(
      `status in ('NEW', 'CONTACTED', 'QUOTATION_SENT', 'CONFIRMED', 'COMPLETED', 'CANCELLED')`,
    );
    expect(migration).toContain(`type in ('BULK', 'GENERAL')`);
    expect(migration).not.toMatch(/'PRODUCT'/); // there is no per-product enquiry type
  });

  it("never stores a zero or missing price as 0 and snapshots the required product facts", () => {
    expect(migration).toMatch(
      /listed_price numeric\(14, 2\) check \(listed_price is null or listed_price > 0\)/,
    );
    for (const col of [
      "product_id",
      "product_name",
      "brand_name",
      "unit_code",
      "unit_label",
      "quantity",
      "listed_price",
      "stock_status",
    ]) {
      expect(migration, col).toMatch(
        new RegExp(`create table public\\.enquiry_items[\\s\\S]*?\\b${col}\\b`),
      );
    }
  });

  it("has the keys, uniques and indexes the design requires", () => {
    expect(migration).toMatch(/idempotency_key uuid not null unique/);
    expect(migration).toMatch(/reference text not null unique/);
    expect(migration).toMatch(/unique \(enquiry_id, product_id\)/);
    expect(migration).toMatch(/unique \(outbox_id, attempt_number\)/);
    expect(migration).toMatch(/unique \(enquiry_id, channel, kind\)/);
    expect(migration).toMatch(/idempotency_key text not null unique/);
    for (const idx of [
      "enquiries_status_created_idx",
      "enquiries_mobile_idx",
      "enquiries_customer_name_idx",
      "enquiry_items_enquiry_idx",
      "notification_outbox_due_idx",
    ]) {
      expect(migration, idx).toContain(idx);
    }
  });

  it("contains no credentials or personal data", () => {
    expect(migration + sqlTests).not.toMatch(
      /eyJ[A-Za-z0-9_-]{20,}|BEGIN PRIVATE KEY|service_role_key\s*=/i,
    );
  });
});

describe("Phase 7 admin_auth migration (static checks — always run)", () => {
  it("creates admin_profiles table referencing auth.users", () => {
    expect(authMigration).toMatch(
      /create table public\.admin_profiles\s*\(\s*id uuid primary key references auth\.users\s*\(id\)\s*on delete cascade/,
    );
    expect(authMigration).toMatch(/email text not null check/);
    expect(authMigration).toMatch(/is_active boolean not null default true/);
  });

  it("enables Row Level Security on admin_profiles and defines restricted policy", () => {
    expect(authMigration).toMatch(/alter table public\.admin_profiles enable row level security/);
    expect(authMigration).toMatch(
      /revoke all on table public\.admin_profiles from public, anon, authenticated/,
    );
    expect(authMigration).toMatch(
      /create policy admin_profiles_read_own on public\.admin_profiles for select to authenticated using \(auth\.uid\(\) = id and is_active = true\)/,
    );
  });

  it("defines is_admin() function with security definer and safe search_path", () => {
    expect(authMigration).toMatch(
      /create function public\.is_admin\(\) returns boolean language sql stable security definer set search_path = public, pg_temp/i,
    );
    expect(authMigration).toMatch(/revoke all on function public\.is_admin\(\) from public, anon/);
    expect(authMigration).toMatch(
      /grant execute on function public\.is_admin\(\) to authenticated, service_role/,
    );
  });

  it("grants admin RLS access to enquiries, enquiry_items, enquiry_notes, and outbox", () => {
    expect(authMigration).toContain("create policy admin_enquiries_policy on public.enquiries");
    expect(authMigration).toContain(
      "create policy admin_enquiry_items_policy on public.enquiry_items",
    );
    expect(authMigration).toContain(
      "create policy admin_enquiry_notes_policy on public.enquiry_notes",
    );
    expect(authMigration).toContain(
      "create policy admin_outbox_policy on public.notification_outbox",
    );
    expect(authMigration).toContain(
      "create policy admin_attempts_policy on public.notification_attempts",
    );
  });

  it("contains no credentials or secrets", () => {
    expect(authMigration + authSqlTests).not.toMatch(
      /eyJ[A-Za-z0-9_-]{20,}|BEGIN PRIVATE KEY|service_role_key\s*=/i,
    );
  });
});

describe("Customer Features migration (static checks — always run)", () => {
  it("creates status history, callbacks, quotations, and quotation_items tables", () => {
    expect(customerFeaturesMigration).toContain("create table public.enquiry_status_history");
    expect(customerFeaturesMigration).toContain("create table public.enquiry_callbacks");
    expect(customerFeaturesMigration).toContain("create table public.quotations");
    expect(customerFeaturesMigration).toContain("create table public.quotation_items");
  });

  it("enables RLS on all customer feature tables", () => {
    for (const t of [
      "enquiry_status_history",
      "enquiry_callbacks",
      "quotations",
      "quotation_items",
    ]) {
      expect(customerFeaturesMigration).toContain(
        `alter table public.${t} enable row level security`,
      );
    }
  });

  it("locks get_tracked_enquiry and get_tracked_quotation functions to service_role", () => {
    expect(customerFeaturesMigration).toMatch(
      /create function public\.get_tracked_enquiry\([^)]*\)[^$]*security definer/g,
    );
    expect(customerFeaturesMigration).toMatch(
      /create function public\.get_tracked_quotation\([^)]*\)[^$]*security definer/g,
    );
    expect(customerFeaturesMigration).toContain(
      "grant execute on function public.get_tracked_enquiry(text, text), public.get_tracked_quotation(text) to service_role",
    );
    expect(customerFeaturesMigration).toContain(
      "revoke all on function public.get_tracked_enquiry(text, text), public.get_tracked_quotation(text) from public, anon, authenticated",
    );
  });

  it("contains no credentials or secrets", () => {
    expect(customerFeaturesMigration + customerFeaturesSqlTests).not.toMatch(
      /eyJ[A-Za-z0-9_-]{20,}|BEGIN PRIVATE KEY|service_role_key\s*=/i,
    );
  });
});

function findPostgres(): string | null {
  const dirs = [
    "/usr/lib/postgresql/17/bin",
    "/usr/lib/postgresql/16/bin",
    "/usr/lib/postgresql/15/bin",
    "/usr/local/pgsql/bin",
    ...(process.env.PATH ?? "").split(":"),
  ];
  return dirs.find((d) => existsSync(join(d, "initdb")) && existsSync(join(d, "postgres"))) ?? null;
}
const bin = findPostgres();

/**
 * Executes the REAL migration and the self-asserting SQL tests on a throwaway PostgreSQL data directory using
 * standalone single-user mode (no server, no sockets). Covers transactions/rollback, constraints, idempotency, the
 * outbox lease/claim/retry logic, the rate limiter and role privileges. Skipped when PostgreSQL binaries are absent.
 * Limitation: single-user mode runs as a superuser, so RLS *enforcement* cannot be exercised (see the SQL file).
 */
describe.skipIf(!bin)("migration on real PostgreSQL (single-user mode)", () => {
  let dir: string;
  let output = "";

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "pgmig-"));
    const init = spawnSync(
      join(bin!, "initdb"),
      ["-D", join(dir, "data"), "-A", "trust", "-U", "postgres", "--no-sync"],
      { encoding: "utf8" },
    );
    if (init.status !== 0) throw new Error(`initdb failed: ${init.stderr}`);
    const run = spawnSync(
      join(bin!, "postgres"),
      ["--single", "-j", "-D", join(dir, "data"), "postgres"],
      {
        input:
          [
            stub,
            migration,
            sqlTests,
            authMigration,
            authSqlTests,
            customerFeaturesMigration,
            customerFeaturesSqlTests,
          ].join("\n\n") + "\n\n",
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      },
    );
    output = `${run.stdout}\n${run.stderr}`;
  }, 120_000);

  afterAll(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("applies the migration and passes every SQL assertion with no errors", () => {
    const errors = output.split("\n").filter((l) => /\b(ERROR|FATAL):/.test(l));
    expect(errors).toEqual([]);
    expect(output).toContain('marker = "SQL_TESTS_PASSED"');
    expect(output).toContain('marker = "ADMIN_AUTH_SQL_TESTS_PASSED"');
    expect(output).toContain('marker = "CUSTOMER_FEATURES_SQL_TESTS_PASSED"');
  });
});
