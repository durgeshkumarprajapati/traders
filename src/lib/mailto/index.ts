/**
 * "Email enquiry" (mailto:) builders — the email counterpart of `lib/whatsapp`. A mailto link only OPENS the
 * customer's email app with a prepared message; the customer must press Send. Never present a clicked link as a
 * sent email, and never store anything: this path creates no database record.
 * The address must come from business settings — nothing is hard-coded here.
 */

const MAX_SUBJECT = 150;
const MAX_BODY = 1000; // same bound as the WhatsApp message; keeps the URL within common mail-client limits

/** Returns the trimmed address when it is a plausible single address, otherwise null. */
export function normalizeEmailAddress(input: string | null | undefined): string | null {
  const v = input?.trim();
  if (!v || v.length > 254) return null;
  // One address only: no whitespace, commas/semicolons (multiple recipients), angle brackets, or URL delimiters
  // that could smuggle extra mailto parameters (?, &, #, %).
  return /^[^\s@,;<>?&#%]+@[^\s@,;<>?&#%]+\.[^\s@,;<>?&#%]+$/.test(v) ? v : null;
}

export function buildMailtoUrl(
  to: string | null | undefined,
  subject: string,
  body: string,
): string | null {
  const address = normalizeEmailAddress(to);
  if (!address) return null;
  const s = subject
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, MAX_SUBJECT);
  const b = body.trim().slice(0, MAX_BODY).replace(/\r?\n/g, "\r\n");
  return `mailto:${address}?subject=${encodeURIComponent(s)}&body=${encodeURIComponent(b)}`;
}

export function generalEnquirySubject(businessName: string): string {
  return `Enquiry for building materials — ${businessName}`.trim();
}
export const BULK_ENQUIRY_SUBJECT = "Bulk quotation enquiry";
export function productEnquirySubject(productName: string): string {
  return `Rate enquiry: ${productName}`;
}
