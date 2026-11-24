// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const SRC = join(process.cwd(), "src");
const walk = (d: string): string[] =>
  readdirSync(d).flatMap((n) =>
    statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)],
  );
const all = walk(SRC).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
const text = (f: string) => readFileSync(f, "utf8");

describe("Phase 13 security rules", () => {
  it("every 'use server' file exports only async functions (each export is a public endpoint)", () => {
    const actionFiles = all.filter((f) => /^\s*["']use server["']/m.test(text(f)));
    expect(actionFiles.length).toBeGreaterThan(3);
    for (const f of actionFiles) {
      const t = text(f);
      const exports = [...t.matchAll(/^export\s+(?!async function)(\w+)/gm)]
        // type-only exports are erased at build time
        .filter((m) => !/^(type|interface)$/.test(m[1]))
        .map((m) => m[1]);
      expect(exports, relative(SRC, f).split(sep).join("/")).toEqual([]);
    }
  });

  it("rate-alert tokens travel in the URL fragment, never the query string", () => {
    const t = text(join(SRC, "features/rate-alerts/server/service.ts"));
    expect(t).toContain("/rate-alerts/confirm#t=");
    expect(t).toContain("/rate-alerts/unsubscribe#t=");
    expect(t).not.toMatch(/rate-alerts\/(confirm|unsubscribe)\?/);
  });

  it("token pages are noindex and send no referrer", () => {
    for (const m of ["confirm", "unsubscribe"]) {
      const t = text(join(SRC, `app/(website)/rate-alerts/${m}/page.tsx`));
      expect(t).toMatch(/index:\s*false/);
      expect(t).toMatch(/referrer:\s*"no-referrer"/);
    }
  });

  it("no customer email provider is configured, and Web3Forms is never used to email customers", () => {
    expect(text(join(SRC, "lib/email/provider.ts"))).toMatch(
      /loadCustomerEmailProvider\(\)[^{]*\{\s*return null;/,
    );
    const service = text(join(SRC, "features/rate-alerts/server/service.ts"));
    expect(service).not.toMatch(/web3forms/i);
  });

  it("the rate-alert job and admin rate-alert page are protected (cron secret / admin console layout)", () => {
    expect(text(join(SRC, "app/api/rate-alerts/process/route.ts"))).toContain("authorizeCron");
    expect(
      all.some(
        (f) => relative(SRC, f).split(sep).join("/") === "app/admin/(console)/rate-alerts/page.tsx",
      ),
    ).toBe(true);
  });

  it("public pages do not render user-supplied HTML", () => {
    const risky = all
      .filter((f) => /dangerouslySetInnerHTML/.test(text(f)))
      .map((f) => relative(SRC, f));
    // JSON-LD only, as before Phase 13
    for (const r of risky)
      expect(r).not.toMatch(/tools|compare|rate-alerts|material-lists|delivery|expert/);
  });
});
