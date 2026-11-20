// @vitest-environment node
import { EMPTY_SHEETS, loadFrom, realisticSheets } from "./test-catalogue";
import {
  findProductBySlug,
  iconForCategory,
  relatedProducts,
  toBusinessSettings,
  toEnquiryItems,
} from "./view";
import { emptyBusinessSettings } from "@/features/settings/business-settings";

describe("public catalogue view (real validation pipeline)", () => {
  it("contains only active products with valid, active categories and brands", async () => {
    const { catalogue } = await loadFrom(realisticSheets());
    const slugs = catalogue.products.map((p) => p.slug);
    expect(slugs).toContain("cement-ppc-50kg");
    expect(slugs).not.toContain("retired-item"); // inactive product
    expect(slugs).not.toContain("in-inactive-category"); // active product in inactive category (validation error)
    expect(slugs).not.toContain("inactive-brand-item"); // active product with inactive brand
    expect(catalogue.products).toHaveLength(17);
    expect(catalogue.categories.map((c) => c.slug)).toEqual([
      "cement",
      "steel-tmt",
      "bricks-blocks",
    ]); // inactive "hardware" hidden, display_order respected
    expect(catalogue.brands.map((b) => b.slug)).toEqual(["brand-one", "brand-two"]); // inactive brand hidden
  });

  it("carries category images, brand logos, real prices, units and statuses through", async () => {
    const { catalogue } = await loadFrom(realisticSheets());
    expect(catalogue.categories.find((c) => c.slug === "bricks-blocks")?.imageUrl).toMatch(
      /^https:\/\/res\.cloudinary\.com\//,
    );
    expect(catalogue.categories.find((c) => c.slug === "cement")?.imageUrl).toBeNull();
    expect(catalogue.brands[0].logoUrl).toMatch(/b1\.png$/);
    const by = (slug: string) => catalogue.products.find((p) => p.slug === slug)!;
    expect(by("cement-ppc-50kg")).toMatchObject({
      price: 385,
      unit: { code: "BAG" },
      stockStatus: "IN_STOCK",
      sku: "C-1",
    });
    expect(by("tmt-12mm")).toMatchObject({
      unit: { code: "METRIC_TON" },
      stockStatus: "AVAILABLE_ON_ORDER",
    });
    expect(by("tmt-10mm")).toMatchObject({ unit: { code: "TON" }, stockStatus: "OUT_OF_STOCK" });
    expect(by("pipe-set").unit).toEqual({ code: "CUSTOM", customLabel: "Set" });
    expect(by("pipe-set").imageUrl).toMatch(/pipe\.jpg$/);
  });

  it("missing and invalid prices become null (never 0)", async () => {
    const { catalogue } = await loadFrom(realisticSheets());
    expect(catalogue.products.find((p) => p.slug === "cement-opc-53")?.price).toBeNull(); // blank
    expect(catalogue.products.find((p) => p.slug === "tmt-10mm")?.price).toBeNull(); // "abc" dropped with a warning
    expect(catalogue.products.some((p) => p.price === 0)).toBe(false);
  });

  it("does not expose internal fields to the UI", async () => {
    const { catalogue } = await loadFrom(realisticSheets());
    expect(Object.keys(catalogue.products[0]).sort()).not.toContain("isActive");
    expect(Object.keys(catalogue.products[0]).sort()).not.toContain("createdAt");
  });

  it("an empty (header-only) spreadsheet yields an empty catalogue, not an error", async () => {
    const load = await loadFrom(EMPTY_SHEETS());
    expect(load.catalogue).toEqual({ products: [], categories: [], brands: [] });
    expect(load.settings).toEqual(emptyBusinessSettings());
  });
});

describe("findProductBySlug", () => {
  it("resolves active products and rejects inactive, unknown and malformed slugs", async () => {
    const { catalogue } = await loadFrom(realisticSheets());
    expect(findProductBySlug(catalogue, "tmt-12mm")?.id).toBe("p3");
    for (const bad of [
      "retired-item",
      "in-inactive-category",
      "nope",
      "",
      "../etc/passwd",
      "TMT-12MM",
      "a b",
      "x".repeat(200),
    ]) {
      expect(findProductBySlug(catalogue, bad), bad).toBeUndefined();
    }
  });
});

describe("relatedProducts", () => {
  it("same category, excluding self, active only, limited", async () => {
    const { catalogue } = await loadFrom(realisticSheets());
    const p1 = findProductBySlug(catalogue, "cement-ppc-50kg")!;
    const rel = relatedProducts(catalogue, p1);
    expect(rel).toHaveLength(4);
    expect(rel.every((p) => p.categoryId === p1.categoryId && p.id !== p1.id)).toBe(true);
    expect(rel.map((p) => p.slug)).not.toContain("retired-item");
    expect(
      relatedProducts(catalogue, findProductBySlug(catalogue, "tmt-12mm")!).map((p) => p.slug),
    ).toEqual(["tmt-10mm"]);
  });
});

describe("toEnquiryItems (bulk enquiry picker, built server-side)", () => {
  it("uses real unit labels, availability, brand names and formatted rates; includes AVAILABLE_ON_ORDER", async () => {
    const { catalogue } = await loadFrom(realisticSheets());
    const items = toEnquiryItems(catalogue);
    const by = (id: string) => items.find((i) => i.id === id)!;
    expect(items).toHaveLength(17);
    expect(by("p3")).toMatchObject({
      unitLabel: "Metric Ton",
      stockStatus: "AVAILABLE_ON_ORDER",
      brandName: "Brand One",
      rate: "₹62,500.00 / Metric Ton",
    });
    expect(by("p4")).toMatchObject({ unitLabel: "Ton", rate: null }); // TON ≠ METRIC_TON, invalid price → no rate
    expect(by("p6")).toMatchObject({ unitLabel: "Set", rate: "₹120.00 / Set" }); // custom display label
    expect(by("p2").rate).toBeNull();
    expect(items.map((i) => i.id)).not.toContain("off"); // inactive products cannot be selected
    expect(items.map((i) => i.id)).not.toContain("badcat");
  });
});

describe("toBusinessSettings", () => {
  it("maps configured settings and leaves the rest null", async () => {
    const { settings } = await loadFrom(realisticSheets());
    expect(settings).toMatchObject({
      name: "Test Traders",
      tagline: "Test tagline for materials",
      phone: "+1 555 010 1111",
      whatsappNumber: "15550109999",
      email: "hello@example.test",
      address: "1 Test Street, Testville",
      businessHours: "Mon–Sat 9–6",
      announcement: "Test announcement",
      social: { instagram: "https://social.example.test/test" },
    });
    expect(settings.gstNumber).toBeNull();
    expect(settings.deliveryCoverage).toBeNull();
  });
  it("falls back to the brand name only, and hides a disabled announcement", () => {
    const base = {
      businessName: null,
      tagline: null,
      logoUrl: null,
      phone: null,
      whatsappNumber: null,
      email: null,
      address: null,
      businessHours: null,
      gstNumber: null,
      googleMapsUrl: null,
      deliveryCoverage: null,
      social: {},
      whyChooseUs: [],
    };
    expect(
      toBusinessSettings({ ...base, announcement: { enabled: false, text: "hidden" } }),
    ).toMatchObject({ name: "Sagar Traders", announcement: null, phone: null });
  });
});

describe("iconForCategory", () => {
  it("is presentation-only keyword matching with a generic fallback", () => {
    expect([
      iconForCategory("cement", "Cement"),
      iconForCategory("x", "Steel & TMT"),
      iconForCategory("bricks", "Bricks"),
      iconForCategory("sand", "Sand"),
      iconForCategory("h", "Hardware & Plumbing"),
      iconForCategory("misc", "Misc"),
    ]).toEqual(["cement", "steel", "bricks", "sand", "hardware", "other"]);
  });
});
