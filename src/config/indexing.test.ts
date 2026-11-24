// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isIndexingEnabled, robotsMetadata } from "./indexing";
import robots from "@/app/robots";

describe("search indexing switch", () => {
  it("is OFF unless SITE_INDEXING is exactly 'enabled' (fail safe)", () => {
    expect(isIndexingEnabled({ SITE_INDEXING: "enabled" })).toBe(true);
    for (const v of [undefined, "", "disabled", "true", "1", "ENABLED", "enabled ", "yes"])
      expect(isIndexingEnabled({ SITE_INDEXING: v })).toBe(false);
    expect(isIndexingEnabled({})).toBe(false);
  });

  it("produces noindex/nofollow robots metadata by default and index/follow when enabled", () => {
    expect(robotsMetadata(false)).toEqual({ index: false, follow: false });
    expect(robotsMetadata(true)).toEqual({ index: true, follow: true });
  });

  it("robots.txt disallows everything until launch, and keeps admin/api/dev blocked afterwards", () => {
    vi.stubEnv("SITE_INDEXING", "");
    expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
    vi.stubEnv("SITE_INDEXING", "enabled");
    expect(robots()).toEqual({
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api",
          "/dev",
          "/track-enquiry",
          "/quotation",
          "/my-material-lists",
          "/rate-alerts/confirm",
          "/rate-alerts/unsubscribe",
        ],
      },
    });
    vi.unstubAllEnvs();
  });

  it("the root layout applies the switch, and admin/dev routes are ALWAYS noindex regardless of it", () => {
    const root = (p: string) => readFileSync(join(process.cwd(), "src/app", p), "utf8");
    expect(root("layout.tsx")).toMatch(/robots:\s*robotsMetadata\(\)/);
    expect(root("admin/layout.tsx")).toMatch(
      /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/,
    );
    expect(root("dev/components/page.tsx")).toMatch(/index:\s*false/);
    expect(root("dev/sheets/page.tsx")).toMatch(/index:\s*false/);
  });

  it("customer pages do not override robots (so the global switch decides)", () => {
    const dir = join(process.cwd(), "src/app/(website)");
    for (const f of [
      "page.tsx",
      "products/page.tsx",
      "contact/page.tsx",
      "bulk-enquiry/page.tsx",
      "products/[slug]/page.tsx",
    ]) {
      expect(readFileSync(join(dir, f), "utf8"), f).not.toMatch(/robots/);
    }
    expect(
      readFileSync(join(process.cwd(), "src/components/website/product-detail.tsx"), "utf8"),
    ).not.toMatch(/robots/);
  });
});
