/**
 * Exact money arithmetic for quotations.
 *
 * Amounts are handled as INTEGER paise and quantities as INTEGER thousandths (the database stores
 * numeric(14,2) rates and numeric(12,3) quantities), with BigInt for the product — no floating-point multiplication
 * or accumulation. Line totals use round-half-up to the paisa, identical to PostgreSQL `round(quantity * rate, 2)`
 * (which is what the database actually stores; this module is the preview and cross-check).
 *
 * The server never trusts totals from the browser: `create_quotation_draft` recomputes everything in SQL.
 */

const MAX_QUANTITY_MILLI = 1_000_000_000; // 1,000,000.000 (same upper bound as the database)
const MAX_RATE_PAISE = 100_000_000_000_000; // generous ceiling (₹1,000,000,000,000.00) to keep BigInt math bounded

/** Kept for existing callers: rounds a plain number to 2 decimals (display only; never used to accumulate money). */
export function roundToTwoDecimals(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/** Rupees (≤ 2 decimals expected) → integer paise. Invalid or negative input → 0. */
export function toPaise(rupees: number): number {
  if (!Number.isFinite(rupees) || rupees <= 0) return 0;
  // toPrecision(12) removes binary representation noise (e.g. 1.005 * 100 = 100.49999999999999) before rounding half-up.
  return Math.min(Math.round(Number((rupees * 100).toPrecision(12))), MAX_RATE_PAISE);
}

/** Integer paise → rupees as an exact 2-decimal number. */
export function fromPaise(paise: number): number {
  return Math.round(paise) / 100;
}

/** Quantity → integer thousandths. Invalid / non-positive → 0. */
export function toMilli(quantity: number): number {
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  return Math.min(Math.round(Number((quantity * 1000).toPrecision(12))), MAX_QUANTITY_MILLI);
}

/** Line total in paise: round-half-up(quantityMilli × ratePaise ÷ 1000), computed in BigInt. */
export function linePaise(quantity: number, unitPrice: number): number {
  const q = BigInt(toMilli(quantity));
  const p = BigInt(toPaise(unitPrice));
  const zero = BigInt(0);
  if (q === zero || p === zero) return 0;
  return Number((q * p + BigInt(500)) / BigInt(1000));
}

export function calculateLineTotal(quantity: number, unitPrice: number): number {
  return fromPaise(linePaise(quantity, unitPrice));
}

export function calculateQuotationTotals(
  items: Array<{ quantity: number; unitPrice: number }>,
  discountAmount = 0,
  taxAmount = 0,
): {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
} {
  const subtotal = items.reduce((sum, item) => sum + linePaise(item.quantity, item.unitPrice), 0);
  const discount = toPaise(discountAmount);
  const tax = toPaise(taxAmount);
  const total = Math.max(0, subtotal - discount + tax);
  return {
    subtotal: fromPaise(subtotal),
    discountAmount: fromPaise(discount),
    taxAmount: fromPaise(tax),
    totalAmount: fromPaise(total),
  };
}

/** Indian-rupee display, always 2 decimals (e.g. ₹1,63,500.00). */
export function formatRupees(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
