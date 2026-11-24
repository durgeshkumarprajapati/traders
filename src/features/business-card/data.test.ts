import { emptyBusinessSettings } from "@/features/settings/business-settings";
import {
  buildBusinessCardData,
  cardFilename,
  hasCardContent,
  publicWebsite,
  MAX_CATEGORIES,
} from "./data";
import { TEST_SETTINGS, sampleCard } from "./fixtures";

const DEMO_VALUES = [
  "22AABCS0000A1Z5",
  "91234 56789",
  "sagartraders-demo",
  "Plot 45-B",
  "Raipur Bypass",
  "8:00 AM – 7:00 PM",
];

describe("buildBusinessCardData", () => {
  it("carries exactly the configured values", () => {
    const d = sampleCard();
    expect(d).toMatchObject({
      name: "Test Hardware & Traders",
      tagline: "Test tagline for the card",
      phone: "+91 11111 22222",
      whatsapp: "+91 99999 00000",
      email: "desk@test-traders.example",
      address: "12 Test Street, Test Nagar, Testpur 000000",
      hours: "Test hours: Mon to Sat",
      gstin: "29ABCDE1234F1Z5",
      categories: ["Cement", "Steel", "Bricks"],
      website: { host: "shop.test-traders.example", url: "https://shop.test-traders.example" },
    });
    expect(d.qr).not.toBeNull();
  });

  it("omits everything that is not configured — no placeholders, no demo values", () => {
    const d = buildBusinessCardData({
      settings: emptyBusinessSettings(),
      categoryNames: [],
      siteUrl: null,
    });
    expect(d).toEqual({
      name: "Sagar Traders",
      tagline: null,
      logoUrl: null,
      phone: null,
      whatsapp: null,
      phoneIsWhatsapp: false,
      email: null,
      address: null,
      hours: null,
      gstin: null,
      categories: [],
      website: null,
      qr: null,
    });
    expect(hasCardContent(d)).toBe(false);
    const text = JSON.stringify(d);
    for (const v of DEMO_VALUES) expect(text).not.toContain(v);
  });

  it("never contains the reference image's demonstration values for a normal configuration", () => {
    const text = JSON.stringify(sampleCard());
    for (const v of DEMO_VALUES) expect(text).not.toContain(v);
  });

  it("shows WhatsApp only when it is a different number from the phone", () => {
    expect(
      sampleCard({ phone: "+91 99999 00000", whatsappNumber: "919999900000" }).whatsapp,
    ).toBeNull();
    expect(
      sampleCard({ phone: "09999900000", whatsappNumber: "+91 99999 00000" }).whatsapp,
    ).toBeNull();
    expect(sampleCard().whatsapp).toBe("+91 99999 00000");
  });

  it("drops an invalid phone, an invalid email and a malformed GSTIN instead of showing them", () => {
    const d = sampleCard({ phone: "call us", email: "not-an-email", gstNumber: "22AABCS" });
    expect(d.phone).toBeNull();
    expect(d.email).toBeNull();
    expect(d.gstin).toBeNull();
  });

  it("normalises GSTIN case and spacing", () => {
    expect(sampleCard({ gstNumber: " 29abcde1234f1z5 " }).gstin).toBe("29ABCDE1234F1Z5");
  });

  it("limits and cleans categories (dedupe, cap, truncate long names)", () => {
    const names = [
      "Cement",
      "cement",
      "  Steel   Bars ",
      "x".repeat(60),
      ...Array.from({ length: 10 }, (_, i) => `Cat ${i}`),
    ];
    const d = sampleCard({}, { categoryNames: names });
    expect(d.categories).toHaveLength(MAX_CATEGORIES);
    expect(d.categories[0]).toBe("Cement");
    expect(d.categories[1]).toBe("Steel Bars");
    expect(d.categories[2].length).toBeLessThanOrEqual(26);
    expect(d.categories[2].endsWith("…")).toBe(true);
  });

  it("only offers https logos", () => {
    expect(sampleCard({ logoUrl: "https://res.cloudinary.com/x/logo.png" }).logoUrl).toBe(
      "https://res.cloudinary.com/x/logo.png",
    );
    expect(sampleCard({ logoUrl: "http://example.com/logo.png" }).logoUrl).toBeNull();
    expect(sampleCard({ logoUrl: "javascript:alert(1)" }).logoUrl).toBeNull();
  });
});

describe("publicWebsite (QR / footer URL)", () => {
  it("accepts a real https origin and keeps only the origin", () => {
    expect(publicWebsite("https://www.example-shop.in/some/path?q=1")).toEqual({
      host: "www.example-shop.in",
      url: "https://www.example-shop.in",
    });
  });
  it.each([
    null,
    undefined,
    "",
    "not a url",
    "http://example-shop.in",
    "https://localhost:3000",
    "https://127.0.0.1",
    "https://192.168.1.5",
    "https://user:pass@example-shop.in",
    "https://intranet",
    "https://shop.local",
    "ftp://example-shop.in",
  ])("rejects %s so no wrong QR is ever generated", (u) => {
    expect(publicWebsite(u as string)).toBeNull();
  });
  it("produces no QR when the URL is invalid, even if a QR maker is supplied", () => {
    const d = buildBusinessCardData({
      settings: TEST_SETTINGS,
      categoryNames: [],
      siteUrl: "http://localhost:3000",
      makeQr: () => ({ size: 21, modules: "0".repeat(441) }),
    });
    expect(d.qr).toBeNull();
    expect(d.website).toBeNull();
  });
  it("the QR encodes ONLY the public origin (no tokens, no customer data)", () => {
    const seen: string[] = [];
    buildBusinessCardData({
      settings: TEST_SETTINGS,
      categoryNames: [],
      siteUrl: "https://www.example-shop.in/track-enquiry?ref=ENQ-1#t=secret",
      makeQr: (u) => (seen.push(u), { size: 21, modules: "0".repeat(441) }),
    });
    expect(seen).toEqual(["https://www.example-shop.in"]);
  });
});

describe("cardFilename", () => {
  it("is a safe, meaningful .png name", () => {
    expect(cardFilename("Sagar Traders")).toBe("sagar-traders-business-card.png");
    expect(cardFilename("A/B <c>: d?")).toBe("a-b-c-d-business-card.png");
    expect(cardFilename("???")).toBe("business-business-card.png");
  });
});
