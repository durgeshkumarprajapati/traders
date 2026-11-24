// @vitest-environment node
import jsQR from "jsqr";
import { PNG } from "pngjs";
import {
  QrInputError,
  assertCanonicalProductUrl,
  clampSize,
  isValidSlug,
  productUrl,
  qrPng,
  qrSvg,
  siteOrigin,
} from "./qr";

/** Decodes a PNG QR image with an independent reader (jsQR) — an automated stand-in for scanning with a phone. */
function scan(png: Buffer): string | null {
  const img = PNG.sync.read(png);
  return jsQR(new Uint8ClampedArray(img.data), img.width, img.height)?.data ?? null;
}

describe("slug and origin validation", () => {
  it.each(["cement-ppc-50kg", "tmt-12mm", "a", "a1-b2"])("accepts %s", (s) =>
    expect(isValidSlug(s)).toBe(true),
  );
  it.each([
    "",
    "UPPER",
    "has space",
    "../x",
    "a/b",
    "a--b",
    "-a",
    "a-",
    "x".repeat(81),
    "a?b=c",
    "a#b",
    "<script>",
    "%2e%2e",
    null,
    undefined,
    5,
  ])("rejects %j", (s) => expect(isValidSlug(s)).toBe(false));

  it("only https (or http on localhost) origins, no credentials", () => {
    expect(siteOrigin("https://shop.example.test/")).toBe("https://shop.example.test");
    expect(siteOrigin("http://localhost:3000")).toBe("http://localhost:3000");
    for (const bad of [
      "http://shop.example.test",
      "ftp://x.test",
      "javascript:alert(1)",
      "https://user:pw@shop.test",
      "not a url",
      "",
    ])
      expect(() => siteOrigin(bad), bad).toThrow(QrInputError);
  });

  it("builds the canonical product URL and refuses a bad slug or origin", () => {
    expect(productUrl("https://shop.example.test", "tmt-12mm")).toBe(
      "https://shop.example.test/products/tmt-12mm",
    );
    expect(productUrl("https://shop.example.test/some/path?x=1", "tmt")).toBe(
      "https://shop.example.test/products/tmt",
    ); // only the origin is used
    expect(() => productUrl("https://shop.example.test", "Bad Slug")).toThrow(QrInputError);
    expect(() => productUrl("http://shop.example.test", "tmt")).toThrow(QrInputError);
  });

  const O = "https://shop.example.test";
  it("accepts only canonical product URLs", () => {
    expect(() => assertCanonicalProductUrl(`${O}/products/tmt-12mm`, O)).not.toThrow();
  });
  it.each([
    "https://evil.example/products/tmt",
    `${O}/products/tmt?token=secret`,
    `${O}/products/tmt#frag`,
    `${O}/track-enquiry#ref=ENQ-1&token=tr_secret`,
    `${O}/quotation/qt_0123456789abcdef0123456789abcdef`,
    `${O}/products/`,
    `${O}/products/a/b`,
    `${O}/admin/dashboard`,
    "https://user:pw@shop.example.test/products/tmt",
    "http://shop.example.test/products/tmt",
    "javascript:alert(1)",
    "not a url",
    `${O}/products/UPPER`,
  ])("refuses %s (private, tokenised, off-site or malformed)", (u) => {
    expect(() => assertCanonicalProductUrl(u, O)).toThrow(QrInputError);
  });
});

describe("size clamping", () => {
  it("defaults, clamps to 128–1024, rounds, ignores junk", () => {
    expect(clampSize(null)).toBe(512);
    expect(clampSize("")).toBe(512);
    expect(clampSize("abc")).toBe(512);
    expect(clampSize("10")).toBe(128);
    expect(clampSize("99999")).toBe(1024);
    expect(clampSize("300.6")).toBe(301);
    expect(clampSize("-5")).toBe(128);
  });
});

describe("generated images", () => {
  const url = "https://shop.example.test/products/cement-ppc-50kg";

  it("PNG has the PNG signature, the requested width, and SCANS back to exactly the canonical URL", async () => {
    const png = await qrPng(url, 512);
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const img = PNG.sync.read(png);
    expect(img.width).toBeGreaterThanOrEqual(400);
    expect(scan(png)).toBe(url);
  });

  it("scans correctly at the smallest and largest sizes", async () => {
    expect(scan(await qrPng(url, 128))).toBe(url);
    expect(scan(await qrPng(url, 1024))).toBe(url);
  });

  it("SVG is a standalone SVG document (the same code), black on white", async () => {
    const svg = await qrSvg(url);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("xmlns");
    expect(svg.toLowerCase()).toContain("#000000");
    expect(svg).not.toMatch(/<script|onload|href=/i);
  });

  it("a long slug still produces a scannable code", async () => {
    const long = `https://shop.example.test/products/${"a".repeat(40)}-${"b".repeat(39)}`;
    expect(scan(await qrPng(long, 600))).toBe(long);
  });

  it("two different products give different codes", async () => {
    const a = await qrSvg("https://shop.example.test/products/a");
    const b = await qrSvg("https://shop.example.test/products/b");
    expect(a).not.toBe(b);
  });
});
