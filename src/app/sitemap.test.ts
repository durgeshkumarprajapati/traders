// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/lib/env/public", () => ({
  publicEnv: {
    NEXT_PUBLIC_SITE_URL: "https://example.com",
    NEXT_PUBLIC_SUPABASE_URL: "https://mock.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  },
}));

import sitemap from "./sitemap";

describe("Sitemap Generator", () => {
  it("includes all public static routes and product detail routes", async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);

    expect(urls).toContain("https://example.com");
    expect(urls).toContain("https://example.com/products");
    expect(urls).toContain("https://example.com/bulk-enquiry");
    expect(urls).toContain("https://example.com/contact");

    // Product routes should be generated
    const productRoutes = urls.filter((u) => u.includes("/products/"));
    expect(productRoutes.length).toBeGreaterThan(0);

    // Never includes admin or dev routes
    for (const url of urls) {
      expect(url).not.toContain("/admin");
      expect(url).not.toContain("/api");
      expect(url).not.toContain("/dev");
    }
  });
});
