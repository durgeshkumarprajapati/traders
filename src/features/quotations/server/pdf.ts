import "server-only";

import type { CustomerTrackedQuotation } from "../types";

/**
 * Business details printed on the quotation. EVERY field comes from configured Business Settings; nothing has a built-in
 * fallback, so the PDF can never show an invented phone number, address, GSTIN, bank account or payment instruction.
 * A missing field is simply omitted.
 */
export interface QuotationPdfBusinessDetails {
  name: string;
  tagline?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  gstin?: string | null;
}

export interface QuotationPdfOptions {
  /** Admin preview of a draft: stamps "DRAFT — NOT ISSUED" and never looks like an issued quotation. */
  draft?: boolean;
}

// ── Text handling ──────────────────────────────────────────────────────────────────────────────────────────────
// Standard-14 Helvetica (no embedded font) covers WinAnsi/Latin-1 only. Other scripts (e.g. Devanagari) cannot be drawn
// without embedding a font; they are replaced by "?" rather than producing a corrupt file. The on-screen quotation page
// shows the full text.
const REPLACEMENTS: Record<string, string> = {
  "—": "-",
  "–": "-",
  "·": "-",
  "•": "*",
  "₹": "Rs.",
  "“": '"',
  "”": '"',
  "‘": "'",
  "’": "'",
  "…": "...",
  "→": "->",
};

function toWinAnsi(input: string): string {
  const mapped = input
    .normalize("NFC")
    .replace(/[—–·•₹“”‘’…→]/g, (c) => REPLACEMENTS[c] ?? "?")
    .replace(/[\r\n\t]+/g, " ");
  return mapped.replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

const escapePdf = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

// Helvetica advance widths (1/1000 em) for ASCII 32–126; Latin-1 extras use an average. Bold is approximated.
const HELV =
  "278 278 355 556 556 889 667 191 333 333 389 584 278 333 278 278 556 556 556 556 556 556 556 556 556 556 278 278 584 584 584 556 1015 667 667 722 722 667 611 778 722 278 500 667 556 833 722 778 667 778 722 667 611 722 667 944 667 667 611 278 278 278 469 556 333 556 556 500 556 556 278 556 556 222 222 500 222 833 556 556 556 556 333 500 278 556 500 722 500 500 500 334 260 334 584"
    .split(" ")
    .map(Number);

function textWidth(s: string, size: number, bold = false): number {
  let w = 0;
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    w += c >= 32 && c <= 126 ? HELV[c - 32] : 556;
  }
  return ((w * (bold ? 1.07 : 1)) / 1000) * size;
}

/** Word-wraps to `maxWidth` points; a single over-long token is split by characters, so nothing is ever clipped. */
function wrap(text: string, size: number, maxWidth: number, bold = false): string[] {
  const out: string[] = [];
  for (const rawPara of text.split(/\r?\n/)) {
    const para = toWinAnsi(rawPara);
    let line = "";
    for (const word of para.split(" ").filter(Boolean)) {
      let w = word;
      while (textWidth(w, size, bold) > maxWidth) {
        let cut = w.length - 1;
        while (cut > 1 && textWidth(w.slice(0, cut), size, bold) > maxWidth) cut--;
        if (line) {
          out.push(line);
          line = "";
        }
        out.push(w.slice(0, cut));
        w = w.slice(cut);
      }
      const candidate = line ? `${line} ${w}` : w;
      if (textWidth(candidate, size, bold) <= maxWidth) line = candidate;
      else {
        out.push(line);
        line = w;
      }
    }
    if (line) out.push(line);
  }
  return out.length ? out : [""];
}

const money = (n: number) =>
  `Rs. ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const qty = (n: number) => String(Number(n.toFixed(3)));

// ── Layout ─────────────────────────────────────────────────────────────────────────────────────────────────────
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 40; // margin
const CONTENT_W = PAGE_W - 2 * M;
const BOTTOM = 62; // lowest y content may reach (footer lives below)
const NAVY = "0.09 0.21 0.36";
const AMBER = "0.96 0.65 0.14";
const GRAY = "0.30 0.30 0.30";
const LIGHT = "0.95 0.96 0.97";
const BORDER = "0.80 0.82 0.85";

const COL = { n: M + 8, desc: M + 30, brand: M + 238, qty: M + 318, rate: M + 392, total: M + 456 };
const DESC_W = 200;
const BRAND_W = 74;
const QTY_W = 70;

class Doc {
  pages: string[][] = [[]];
  y = PAGE_H - M;
  get ops() {
    return this.pages[this.pages.length - 1];
  }
  push(op: string) {
    this.ops.push(op);
  }
  text(x: number, y: number, s: string, size = 8, bold = false, color = "0.1 0.1 0.1") {
    this.push(
      `BT /${bold ? "F2" : "F1"} ${size} Tf ${color} rg ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdf(toWinAnsi(s))}) Tj ET`,
    );
  }
  rect(x: number, y: number, w: number, h: number, fill?: string, stroke?: string, lw = 0.7) {
    if (fill) this.push(`q ${fill} rg ${x} ${y} ${w} ${h} re f Q`);
    if (stroke) this.push(`q ${stroke} RG ${lw} w ${x} ${y} ${w} ${h} re S Q`);
  }
  newPage() {
    this.pages.push([]);
    this.y = PAGE_H - M;
  }
  ensure(height: number, onNewPage?: () => void) {
    if (this.y - height < BOTTOM) {
      this.newPage();
      onNewPage?.();
    }
  }
}

/**
 * Pure-TypeScript PDF 1.4 generator (no packages): A4, multi-page, wrapped text, repeated table header, page numbers, and a
 * correct cross-reference table (all text is converted to Latin-1 BEFORE byte offsets are measured).
 * The content is the persisted quotation snapshot passed in — nothing is read from the browser.
 */
export function generateQuotationPdf(
  quotation: CustomerTrackedQuotation,
  business: QuotationPdfBusinessDetails,
  options: QuotationPdfOptions = {},
): Buffer {
  const d = new Doc();
  const biz = business;

  // Letterhead
  d.rect(M, d.y - 44, CONTENT_W, 44, NAVY);
  d.rect(M, d.y - 48, CONTENT_W, 4, AMBER);
  d.text(M + 14, d.y - 22, biz.name || "Quotation", 18, true, "1 1 1");
  if (biz.tagline) d.text(M + 14, d.y - 36, biz.tagline, 9, false, AMBER);
  d.y -= 66;

  // Business contact lines (only what is configured)
  const contact: string[] = [];
  if (biz.address) contact.push(...wrap(biz.address, 8, 300));
  const phoneEmail = [biz.phone && `Phone: ${biz.phone}`, biz.email && `Email: ${biz.email}`]
    .filter(Boolean)
    .join("   ");
  if (phoneEmail) contact.push(phoneEmail);
  if (biz.gstin) contact.push(`GSTIN: ${biz.gstin}`);
  const blockTop = d.y;
  contact.forEach((l, i) => d.text(M, blockTop - 8 - i * 11, l, 8, false, GRAY));

  // Document box (right)
  const boxH = 62;
  d.rect(PAGE_W - M - 205, blockTop - boxH + 6, 205, boxH, undefined, BORDER);
  d.rect(PAGE_W - M - 205, blockTop - 17, 205, 23, LIGHT);
  d.text(
    PAGE_W - M - 195,
    blockTop - 10,
    options.draft ? "QUOTATION (DRAFT)" : "QUOTATION",
    11,
    true,
    NAVY,
  );
  d.text(
    PAGE_W - M - 195,
    blockTop - 30,
    `Ref: ${quotation.reference}  (Version ${quotation.version})`,
    8,
    true,
  );
  d.text(PAGE_W - M - 195, blockTop - 42, `Enquiry: ${quotation.enquiryReference}`, 8);
  d.text(
    PAGE_W - M - 195,
    blockTop - 54,
    options.draft || !quotation.issuedAt ? "Not yet issued" : `Date: ${date(quotation.issuedAt)}`,
    8,
  );
  d.y = Math.min(blockTop - boxH - 8, blockTop - 8 - contact.length * 11 - 6);

  // Status banner (never silent about draft / superseded / expired)
  const banner = options.draft
    ? "DRAFT - NOT ISSUED. This preview is not a valid quotation."
    : !quotation.isLatest
      ? "SUPERSEDED - a newer version of this quotation has been issued. Please use the latest version."
      : quotation.isExpired
        ? "EXPIRED - this quotation is no longer valid. Rates must be re-confirmed."
        : null;
  if (banner) {
    d.rect(M, d.y - 20, CONTENT_W, 20, "1 0.93 0.82", AMBER);
    d.text(M + 8, d.y - 13, banner, 8.5, true, "0.45 0.22 0");
    d.y -= 30;
  }

  // Customer
  const siteLines = quotation.deliveryLocation
    ? wrap(`Delivery site: ${quotation.deliveryLocation}`, 8, CONTENT_W - 20)
    : [];
  const custH = 34 + siteLines.length * 10;
  d.rect(M, d.y - custH, CONTENT_W, custH, undefined, BORDER);
  d.rect(M, d.y - 16, CONTENT_W, 16, LIGHT);
  d.text(M + 8, d.y - 11, "QUOTATION FOR", 8, true, NAVY);
  wrap(quotation.customerName, 10, CONTENT_W - 20, true)
    .slice(0, 2)
    .forEach((l, i) => d.text(M + 8, d.y - 29 - i * 11, l, 10, true));
  siteLines.forEach((l, i) => d.text(M + 8, d.y - 40 - i * 10, l, 8, false, GRAY));
  d.y -= custH + 14;

  // Items
  const tableHeader = () => {
    d.rect(M, d.y - 18, CONTENT_W, 18, NAVY);
    d.text(COL.n, d.y - 12, "#", 8, true, "1 1 1");
    d.text(COL.desc, d.y - 12, "Item description", 8, true, "1 1 1");
    d.text(COL.brand, d.y - 12, "Brand", 8, true, "1 1 1");
    d.text(COL.qty, d.y - 12, "Quantity", 8, true, "1 1 1");
    d.text(COL.rate, d.y - 12, "Rate", 8, true, "1 1 1");
    d.text(COL.total, d.y - 12, "Amount", 8, true, "1 1 1");
    d.y -= 18;
  };
  const continued = () => {
    d.text(
      M,
      d.y - 8,
      `${quotation.reference} (Version ${quotation.version}) - continued`,
      8,
      true,
      NAVY,
    );
    d.y -= 20;
    tableHeader();
  };
  d.ensure(60);
  tableHeader();
  quotation.items.forEach((item, idx) => {
    const desc = wrap(item.productName + (item.notes ? ` - ${item.notes}` : ""), 8, DESC_W);
    const brand = wrap(item.brandName || "-", 8, BRAND_W);
    const q = wrap(`${qty(item.quantity)} ${item.unitLabel}`, 8, QTY_W);
    const lines = Math.max(desc.length, brand.length, q.length);
    const rowH = lines * 10 + 8;
    d.ensure(rowH, continued);
    if (idx % 2 === 0) d.rect(M, d.y - rowH, CONTENT_W, rowH, LIGHT);
    d.rect(M, d.y - rowH, CONTENT_W, rowH, undefined, BORDER, 0.4);
    d.text(COL.n, d.y - 12, String(item.position));
    desc.forEach((l, i) => d.text(COL.desc, d.y - 12 - i * 10, l));
    brand.forEach((l, i) => d.text(COL.brand, d.y - 12 - i * 10, l));
    q.forEach((l, i) => d.text(COL.qty, d.y - 12 - i * 10, l));
    d.text(COL.rate, d.y - 12, money(item.unitPrice));
    d.text(COL.total, d.y - 12, money(item.lineTotal));
    d.y -= rowH;
  });

  // Totals (kept together)
  const rows: Array<[string, string, boolean]> = [["Subtotal", money(quotation.subtotal), false]];
  if (quotation.discountAmount > 0)
    rows.push(["Discount", `- ${money(quotation.discountAmount)}`, false]);
  if (quotation.taxAmount > 0) rows.push(["Tax", money(quotation.taxAmount), false]);
  const totalsH = rows.length * 14 + 28;
  d.y -= 12;
  d.ensure(totalsH + 10, continued);
  const tx = PAGE_W - M - 215;
  d.rect(tx, d.y - totalsH, 215, totalsH, undefined, BORDER);
  rows.forEach(([label, value], i) => {
    d.text(tx + 10, d.y - 15 - i * 14, label, 8.5);
    d.text(tx + 105, d.y - 15 - i * 14, value, 8.5);
  });
  d.rect(tx, d.y - totalsH, 215, 22, NAVY);
  d.text(tx + 10, d.y - totalsH + 7, "TOTAL", 9.5, true, "1 1 1");
  d.text(tx + 105, d.y - totalsH + 7, money(quotation.totalAmount), 9.5, true, "1 1 1");
  d.y -= totalsH + 16;

  // Validity (from the stored date only)
  if (quotation.validUntil) {
    d.ensure(16);
    d.text(
      M,
      d.y - 8,
      `This quotation is valid until ${date(quotation.validUntil)}.`,
      8.5,
      true,
      NAVY,
    );
    d.y -= 18;
  }

  // Terms: exactly what was entered for THIS quotation; the section is omitted when none was entered.
  if (quotation.termsAndConditions) {
    d.ensure(40);
    d.text(M, d.y - 8, "TERMS & CONDITIONS", 8.5, true, NAVY);
    d.y -= 18;
    for (const l of wrap(quotation.termsAndConditions, 8, CONTENT_W)) {
      d.ensure(11);
      d.text(M, d.y - 8, l, 8, false, GRAY);
      d.y -= 11;
    }
  }

  // Footer on every page
  const total = d.pages.length;
  d.pages.forEach((ops, i) => {
    const saved = d.pages;
    d.pages = [ops];
    d.rect(M, 46, CONTENT_W, 0.5, BORDER);
    d.text(M, 33, `${biz.name || "Quotation"} - computer-generated quotation`, 7, false, GRAY);
    d.text(PAGE_W - M - 50, 33, `Page ${i + 1} of ${total}`, 7, false, GRAY);
    d.pages = saved;
  });

  // ── PDF objects ──
  const objs: string[] = [];
  const pageIds = d.pages.map((_, i) => 5 + i * 2);
  objs.push("<< /Type /Catalog /Pages 2 0 R >>");
  objs.push(
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`,
  );
  objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objs.push(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  );
  d.pages.forEach((ops, i) => {
    const content = ops.join("\n");
    objs.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${6 + i * 2} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>`,
    );
    objs.push(
      `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    );
  });
  objs.push(
    `<< /Title (${escapePdf(toWinAnsi(`Quotation ${quotation.reference} v${quotation.version}`))}) /Producer (Sagar Traders website) >>`,
  );

  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n%âãÏÓ\n", "latin1")];
  const offsets: number[] = [];
  let pos = chunks[0].length;
  objs.forEach((body, i) => {
    const chunk = Buffer.from(`${i + 1} 0 obj\n${body}\nendobj\n`, "latin1");
    offsets.push(pos);
    pos += chunk.length;
    chunks.push(chunk);
  });
  const infoId = objs.length;
  let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => (xref += `${String(o).padStart(10, "0")} 00000 n \n`));
  xref += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${pos}\n%%EOF\n`;
  chunks.push(Buffer.from(xref, "latin1"));
  return Buffer.concat(chunks);
}
