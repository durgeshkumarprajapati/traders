import { NextResponse } from "next/server";
import { loadCatalogue } from "@/features/catalogue/server";
import {
  assertCanonicalProductUrl,
  clampSize,
  isValidSlug,
  productUrl,
  qrPng,
  qrSvg,
} from "@/features/qr/qr";
import { publicEnv } from "@/lib/env/public";
import { logger } from "@/lib/logger";

/**
 * Public QR image for an ACTIVE catalogue product: `/api/qr/product/<slug>?format=svg|png&size=512&download=1`.
 * Encodes only the canonical product URL. Unknown, inactive and malformed slugs get a plain 404/400 and no image.
 * Cheap and public like the product page itself; size is clamped so it cannot be used to make large images.
 */
const text = (status: number, body: string) =>
  new NextResponse(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isValidSlug(slug)) return text(400, "Invalid product.");

  const q = new URL(request.url).searchParams;
  const format = q.get("format") ?? "svg";
  if (format !== "svg" && format !== "png") return text(400, "Unsupported format.");

  const load = await loadCatalogue();
  if (!load.ok) return text(503, "Product information is temporarily unavailable.");
  if (!load.catalogue.products.some((p) => p.slug === slug)) return text(404, "Product not found.");

  try {
    const origin = publicEnv.NEXT_PUBLIC_SITE_URL;
    const url = productUrl(origin, slug);
    assertCanonicalProductUrl(url, origin);
    const headers: Record<string, string> = {
      "cache-control": "public, max-age=3600, s-maxage=3600",
      "x-content-type-options": "nosniff",
    };
    if (q.get("download") === "1")
      headers["content-disposition"] = `attachment; filename="sagar-traders-${slug}-qr.${format}"`;
    if (format === "svg")
      return new NextResponse(await qrSvg(url), {
        headers: { ...headers, "content-type": "image/svg+xml; charset=utf-8" },
      });
    return new NextResponse(new Uint8Array(await qrPng(url, clampSize(q.get("size")))), {
      headers: { ...headers, "content-type": "image/png" },
    });
  } catch (error) {
    logger.error("qr_generation_failed", { error });
    return text(500, "The QR code could not be generated.");
  }
}
