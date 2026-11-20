import {
  BULK_ENQUIRY_SUBJECT,
  buildMailtoUrl,
  normalizeEmailAddress,
  productEnquirySubject,
} from ".";
import { bulkEnquiryMessage } from "@/lib/whatsapp";

describe("normalizeEmailAddress", () => {
  it("accepts a plain address and trims it", () => {
    expect(normalizeEmailAddress("  sales@example.test ")).toBe("sales@example.test");
  });
  it.each([
    null,
    undefined,
    "",
    "   ",
    "no-at-sign",
    "a@b",
    "a b@c.test",
    "a@b.test, c@d.test",
    "a@b.test;c@d.test",
    "<a@b.test>",
    "a@b.test?cc=x@y.test",
    "a@b.test&bcc=x@y.test",
    "a@b.test#x",
    "a%40b@c.test",
    `${"x".repeat(250)}@b.test`,
  ])("rejects %j (missing, malformed, multiple recipients, or parameter smuggling)", (v) => {
    expect(normalizeEmailAddress(v as string | null | undefined)).toBeNull();
  });
});

describe("buildMailtoUrl", () => {
  it("builds a mailto URL with an encoded subject and body", () => {
    const url = buildMailtoUrl(
      "sales@example.test",
      "Rate enquiry: TMT 12mm & more",
      "Line 1\nLine 2",
    )!;
    expect(url.startsWith("mailto:sales@example.test?subject=")).toBe(true);
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("subject")).toBe("Rate enquiry: TMT 12mm & more");
    expect(params.get("body")).toBe("Line 1\r\nLine 2"); // CRLF per RFC 6068
    expect([...params.keys()]).toEqual(["subject", "body"]); // nothing extra can be injected
  });

  it("returns null without a valid configured address (nothing invented)", () => {
    expect(buildMailtoUrl(null, "s", "b")).toBeNull();
    expect(buildMailtoUrl("bad", "s", "b")).toBeNull();
  });

  it("bounds subject and body and strips subject line breaks (no header injection)", () => {
    const url = buildMailtoUrl(
      "a@b.test",
      `x\r\nBcc: evil@x.test${"s".repeat(500)}`,
      "b".repeat(5000),
    )!;
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("subject")!.length).toBeLessThanOrEqual(150);
    expect(params.get("subject")).not.toMatch(/[\r\n]/);
    expect(params.get("body")!.length).toBeLessThanOrEqual(1000);
  });

  it("carries the same item list as the WhatsApp message", () => {
    const msg = bulkEnquiryMessage([{ name: "Cement PPC", quantity: 100, unitLabel: "Bag" }]);
    const body = new URLSearchParams(
      buildMailtoUrl("a@b.test", BULK_ENQUIRY_SUBJECT, msg)!.split("?")[1],
    ).get("body")!;
    expect(body).toContain("- Cement PPC: 100 Bag");
    expect(productEnquirySubject("X")).toBe("Rate enquiry: X");
  });
});
