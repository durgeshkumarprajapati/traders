import { parsePhone } from "./index";

describe("parsePhone", () => {
  it.each([
    ["+91 98765 43210", "+919876543210", "+91 98765 43210"],
    ["+91-98765-43210", "+919876543210", "+91-98765-43210"],
    ["9876543210", "+919876543210", "+91 98765 43210"],
    ["098765 43210", "+919876543210", "098765 43210"],
    ["919876543210", "+919876543210", "+91 98765 43210"],
    ["(0771) 234 5678", "+917712345678", "(0771) 234 5678"],
    ["0091 98765 43210", "+919876543210", "0091 98765 43210"],
    ["+1 (415) 555-0132", "+14155550132", "+1 (415) 555-0132"],
    ["+14155550132", "+14155550132", "+14155550132"],
  ])("accepts %s", (input, e164, display) => {
    expect(parsePhone(input)).toEqual({ e164, href: `tel:${e164}`, display });
  });

  it.each([
    "",
    "   ",
    "abc",
    "98765 43210 ext 12",
    "9876543210,,1",
    "98765#43210",
    "*123#",
    "98+76543210",
    "+91 0987654321", // Indian national number cannot start with 0
    "+91 98765 4321", // 9 national digits
    "12345", // too short
    "+1234567890123456", // 16 digits
    "tel:+919876543210",
    "+91 98765 43210 <script>",
  ])("rejects %j", (input) => {
    expect(parsePhone(input)).toBeNull();
  });

  it("handles null and undefined", () => {
    expect(parsePhone(null)).toBeNull();
    expect(parsePhone(undefined)).toBeNull();
  });

  it("never produces anything but digits after the plus in the dial target", () => {
    for (const s of ["+91 (98765) 43210", "098765.43210"])
      expect(parsePhone(s)!.href).toMatch(/^tel:\+\d{8,15}$/);
  });
});
