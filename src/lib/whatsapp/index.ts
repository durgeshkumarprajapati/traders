/**
 * WhatsApp click-to-chat builders. A link only OPENS WhatsApp with a prepared message; the
 * customer must press Send. Never present a clicked link as a sent message.
 * The number must come from business settings — nothing is hard-coded here.
 */

const MAX_MESSAGE = 1000;

/** Digits only; 8–15 digits (E.164 range). Returns null when not usable. */
export function normalizeWhatsAppNumber(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = input.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

export function buildWhatsAppUrl(
  number: string | null | undefined,
  message: string,
): string | null {
  const n = normalizeWhatsAppNumber(number);
  if (!n) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(message.trim().slice(0, MAX_MESSAGE))}`;
}

export function generalEnquiryMessage(businessName: string): string {
  return `Hello ${businessName}, I would like a quotation for building materials.`;
}

export function productEnquiryMessage(input: {
  productName: string;
  brandName?: string | null;
  sku?: string | null;
  quantity?: number | null;
  unitLabel?: string | null;
  deliveryLocation?: string | null;
}): string {
  const parts = [`Hello, I would like a rate for ${input.productName}`];
  if (input.brandName) parts.push(`(${input.brandName})`);
  if (input.sku) parts.push(`[SKU ${input.sku}]`);
  let msg = parts.join(" ");
  if (input.quantity && input.quantity > 0)
    msg += `, quantity ${input.quantity}${input.unitLabel ? ` ${input.unitLabel}` : ""}`;
  if (input.deliveryLocation?.trim()) msg += `, delivery to ${input.deliveryLocation.trim()}`;
  return `${msg}.`;
}

export function bulkEnquiryMessage(
  items: { name: string; quantity: number; unitLabel: string }[],
): string {
  if (items.length === 0) return "Hello, I would like to request a bulk quotation.";
  const lines = items.map((i) => `- ${i.name}: ${i.quantity} ${i.unitLabel}`).join("\n");
  return `Hello, I would like a quotation for:\n${lines}`;
}
