// @vitest-environment node
import nextConfig from "../../next.config";
import robots from "@/app/robots";

async function headersFor(path: string): Promise<Map<string, string>> {
  const rules = (await nextConfig.headers?.()) ?? [];
  const out = new Map<string, string>();
  // Next.js header sources used here are literal paths plus "/:path*" (any depth).
  const toRegex = (source: string) => new RegExp(`^${source.replace(":path*", ".*")}$`);
  for (const rule of rules) {
    if (toRegex(rule.source).test(path)) for (const h of rule.headers) out.set(h.key, h.value); // later rules override
  }
  return out;
}

describe("private routes: no cache, no indexing, no Referer leak", () => {
  it.each([
    "/track-enquiry",
    "/quotation/qt_0123456789abcdef0123456789abcdef",
    "/api/quotation/qt_0123456789abcdef0123456789abcdef/pdf",
    "/api/admin/quotations/00000000-0000-0000-0000-000000000000/pdf",
    "/admin/enquiries/abc",
  ])("%s is served private, no-store, noindex, no-referrer", async (path) => {
    const h = await headersFor(path);
    expect(h.get("Cache-Control")).toBe("private, no-store, max-age=0");
    expect(h.get("X-Robots-Tag")).toMatch(/noindex/);
    expect(h.get("Referrer-Policy")).toBe("no-referrer");
    expect(h.get("X-Frame-Options")).toBe("DENY"); // global protections still apply
  });

  it("public pages keep the normal referrer policy and are not forced uncacheable", async () => {
    const h = await headersFor("/products");
    expect(h.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(h.has("Cache-Control")).toBe(false);
  });

  it("robots.txt keeps crawlers away from the private routes once indexing is enabled", () => {
    vi.stubEnv("SITE_INDEXING", "enabled");
    const r = robots() as { rules: { disallow: string[] } };
    expect(r.rules.disallow).toEqual(
      expect.arrayContaining(["/track-enquiry", "/quotation", "/admin", "/api"]),
    );
    vi.unstubAllEnvs();
  });
});
