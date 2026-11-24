// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const SRC = join(process.cwd(), "src");
const walk = (d: string): string[] =>
  readdirSync(d).flatMap((n) =>
    statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)],
  );
const all = walk(SRC).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
const rel = (f: string) => relative(SRC, f).split(sep).join("/");
const text = (f: string) => readFileSync(f, "utf8");
const read = (p: string) => text(join(SRC, p));

describe("Phase 14 placement and hygiene", () => {
  it("no customer-facing source builds a tel: link from the business phone by hand (everything goes through lib/phone)", () => {
    const offenders = all
      .filter((f) => !rel(f).startsWith("lib/phone/") && !rel(f).startsWith("components/admin/"))
      .filter((f) => /tel:\$\{/.test(text(f)))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it("the business call link, call button and footer use the shared validated helper", () => {
    expect(read("components/business/business-call-link.tsx")).toContain("parsePhone");
    expect(read("components/website/contact-actions.tsx")).toContain("parsePhone");
    expect(read("components/website/site-footer.tsx")).toContain("BusinessCallLink");
    expect(read("components/website/site-header.tsx")).toContain("BusinessCallLink");
    expect(read("components/website/contact-details.tsx")).toContain("BusinessCallLink");
  });

  it("every public place that shows the business phone offers a call link", () => {
    for (const f of [
      "components/website/site-header.tsx", // top bar + mobile drawer
      "components/website/site-footer.tsx",
      "components/website/contact-details.tsx", // contact page + homepage contact section
      "components/website/callback-modal.tsx",
      "components/website/track-enquiry-view.tsx",
      "components/website/quotation-view.tsx",
      "app/(website)/offline/page.tsx",
    ])
      expect(read(f), f).toMatch(/BusinessCallLink|CallButton/);
  });

  it("WhatsApp stays a separate action with its own number", () => {
    const header = read("components/website/site-header.tsx");
    expect(header).toContain("settings.whatsappNumber");
    expect(read("components/website/contact-actions.tsx")).toContain("buildWhatsAppUrl");
  });

  it("the visiting card is offered on the homepage and contact page, and linked from the footer", () => {
    expect(read("components/website/home-content.tsx")).toContain("BusinessCardSection");
    expect(read("components/website/contact-content.tsx")).toContain("BusinessCardSection");
    expect(read("components/website/site-footer.tsx")).toContain("/contact#visiting-card");
  });

  it("the card reads business data only through settings; no business contact value is hard-coded in card sources", () => {
    const sources = all.filter(
      (f) =>
        (rel(f).startsWith("features/business-card/") ||
          rel(f).startsWith("components/business/")) &&
        !rel(f).endsWith("fixtures.ts"),
    );
    expect(sources.length).toBeGreaterThan(5);
    for (const f of sources) {
      const t = text(f);
      expect(t, rel(f)).not.toMatch(/\+?91[\s-]?\d{5}[\s-]?\d{5}/); // no phone number
      expect(t, rel(f)).not.toMatch(/[\w.-]+@[\w-]+\.(com|in|example)\b/); // no email address
      expect(t, rel(f)).not.toMatch(/\b\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z]\d\b/); // no GSTIN
    }
  });

  it("the QR library is never part of the client bundle: only a server module imports it", () => {
    const importers = all.filter((f) => /from\s+["']qrcode["']/.test(text(f))).map(rel);
    expect(importers).toEqual(["features/qr/qr.ts"]);
    expect(text(join(SRC, "features/qr/qr.ts"))).toMatch(/^import "server-only";/m);
    const clients = all.filter(
      (f) => /^\s*["']use client["']/m.test(text(f)) && /features\/qr\/qr/.test(text(f)),
    );
    expect(clients.map(rel)).toEqual([]);
  });

  it("no new public API route was added for the card or calling; the service worker caches nothing new for them", () => {
    const api = all.map(rel).filter((r) => r.startsWith("app/api/"));
    expect(api.some((r) => /card|call|phone/i.test(r))).toBe(false);
    expect(readFileSync(join(process.cwd(), "public/sw.js"), "utf8")).not.toMatch(
      /business-card|visiting/i,
    );
  });
});
