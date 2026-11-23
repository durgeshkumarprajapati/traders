import "server-only";

import type { CustomerTrackedQuotation } from "../types";

export interface QuotationPdfBusinessDetails {
  name: string;
  tagline?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  gstin?: string | null;
  bankDetails?: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    ifsc: string;
    branch: string;
  };
}

const DEFAULT_BUSINESS: QuotationPdfBusinessDetails = {
  name: "SAGAR TRADERS",
  tagline: "Quality Building Materials & Direct Site Supplies",
  phone: "+91 91234 56789",
  email: "sales@sagartraders.in",
  address: "Main Road, Raipur, Chhattisgarh - 492001",
  gstin: "22AAAAA0000A1Z5",
  bankDetails: {
    bankName: "State Bank of India",
    accountName: "Sagar Traders",
    accountNumber: "31234567890",
    ifsc: "SBIN0001234",
    branch: "Raipur Main Branch",
  },
};

function escapePdfText(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[\r\n\t]/g, " ");
}

function formatInr(amount: number): string {
  return amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Pure TypeScript PDF 1.4 document generator.
 * Produces compliant, professional single-page/multi-page A4 PDF documents with zero external packages.
 */
export function generateQuotationPdf(
  quotation: CustomerTrackedQuotation,
  business: QuotationPdfBusinessDetails = DEFAULT_BUSINESS,
): Buffer {
  const biz = { ...DEFAULT_BUSINESS, ...business };
  const streamLines: string[] = [];

  // Colors: Navy (0.09, 0.21, 0.36), Gold (0.96, 0.65, 0.14), Border (0.90, 0.90, 0.92)
  const NAVY = "0.09 0.21 0.36";
  const GOLD = "0.96 0.65 0.14";
  const GRAY = "0.40 0.40 0.40";
  const LIGHT_GRAY = "0.95 0.95 0.96";
  const BORDER = "0.85 0.85 0.88";

  // Top header background banner
  streamLines.push(`q ${NAVY} rg 40 760 515 50 re f Q`);
  streamLines.push(`q ${GOLD} rg 40 756 515 4 re f Q`);

  // Business Name in header banner
  streamLines.push(`BT /F2 18 Tf 1 1 1 rg 55 780 Td (${escapePdfText(biz.name)}) Tj ET`);
  streamLines.push(
    `BT /F1 9 Tf 0.96 0.65 0.14 rg 55 767 Td (${escapePdfText(biz.tagline || "")}) Tj ET`,
  );

  // Business contact under banner (left)
  streamLines.push(`BT /F1 8 Tf ${GRAY} rg`);
  streamLines.push(`55 740 Td (${escapePdfText(biz.address || "")}) Tj`);
  streamLines.push(
    `0 -11 Td (Phone: ${escapePdfText(biz.phone || "")} | Email: ${escapePdfText(biz.email || "")}) Tj`,
  );
  if (biz.gstin) {
    streamLines.push(`0 -11 Td (GSTIN: ${escapePdfText(biz.gstin)}) Tj`);
  }
  streamLines.push(`ET`);

  // Document Title & Metadata Box (right)
  streamLines.push(`q ${BORDER} RG 1 w 360 690 195 60 re s Q`);
  streamLines.push(`q ${LIGHT_GRAY} rg 360 725 195 25 re f Q`);
  streamLines.push(`BT /F2 12 Tf ${NAVY} rg 370 732 Td (FORMAL QUOTATION) Tj ET`);
  streamLines.push(`BT /F1 8 Tf 0.2 0.2 0.2 rg`);
  streamLines.push(
    `370 710 Td (Ref No: ) Tj /F2 8 Tf (${escapePdfText(quotation.reference)} v${quotation.version}) Tj /F1 8 Tf ET`,
  );
  const issueDate = quotation.issuedAt
    ? new Date(quotation.issuedAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  streamLines.push(
    `BT /F1 8 Tf 0.2 0.2 0.2 rg 370 697 Td (Date: ${escapePdfText(issueDate)}) Tj ET`,
  );

  // Customer Details Box (left)
  streamLines.push(`q ${BORDER} RG 1 w 40 640 515 45 re s Q`);
  streamLines.push(`q ${LIGHT_GRAY} rg 40 668 515 17 re f Q`);
  streamLines.push(`BT /F2 8 Tf ${NAVY} rg 48 673 Td (QUOTATION ISSUED TO / SITE DETAILS) Tj ET`);
  streamLines.push(
    `BT /F2 9 Tf 0.1 0.1 0.1 rg 48 653 Td (${escapePdfText(quotation.customerName)}) Tj ET`,
  );
  if (quotation.deliveryLocation) {
    streamLines.push(
      `BT /F1 8 Tf ${GRAY} rg 48 644 Td (Delivery Site: ${escapePdfText(quotation.deliveryLocation)}) Tj ET`,
    );
  }

  // Items Table Header
  let y = 615;
  streamLines.push(`q ${NAVY} rg 40 ${y} 515 18 re f Q`);
  streamLines.push(`BT /F2 8 Tf 1 1 1 rg`);
  streamLines.push(`48 ${y + 5} Td (#) Tj`);
  streamLines.push(`70 ${y + 5} Td (Item Description) Tj`);
  streamLines.push(`260 ${y + 5} Td (Brand) Tj`);
  streamLines.push(`345 ${y + 5} Td (Quantity) Tj`);
  streamLines.push(`420 ${y + 5} Td (Unit Rate) Tj`);
  streamLines.push(`485 ${y + 5} Td (Total) Tj`);
  streamLines.push(`ET`);

  // Table rows
  y -= 18;
  quotation.items.forEach((item, index) => {
    const isEven = index % 2 === 0;
    if (isEven) {
      streamLines.push(`q ${LIGHT_GRAY} rg 40 ${y} 515 18 re f Q`);
    }
    streamLines.push(`q ${BORDER} RG 0.5 w 40 ${y} 515 18 re s Q`);

    streamLines.push(`BT /F1 8 Tf 0.1 0.1 0.1 rg`);
    streamLines.push(`48 ${y + 5} Td (${item.position}) Tj`);
    streamLines.push(`70 ${y + 5} Td (${escapePdfText(item.productName.slice(0, 36))}) Tj`);
    streamLines.push(`260 ${y + 5} Td (${escapePdfText((item.brandName || "—").slice(0, 16))}) Tj`);
    streamLines.push(`345 ${y + 5} Td (${item.quantity} ${escapePdfText(item.unitLabel)}) Tj`);
    streamLines.push(`420 ${y + 5} Td (Rs. ${formatInr(item.unitPrice)}) Tj`);
    streamLines.push(`485 ${y + 5} Td (Rs. ${formatInr(item.lineTotal)}) Tj`);
    streamLines.push(`ET`);

    y -= 18;
  });

  // Totals Summary Box
  y -= 10;
  const totalsBoxHeight = 55;
  streamLines.push(`q ${BORDER} RG 1 w 340 ${y - totalsBoxHeight} 215 ${totalsBoxHeight} re s Q`);
  streamLines.push(`BT /F1 8 Tf 0.2 0.2 0.2 rg`);
  streamLines.push(`350 ${y - 15} Td (Subtotal:) Tj`);
  streamLines.push(`470 ${y - 15} Td (Rs. ${formatInr(quotation.subtotal)}) Tj`);
  if (quotation.discountAmount > 0) {
    streamLines.push(`350 ${y - 28} Td (Discount:) Tj`);
    streamLines.push(`470 ${y - 28} Td (-Rs. ${formatInr(quotation.discountAmount)}) Tj`);
  }
  streamLines.push(`ET`);

  // Grand Total highlight bar
  streamLines.push(`q ${NAVY} rg 340 ${y - totalsBoxHeight} 215 20 re f Q`);
  streamLines.push(`BT /F2 9 Tf 1 1 1 rg`);
  streamLines.push(`350 ${y - totalsBoxHeight + 6} Td (GRAND TOTAL:) Tj`);
  streamLines.push(
    `465 ${y - totalsBoxHeight + 6} Td (Rs. ${formatInr(quotation.totalAmount)}) Tj`,
  );
  streamLines.push(`ET`);

  // Payment Details & Bank Transfer Information (left of totals)
  if (biz.bankDetails) {
    streamLines.push(`q ${BORDER} RG 1 w 40 ${y - totalsBoxHeight} 280 ${totalsBoxHeight} re s Q`);
    streamLines.push(`q ${LIGHT_GRAY} rg 40 ${y - 15} 280 15 re f Q`);
    streamLines.push(`BT /F2 8 Tf ${NAVY} rg 48 ${y - 11} Td (BANK DETAILS FOR RTGS / NEFT) Tj ET`);
    streamLines.push(`BT /F1 7.5 Tf 0.2 0.2 0.2 rg`);
    streamLines.push(
      `48 ${y - 25} Td (Bank: ${escapePdfText(biz.bankDetails.bankName)} | A/C: ${escapePdfText(biz.bankDetails.accountNumber)}) Tj`,
    );
    streamLines.push(
      `48 ${y - 37} Td (IFSC: ${escapePdfText(biz.bankDetails.ifsc)} | Branch: ${escapePdfText(biz.bankDetails.branch)}) Tj`,
    );
    streamLines.push(
      `48 ${y - 49} Td (Beneficiary Name: ${escapePdfText(biz.bankDetails.accountName)}) Tj`,
    );
    streamLines.push(`ET`);
  }

  // Terms and Conditions Section
  const termsY = y - totalsBoxHeight - 25;
  streamLines.push(`BT /F2 8 Tf ${NAVY} rg 40 ${termsY} Td (TERMS & CONDITIONS) Tj ET`);
  streamLines.push(`BT /F1 7 Tf ${GRAY} rg`);
  streamLines.push(
    `40 ${termsY - 12} Td (1. Prices quoted are based on current depot stock rates and subject to availability at the time of order confirmation.) Tj`,
  );
  streamLines.push(
    `40 ${termsY - 22} Td (2. Unloading and site freight arrangements are as per agreed commercial delivery terms.) Tj`,
  );
  streamLines.push(
    `40 ${termsY - 32} Td (3. Payment terms: Advance via RTGS/NEFT or approved depot billing terms before dispatch.) Tj`,
  );
  if (quotation.validUntil) {
    const validDate = new Date(quotation.validUntil).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    streamLines.push(
      `40 ${termsY - 42} Td (4. This formal quotation remains valid until ${escapePdfText(validDate)}.) Tj`,
    );
  }
  streamLines.push(`ET`);

  // Footer Disclaimer
  streamLines.push(`q ${BORDER} RG 0.5 w 40 45 515 0.5 re s Q`);
  streamLines.push(`BT /F1 7 Tf ${GRAY} rg 40 32 Td`);
  streamLines.push(
    `(${escapePdfText(biz.name)} · Computer-generated digital quotation · Does not require a physical signature) Tj`,
  );
  streamLines.push(`ET`);

  const streamContent = streamLines.join("\n");
  const streamLength = Buffer.byteLength(streamContent, "utf8");

  // Construct standard PDF 1.4 objects
  const objects: string[] = [];

  // Obj 1: Catalog
  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);

  // Obj 2: Pages
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`);

  // Obj 3: Page (A4: 595.28 x 841.89 pt)
  objects.push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n`,
  );

  // Obj 4: Content Stream
  objects.push(
    `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
  );

  // Obj 5: Font F1 (Helvetica regular)
  objects.push(`5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`);

  // Obj 6: Font F2 (Helvetica bold)
  objects.push(`6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`);

  // Calculate offsets for xref table
  let currentOffset = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n".length;
  const offsets: number[] = [0]; // obj 0 is free

  for (const obj of objects) {
    offsets.push(currentOffset);
    currentOffset += Buffer.byteLength(obj, "utf8");
  }

  const startXref = currentOffset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;

  const completePdf = `%PDF-1.4\n%\xE2\xE3\xCF\xD3\n${objects.join("")}${xref}${trailer}`;
  return Buffer.from(completePdf, "binary");
}
