// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const APP = join(process.cwd(), "src/app");
const walk = (d: string): string[] =>
  readdirSync(d).flatMap((n) =>
    statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)],
  );
const pages = walk(join(APP, "(website)")).filter((f) => f.endsWith(`${sep}page.tsx`));
const rel = (f: string) => relative(APP, f).split(sep).join("/");

describe("website pages are prerender-safe (Cache Components)", () => {
  it("no customer page blocks on data at the top of its default export; data is read inside <Suspense>", () => {
    // `quotation/[token]` is intentionally per-request (connection()) and already streams behind its own boundary.
    const offenders = pages
      .filter((f) => !rel(f).startsWith("(website)/quotation/"))
      .filter((f) => /export default async function/.test(readFileSync(f, "utf8")))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it("pages that read the catalogue do it in a child rendered inside <Suspense>", () => {
    for (const f of pages.filter((p) =>
      /loadCatalogue|loadSettings/.test(readFileSync(p, "utf8")),
    )) {
      const t = readFileSync(f, "utf8");
      if (rel(f) === "(website)/quotation/[token]/page.tsx") continue;
      expect(t, rel(f)).toMatch(/<Suspense/);
    }
  });
});
