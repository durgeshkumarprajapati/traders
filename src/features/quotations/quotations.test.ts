// @vitest-environment node
import { calculateLineTotal, calculateQuotationTotals, roundToTwoDecimals } from "./calculations";
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
    const buffer = generateQuotationPdf(sampleQuotation);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(500);

    const pdfString = buffer.toString("binary");
    expect(pdfString.startsWith("%PDF-1.4")).toBe(true);
    expect(pdfString).toContain("QUO-2026-001001");
    expect(pdfString).toContain("Sharma Construction");
    expect(pdfString).toContain("SAGAR TRADERS");
    expect(pdfString).toContain("startxref");
    expect(pdfString).toContain("%%EOF");
  });
});
