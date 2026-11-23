// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import manifest from "@/app/manifest";

describe("Progressive Web App (PWA) configuration", () => {
  it("defines a compliant web app manifest with standalone display and branding", () => {
    const m = manifest();
    expect(m.name).toBe("Sagar Traders");
    expect(m.short_name).toBe("Sagar Traders");
    expect(m.start_url).toBe("/");
    expect(m.display).toBe("standalone");
    expect(m.background_color).toBe("#FFFFFF");
    expect(m.theme_color).toBe("#17365D");
    expect(m.orientation).toBeUndefined(); // no portrait lock (accessibility)
    expect(m.scope).toBe("/");
    expect(m.id).toBe("/");

    expect(m.icons).toBeDefined();
    expect(m.icons?.length).toBeGreaterThanOrEqual(3);

    const sizes = m.icons?.map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");

    const maskable = m.icons?.find((i) => i.purpose === "maskable");
    expect(maskable).toBeDefined();
  });

  it("has valid icon asset files generated in public/icons/", () => {
    const root = process.cwd();
    expect(existsSync(join(root, "public/icons/icon-192.png"))).toBe(true);
    expect(existsSync(join(root, "public/icons/icon-512.png"))).toBe(true);
    expect(existsSync(join(root, "public/icons/icon-maskable.png"))).toBe(true);
  });

  it("contains safe service worker with strict exclusions for admin, quotations, and enquiry tracking", () => {
    const root = process.cwd();
    const swPath = join(root, "public/sw.js");
    expect(existsSync(swPath)).toBe(true);

    const swContent = readFileSync(swPath, "utf8");
    // Strict network-only exclusions
    expect(swContent).toContain("/admin");
    expect(swContent).toContain("/track-enquiry");
    expect(swContent).toContain("/quotation");
    expect(swContent).toContain("token");
    expect(swContent).toContain("mustBypass"); // the single gate every request passes through

    // Offline fallback handling
    expect(swContent).toContain("/offline");
    expect(swContent).toContain("caches.match");
  });
});
