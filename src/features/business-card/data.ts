import type { BusinessSettings } from "@/features/settings/business-settings";
import { parsePhone } from "@/lib/phone";

/**
 * Everything the visiting card shows, built ONLY from Business Settings, the active catalogue categories and the configured
 * public site URL. A field that is not configured (or not valid) is `null`/empty and the card simply omits it. Nothing here is
 * invented, defaulted to a sample value, or copied from a design mock-up.
 */
export type BusinessCardData = {
  name: string;
  tagline: string | null;
  /** Approved https logo URL, or null to draw the built-in brand mark. */
  logoUrl: string | null;
  phone: string | null;
  /** Shown only when it is a different number from `phone`. */
  whatsapp: string | null;
  /** The configured WhatsApp number is the same as the phone number (label the row "Phone & WhatsApp"). */
  phoneIsWhatsapp: boolean;
  email: string | null;
  address: string | null;
  hours: string | null;
  /** Only a structurally valid GSTIN is shown. */
  gstin: string | null;
  categories: string[];
  website: { host: string; url: string } | null;
  /** QR module matrix for `website.url`; present only together with `website`. */
  qr: { size: number; modules: string } | null;
};

export const MAX_CATEGORIES = 6;
const MAX_CATEGORY_CHARS = 26;
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clean = (v: string | null | undefined, max: number): string | null => {
  const s = (v ?? "").replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
};

/** The public https origin for the QR code / footer, or null (localhost, http, credentials, unparseable → omitted, never guessed). */
export function publicWebsite(
  configured: string | null | undefined,
): { host: string; url: string } | null {
  if (!configured) return null;
  let u: URL;
  try {
    u = new URL(configured);
  } catch {
    return null;
  }
  const h = u.hostname.toLowerCase();
  const local =
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h.endsWith(".local") ||
    /^[\d.]+$/.test(h) ||
    h.includes(":");
  if (u.protocol !== "https:" || u.username || u.password || local || !h.includes(".")) return null;
  return { host: u.host, url: u.origin };
}

export function buildBusinessCardData(input: {
  settings: BusinessSettings;
  /** Active catalogue categories, in display order. */
  categoryNames: readonly string[];
  /** `NEXT_PUBLIC_SITE_URL`. */
  siteUrl: string | null | undefined;
  /** Produces the QR matrix for a URL (server-side). Omitted → no QR. */
  makeQr?: (url: string) => { size: number; modules: string };
}): BusinessCardData {
  const { settings: s } = input;
  const phone = parsePhone(s.phone);
  const waDigits = (s.whatsappNumber ?? "").replace(/\D/g, "");
  const wa = waDigits ? parsePhone(`+${waDigits}`) : null;
  const website = publicWebsite(input.siteUrl);
  const gst = (s.gstNumber ?? "").replace(/\s+/g, "").toUpperCase();
  const email = clean(s.email, 254);
  const logo = s.logoUrl && /^https:\/\//i.test(s.logoUrl) ? s.logoUrl : null;

  const seen = new Set<string>();
  const categories: string[] = [];
  for (const raw of input.categoryNames) {
    const n = clean(raw, 80);
    if (!n || seen.has(n.toLowerCase())) continue;
    seen.add(n.toLowerCase());
    categories.push(n.length > MAX_CATEGORY_CHARS ? `${n.slice(0, MAX_CATEGORY_CHARS - 1)}…` : n);
    if (categories.length === MAX_CATEGORIES) break;
  }

  return {
    name: clean(s.name, 100) ?? "",
    tagline: clean(s.tagline, 200),
    logoUrl: logo,
    phone: phone?.display ?? null,
    whatsapp: wa && wa.e164 !== phone?.e164 ? wa.display : null,
    phoneIsWhatsapp: Boolean(wa && phone && wa.e164 === phone.e164),
    email: email && EMAIL.test(email) ? email : null,
    address: clean(s.address, 300),
    hours: clean(s.businessHours, 160),
    gstin: GSTIN.test(gst) ? gst : null,
    categories,
    website,
    qr: website && input.makeQr ? input.makeQr(website.url) : null,
  };
}

/** A card is worth offering only when a customer could actually reach the business from it. */
export const hasCardContent = (d: BusinessCardData): boolean =>
  Boolean(d.name && (d.phone || d.email || d.address));

export function cardFilename(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return `${slug || "business"}-business-card.png`;
}
