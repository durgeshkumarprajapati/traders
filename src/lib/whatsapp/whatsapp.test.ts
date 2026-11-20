import {
  buildWhatsAppUrl,
  bulkEnquiryMessage,
  generalEnquiryMessage,
  normalizeWhatsAppNumber,
  productEnquiryMessage,
} from "./index";

describe("WhatsApp builders", () => {
  it("normalises numbers to digits and rejects unusable ones", () => {
    expect(normalizeWhatsAppNumber("+91 98765-43210")).toBe("919876543210");
    expect(normalizeWhatsAppNumber("12345")).toBeNull();
    expect(normalizeWhatsAppNumber("1".repeat(16))).toBeNull();
    expect(normalizeWhatsAppNumber(null)).toBeNull();
    expect(normalizeWhatsAppNumber("")).toBeNull();
  });
  it("returns null (no link) when no valid number is configured", () => {
    expect(buildWhatsAppUrl(null, "hi")).toBeNull();
    expect(buildWhatsAppUrl("abc", "hi")).toBeNull();
  });
  it("builds a wa.me URL with the whole message encoded", () => {
    const url = buildWhatsAppUrl("+1 555 010 9999", "Rate for A&B? 50% #1\nline2")!;
    expect(url.startsWith("https://wa.me/15550109999?text=")).toBe(true);
    expect(url).toContain(encodeURIComponent("Rate for A&B? 50% #1\nline2"));
    expect(url.split("?text=")[1]).not.toMatch(/[&#\s]/);
  });
  it("caps very long messages", () => {
    const url = buildWhatsAppUrl("15550109999", "x".repeat(5000))!;
    expect(decodeURIComponent(url.split("?text=")[1])).toHaveLength(1000);
  });
  it("builds general, product and bulk messages", () => {
    expect(generalEnquiryMessage("Acme")).toContain("Acme");
    const m = productEnquiryMessage({
      productName: "P",
      brandName: "B",
      sku: "S1",
      quantity: 5,
      unitLabel: "Bag",
      deliveryLocation: " Town ",
    });
    expect(m).toBe(
      "Hello, I would like a rate for P (B) [SKU S1], quantity 5 Bag, delivery to Town.",
    );
    expect(productEnquiryMessage({ productName: "P" })).toBe("Hello, I would like a rate for P.");
    expect(bulkEnquiryMessage([{ name: "A", quantity: 2, unitLabel: "Bag" }])).toBe(
      "Hello, I would like a quotation for:\n- A: 2 Bag",
    );
    expect(bulkEnquiryMessage([])).toContain("bulk quotation");
  });
});
