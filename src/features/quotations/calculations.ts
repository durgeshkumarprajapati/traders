/**
 * Safe 2-decimal rounded financial arithmetic for Quotations.
 * Avoids IEEE 754 floating point inaccuracies.
 */

export function roundToTwoDecimals(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function calculateLineTotal(quantity: number, unitPrice: number): number {
  if (quantity <= 0 || unitPrice < 0) return 0;
  return roundToTwoDecimals(quantity * unitPrice);
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
  const subtotal = roundToTwoDecimals(
    items.reduce((sum, item) => sum + calculateLineTotal(item.quantity, item.unitPrice), 0),
  );

  const cleanDiscount = Math.max(0, roundToTwoDecimals(discountAmount));
  const cleanTax = Math.max(0, roundToTwoDecimals(taxAmount));
  const totalAmount = Math.max(0, roundToTwoDecimals(subtotal - cleanDiscount + cleanTax));

  return {
    subtotal,
    discountAmount: cleanDiscount,
    taxAmount: cleanTax,
    totalAmount,
  };
}
