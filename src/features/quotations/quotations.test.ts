// @vitest-environment node
import {
  calculateLineTotal,
  calculateQuotationTotals,
  formatRupees,
  linePaise,
  roundToTwoDecimals,
  toPaise,
} from "./calculations";
import { generateQuotationPdf } from "./server/pdf";
import type { CustomerTrackedQuotation } from "./types";

describe("quotation financial calculations", () => {
  it("rounds properly to two decimal places", () => {
    expect(roundToTwoDecimals(10.555)).toBe(10.56);
    expect(roundToTwoDecimals(10.554)).toBe(10.55);
    expect(roundToTwoDecimals(0.1 + 0.2)).toBe(0.3);
  });

  it("calculates line totals with zero/negative protection", () => {
    expect(calculateLineTotal(10, 450)).toBe(4500);
    expect(calculateLineTotal(2.5, 385.5)).toBe(963.75);
    expect(calculateLineTotal(-5, 100)).toBe(0);
    expect(calculateLineTotal(5, -100)).toBe(0);
  });

  it("calculates quotation subtotal, discounts, taxes and grand total accurately", () => {
    const items = [
      { quantity: 100, unitPrice: 385 }, // 38,500
      { quantity: 2, unitPrice: 62500 }, // 125,000
    ];
    // Subtotal: 163,500
    // Discount: 3,500 => 160,000
    // Tax: 8,000 => 168,000
    const totals = calculateQuotationTotals(items, 3500, 8000);
    expect(totals.subtotal).toBe(163500);
    expect(totals.discountAmount).toBe(3500);
    expect(totals.taxAmount).toBe(8000);
    expect(totals.totalAmount).toBe(168000);
  });

  it("never produces negative grand total even if discount exceeds subtotal", () => {
    const items = [{ quantity: 1, unitPrice: 1000 }];
    const totals = calculateQuotationTotals(items, 1500, 0);
    expect(totals.totalAmount).toBe(0);
  });
});

describe("pure TypeScript PDF generation", () => {
  const sampleQuotation: CustomerTrackedQuotation = {
    reference: "QUO-2026-001001",
    enquiryReference: "ENQ-2026-000042",
    version: 1,
    status: "ISSUED",
    isLatest: true,
    isExpired: false,
    customerName: "Sharma Construction",
    deliveryLocation: "Site Gate 3, Ring Road Raipur",
    subtotal: 75000,
    discountAmount: 2000,
    taxAmount: 0,
    totalAmount: 73000,
    termsAndConditions: "Standard delivery terms.",
    validUntil: "2026-12-01T00:00:00Z",
    issuedAt: "2026-11-23T10:00:00Z",
    items: [
      {
        position: 1,
        productName: "Fe 550D TMT Rebars 12mm",
        brandName: "Brand Steel",
        unitLabel: "Metric Ton",
        quantity: 1,
        unitPrice: 62000,
        lineTotal: 62000,
        notes: null,
      },
      {
        position: 2,
        productName: "PPC Cement 50kg Bag",
        brandName: "Brand Cement",
        unitLabel: "Bag",
        quantity: 35,
        unitPrice: 371.43,
        lineTotal: 13000,
        notes: null,
      },
    ],
  };

  it("produces a valid PDF 1.4 binary buffer", () => {
    const buffer = generateQuotationPdf(sampleQuotation, { name: "Test Business Name" });
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(500);

    const pdfString = buffer.toString("binary");
    expect(pdfString.startsWith("%PDF-1.4")).toBe(true);
    expect(pdfString).toContain("QUO-2026-001001");
    expect(pdfString).toContain("Sharma Construction");
    expect(pdfString).toContain("Test Business Name");
    expect(pdfString).toContain("startxref");
    expect(pdfString).toContain("%%EOF");
  });
});

describe("exact money arithmetic (integer paise, no floating-point accumulation)", () => {
  it("converts rupees to paise without drift", () => {
    expect(toPaise(0.1)).toBe(10);
    expect(toPaise(0.29)).toBe(29);
    expect(toPaise(1.005)).toBe(101);
    expect(toPaise(-5)).toBe(0);
    expect(toPaise(Number.NaN)).toBe(0);
  });

  it("classic float traps are exact", () => {
    // 0.1 + 0.2 in IEEE-754 is 0.30000000000000004
    const t = calculateQuotationTotals(
      [
        { quantity: 1, unitPrice: 0.1 },
        { quantity: 1, unitPrice: 0.2 },
      ],
      0,
      0,
    );
    expect(t.subtotal).toBe(0.3);
    expect(t.totalAmount).toBe(0.3);
    // 3 x 0.10 + round(0.333 x 0.30 = 0.0999 -> 0.10)
    expect(linePaise(3, 0.1)).toBe(30);
    expect(linePaise(0.333, 0.3)).toBe(10);
  });

  it("rounds each line half-up to the paisa, exactly like PostgreSQL round(quantity * rate, 2)", () => {
    expect(linePaise(1.5, 0.01)).toBe(2); // 0.015 -> 0.02
    expect(linePaise(1.5, 0.03)).toBe(5); // 0.045 -> 0.05
    expect(linePaise(0.001, 0.5)).toBe(0); // 0.0005 -> 0.00 (below half a paisa)
    expect(linePaise(2.5, 385.5)).toBe(96375);
    expect(calculateLineTotal(33.333, 12.34)).toBe(411.33); // 411.32922 -> 411.33
  });

  it("handles large quantities and rates without overflow or precision loss", () => {
    const t = calculateQuotationTotals([{ quantity: 999999.999, unitPrice: 99999999.99 }], 0, 0);
    expect(Number.isFinite(t.totalAmount)).toBe(true);
    expect(t.subtotal).toBe(t.totalAmount);
  });

  it("total = subtotal - discount + tax, to the paisa", () => {
    const t = calculateQuotationTotals([{ quantity: 7, unitPrice: 19.99 }], 0.07, 12.5);
    expect(t.subtotal).toBe(139.93);
    expect(t.totalAmount).toBe(152.36);
  });

  it("formats Indian rupees with 2 decimals", () => {
    expect(formatRupees(163500)).toBe("₹1,63,500.00");
    expect(formatRupees(0.3)).toBe("₹0.30");
  });
});

describe("quotation PDF content integrity", () => {
  const base: CustomerTrackedQuotation = {
    reference: "QUO-2026-001234",
    enquiryReference: "ENQ-AB12-CD34-EF56",
    version: 2,
    status: "ISSUED",
    isLatest: true,
    isExpired: false,
    customerName: "Asha Rao",
    deliveryLocation: "Pune site, Gate 2",
    subtotal: 1000,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 1000,
    termsAndConditions: null,
    validUntil: "2026-12-31T00:00:00Z",
    issuedAt: "2026-11-23T10:00:00Z",
    items: [
      {
        position: 1,
        productName: "Cement",
        brandName: null,
        unitLabel: "Bag",
        quantity: 10,
        unitPrice: 100,
        lineTotal: 1000,
        notes: null,
      },
    ],
  };
  const text = (b: Buffer) => b.toString("latin1");

  it("never prints invented business facts: no bank account, GSTIN, address, phone or payment terms unless configured", () => {
    const pdf = text(generateQuotationPdf(base, { name: "Configured Name" }));
    for (const forbidden of [
      "BANK DETAILS",
      "RTGS",
      "NEFT",
      "IFSC",
      "State Bank",
      "GSTIN",
      "Phone:",
      "Email:",
      "Raipur",
      "Advance",
      "depot",
      "freight",
    ])
      expect(pdf, forbidden).not.toContain(forbidden);
  });

  it("prints the configured business details and the quotation's own terms — and only those", () => {
    const pdf = text(
      generateQuotationPdf(
        { ...base, termsAndConditions: "Pay within 3 days.\nSecond clause here." },
        {
          name: "Configured Name",
          phone: "+91 11111 22222",
          email: "x@y.test",
          address: "1 Test Street",
          gstin: "GSTIN-FROM-SETTINGS",
        },
      ),
    );
    for (const expected of [
      "Configured Name",
      "+91 11111 22222",
      "x@y.test",
      "1 Test Street",
      "GSTIN: GSTIN-FROM-SETTINGS",
      "TERMS & CONDITIONS",
      "Pay within 3 days.",
      "Second clause here.",
      "Version 2",
      "valid until",
    ])
      expect(pdf, expected).toContain(expected);
  });

  it("omits the terms section entirely when none were entered", () => {
    expect(text(generateQuotationPdf(base, { name: "N" }))).not.toContain("TERMS & CONDITIONS");
  });

  it("prints the tax line only when tax was entered, and the discount only when > 0", () => {
    const plain = text(generateQuotationPdf(base, { name: "N" }));
    expect(plain).not.toContain("(Tax)");
    expect(plain).not.toContain("(Discount)");
    const full = text(
      generateQuotationPdf(
        { ...base, discountAmount: 50, taxAmount: 25, totalAmount: 975 },
        { name: "N" },
      ),
    );
    expect(full).toContain("(Tax)");
    expect(full).toContain("(Discount)");
    expect(full).toContain("Rs. 975.00");
  });

  it("labels superseded, expired and draft documents (never presents them as current)", () => {
    expect(text(generateQuotationPdf({ ...base, isLatest: false }, { name: "N" }))).toContain(
      "SUPERSEDED",
    );
    expect(text(generateQuotationPdf({ ...base, isExpired: true }, { name: "N" }))).toContain(
      "EXPIRED",
    );
    const draft = text(
      generateQuotationPdf(
        { ...base, issuedAt: null, status: "DRAFT" },
        { name: "N" },
        { draft: true },
      ),
    );
    expect(draft).toContain("DRAFT - NOT ISSUED");
    expect(draft).toContain("Not yet issued");
  });

  it("paginates long quotations: every line item appears, none is clipped, headers repeat, pages are numbered", () => {
    const items = Array.from({ length: 60 }, (_, i) => ({
      position: i + 1,
      productName: `Item number ${i + 1} ${"very long description text ".repeat(6)}`,
      brandName: "Some Brand Name Long",
      unitLabel: "Bag",
      quantity: 1,
      unitPrice: 10,
      lineTotal: 10,
      notes: null,
    }));
    const buf = generateQuotationPdf(
      { ...base, items, subtotal: 600, totalAmount: 600 },
      { name: "N" },
    );
    const pdf = text(buf);
    const pages = (pdf.match(/\/Type \/Page /g) ?? []).length;
    expect(pages).toBeGreaterThan(2);
    expect(pdf).toContain(`/Count ${pages}`);
    expect(pdf).toContain(`Page ${pages} of ${pages}`);
    expect(pdf).toContain("Item number 60");
    expect(pdf).toContain("continued");
    // wrapped, not truncated: the tail of a long description is present
    expect((pdf.match(/description text/g) ?? []).length).toBeGreaterThan(60);
    // no content drawn below the page bottom / above the top
    const ys = [...pdf.matchAll(/ (-?\d+(?:\.\d+)?) Td/g)].map((m) => Number(m[1]));
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(30);
    expect(Math.max(...ys)).toBeLessThanOrEqual(842);
  });

  it("writes a structurally valid file: every xref offset points at its object, even with non-ASCII input", () => {
    const buf = generateQuotationPdf(
      {
        ...base,
        customerName: "Ramesh — Kumar · Sons (Pvt) \\ ₹ सागर",
        termsAndConditions: "Pay “fast” … okay",
      },
      { name: "Näme — Co" },
    );
    const s = buf.toString("latin1");
    expect(s.startsWith("%PDF-1.4")).toBe(true);
    expect(s.trimEnd().endsWith("%%EOF")).toBe(true);
    const xrefAt = Number(s.match(/startxref\n(\d+)/)![1]);
    expect(s.slice(xrefAt, xrefAt + 4)).toBe("xref");
    const entries = [...s.slice(xrefAt).matchAll(/(\d{10}) 00000 n/g)].map((m) => Number(m[1]));
    expect(entries.length).toBeGreaterThan(5);
    entries.forEach((off, i) =>
      expect(s.slice(off, off + 12)).toMatch(new RegExp(`^${i + 1} 0 obj`)),
    );
    // unsupported scripts become "?" rather than corrupting the file
    expect(s).toContain("Ramesh - Kumar - Sons");
    expect(s).toContain("Rs. ?");
  });

  it("escapes PDF syntax characters so customer text can never break out of a string", () => {
    const pdf = text(
      generateQuotationPdf({ ...base, customerName: ") Tj ET 0 0 0 rg (injected" }, { name: "N" }),
    );
    expect(pdf).toContain("\\) Tj ET 0 0 0 rg \\(injected");
  });
});
