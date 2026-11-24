import "server-only";

import QRCode from "qrcode";
import { brandColors } from "@/config/brand";

/**
 * QR codes for catalogue products. A code encodes ONLY the canonical public product URL (`<site>/products/<slug>`) — never a
 * token, customer data, tracking or redirect link, and nothing is sent to a third party: codes are generated on the server with
 * a local library.
 */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_SLUG_LENGTH = 80;
export const PNG_SIZES = { min: 128, max: 1024, default: 512 } as const;

export class QrInputError extends Error {}

export function isValidSlug(slug: unknown): slug is string {
  return (
    typeof slug === "string" && slug.length > 0 && slug.length <= MAX_SLUG_LENGTH && SLUG.test(slug)
  );
}

/** The configured site origin. Must be https (or http on localhost for development); anything else is refused. */
export function siteOrigin(configured: string): string {
  let u: URL;
  try {
    u = new URL(configured);
  } catch {
    throw new QrInputError("The site URL is not configured correctly.");
  }
  const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
  if (u.protocol !== "https:" && !(u.protocol === "http:" && local))
    throw new QrInputError("The site URL must use https.");
  if (u.username || u.password)
    throw new QrInputError("The site URL must not contain credentials.");
  return u.origin;
}

export function productUrl(origin: string, slug: string): string {
  if (!isValidSlug(slug)) throw new QrInputError("Invalid product slug.");
  return `${siteOrigin(origin)}/products/${slug}`;
}

/** Final safety check before encoding: same origin as the site, exactly `/products/<slug>`, no query, fragment or credentials. */
export function assertCanonicalProductUrl(url: string, origin: string): void {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new QrInputError("Not a valid URL.");
  }
  const m = /^\/products\/([^/]+)$/.exec(u.pathname);
  if (
    u.origin !== siteOrigin(origin) ||
    !m ||
    !isValidSlug(m[1]) ||
    u.search ||
    u.hash ||
    u.username ||
    u.password
  )
    throw new QrInputError("Only canonical product URLs can be encoded.");
}

export function clampSize(raw: string | null | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || !raw) return PNG_SIZES.default;
  return Math.min(PNG_SIZES.max, Math.max(PNG_SIZES.min, Math.round(n)));
}

// Maximum contrast for scanners: the design system's black text colour on its white surface colour.
const COLORS = { dark: brandColors.onSurface, light: brandColors.surface } as const;

export async function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 4, color: COLORS });
}

/** QR module matrix for drawing it ourselves (e.g. onto a canvas): `modules` is size*size characters, "1" = dark. */
export function qrMatrix(url: string): { size: number; modules: string } {
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  let modules = "";
  for (let i = 0; i < size * size; i++) modules += qr.modules.data[i] ? "1" : "0";
  return { size, modules };
}

export async function qrPng(url: string, size: number): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 4,
    width: size,
    color: COLORS,
  });
}
