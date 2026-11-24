/**
 * Business phone numbers → a safe `tel:` target and a readable display string.
 *
 * Owners type numbers the way they write them (a trunk-prefixed "0…", "+91-…" with hyphens, "(0771) 234 5678"). This turns a value that is
 * unambiguously a phone number into E.164 (`+917712345678`) and refuses everything else, so a malformed setting never becomes a
 * link that dials something unintended. Nothing is hard-coded: the number always comes from Business Settings.
 *
 * Rules (documented in docs/PHASE_14_REPORT.md):
 *  - Only digits, spaces, `-`, `.`, `(`, `)` and ONE leading `+` are allowed. Letters, extensions ("x12"), commas/pauses,
 *    `#`, `*`, a `+` anywhere else, or anything else → invalid (no silent character-stripping of arbitrary text).
 *  - `+<country code><number>` or `00<country code><number>`: used as written; 8–15 digits in total (E.164).
 *  - Numbers written WITHOUT an international prefix are treated as Indian (the business operates in India):
 *    10 digits, `0` + 10 digits (trunk prefix), or `91` + 10 digits.
 *  - Indian numbers (+91) must have exactly 10 national digits, the first being 1–9.
 */
export type ParsedPhone = {
  /** `+917712345678` */
  e164: string;
  /** `tel:+917712345678` */
  href: string;
  /** The owner's own formatting when they typed separators, otherwise a grouped form. Display only; never used to dial. */
  display: string;
};

const ALLOWED = /^\+?[\d\s\-.()]+$/;

export function parsePhone(input: string | null | undefined): ParsedPhone | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw || raw.length > 30 || !ALLOWED.test(raw)) return null;
  if (raw.indexOf("+") > 0) return null;

  let digits = raw.replace(/\D/g, "");
  let international = raw.startsWith("+");
  if (!international && digits.startsWith("00")) {
    digits = digits.slice(2);
    international = true;
  }
  if (!international) {
    if (digits.length === 10) digits = `91${digits}`;
    else if (digits.length === 11 && digits.startsWith("0")) digits = `91${digits.slice(1)}`;
    else if (!(digits.length === 12 && digits.startsWith("91"))) return null; // 91 + 10 digits already has its country code
  }
  if (digits.length < 8 || digits.length > 15 || digits.startsWith("0")) return null;
  if (digits.startsWith("91") && !/^91[1-9]\d{9}$/.test(digits)) return null;

  const e164 = `+${digits}`;
  const display = /^\+?\d+$/.test(raw) ? formatDisplay(digits) : raw.replace(/\s+/g, " ");
  return { e164, href: `tel:${e164}`, display };
}

function formatDisplay(digits: string): string {
  if (digits.startsWith("91") && digits.length === 12)
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  // Other countries: country code is not split reliably without a metadata library, so group the rest in blocks of 3-4.
  return `+${digits}`;
}
