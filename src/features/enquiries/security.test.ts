// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const SRC = join(process.cwd(), "src");
const walk = (d: string): string[] =>
  readdirSync(d).flatMap((n) =>
    statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)],
  );
const rel = (f: string) => relative(SRC, f).split(sep).join("/");
const files = walk(SRC).filter((f) => /\.(tsx?|css)$/.test(f));
const isTest = (f: string) => /\.test\.tsx?$/.test(f) || /\/test-[a-z-]+\.tsx?$/.test(f);
const nonTest = files.filter((f) => !isTest(f));
const text = (f: string) => readFileSync(f, "utf8");
const imports = (f: string) => [...text(f).matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
const SERVER_ONLY_MODULES = /^@\/(lib\/supabase|lib\/email|features\/enquiries\/server)/;

describe("Phase 6 credential boundaries", () => {
  it("client components never import Supabase, Web3Forms or the enquiry server layer", () => {
    const offenders = nonTest
      .filter((f) => /^\s*["']use client["']/m.test(text(f)))
      .flatMap((f) =>
        imports(f)
          .filter((i) => SERVER_ONLY_MODULES.test(i))
          .map((i) => `${rel(f)} → ${i}`),
      );
    expect(offenders).toEqual([]);
  });

  it("customer-facing pages and components never import them either; only the Server Actions file is the bridge", () => {
    const customerFacing = nonTest.filter(
      (f) =>
        (rel(f).startsWith("app/") &&
          !rel(f).startsWith("app/api/") &&
          !rel(f).startsWith("app/dev/")) ||
        rel(f).startsWith("components/"),
    );
    const offenders = customerFacing.flatMap((f) =>
      imports(f)
        .filter((i) => SERVER_ONLY_MODULES.test(i))
        .map((i) => `${rel(f)} → ${i}`),
    );
    expect(offenders).toEqual([]);
  });

  it("only the enquiry server layer imports the Supabase / email clients", () => {
    const owners = nonTest
      .filter((f) => imports(f).some((i) => /^@\/lib\/(supabase|email)\//.test(i)))
      .map(rel)
      .filter((r) => !r.startsWith("lib/supabase/") && !r.startsWith("lib/email/"))
      .sort();
    expect(owners).toEqual([
      "features/enquiries/server/deps.ts",
      "features/enquiries/server/email-template.ts",
      "features/enquiries/server/notifications.ts",
      "features/enquiries/server/rate-limit.ts",
      "features/enquiries/server/submit.ts",
    ]);
  });

  it("every module holding a secret or touching the database is marked server-only", () => {
    for (const f of [
      "lib/supabase/config.ts",
      "lib/supabase/rest.ts",
      "lib/email/web3forms.ts",
      "features/enquiries/server/deps.ts",
      "features/enquiries/server/notifications.ts",
      "features/enquiries/server/rate-limit.ts",
      "features/enquiries/server/submit.ts",
    ])
      expect(text(join(SRC, f)), f).toMatch(/^import "server-only";/m);
  });

  it("secrets are never exposed through NEXT_PUBLIC_ variables (only the project URL is public-safe)", () => {
    for (const f of nonTest) {
      const t = text(f);
      expect(t, rel(f)).not.toMatch(
        /NEXT_PUBLIC_(SUPABASE_SERVICE|SUPABASE_SECRET|WEB3FORMS|RATE_LIMIT|CRON)/,
      );
    }
  });

  it("no credential, JWT or access key is hard-coded in source", () => {
    for (const f of nonTest) {
      const t = text(f);
      expect(t, rel(f)).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./); // JWT-shaped key
      expect(t, rel(f)).not.toMatch(/sb_secret_[A-Za-z0-9_-]{10,}/);
      expect(t, rel(f)).not.toMatch(
        /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b.*access_key|access_key.*\b[0-9a-f]{8}-[0-9a-f]{4}-/,
      );
    }
  });

  it("the Server Actions file exports only async functions (every export is a public endpoint)", () => {
    const t = text(join(SRC, "features/enquiries/actions.ts"));
    expect(t).toMatch(/^"use server";/);
    const exports = [...t.matchAll(/^export\s+(.*?)\(/gm)].map((m) => m[1]);
    expect(exports.sort()).toEqual([
      "async function submitBulkEnquiryAction",
      "async function submitContactEnquiryAction",
    ]);
    expect(t.match(/^export\s/gm)).toHaveLength(2); // no other export kinds
  });

  it("only the catalogue-product route, sweeper route and Server Actions are public entry points for Phase 6", () => {
    const api = nonTest.map(rel).filter((r) => /^app\/api\//.test(r));
    expect(api.sort()).toEqual([
      "app/api/catalogue/product/route.ts",
      "app/api/notifications/process/route.ts",
    ]);
  });
});

describe("WhatsApp single-product enquiry creates no database record", () => {
  it("the WhatsApp helpers and the product enquiry panel import no persistence or server action modules", () => {
    const candidates = nonTest.filter(
      (f) => rel(f).startsWith("lib/whatsapp/") || /product-enquiry/.test(rel(f)),
    );
    expect(candidates.length).toBeGreaterThan(0);
    for (const f of candidates)
      for (const i of imports(f))
        expect(i, rel(f)).not.toMatch(/enquiries\/(actions|server)|lib\/supabase|lib\/email/);
  });

  it("the enquiry schema has no PRODUCT enquiry type anywhere in application code", () => {
    for (const f of nonTest) expect(text(f), rel(f)).not.toMatch(/["']PRODUCT["']/);
  });
});
