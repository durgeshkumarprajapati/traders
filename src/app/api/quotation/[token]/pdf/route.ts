import { NextResponse } from "next/server";
import { loadSettings } from "@/features/catalogue/server";
import { guardTokenAccess } from "@/features/quotations/server/access";
import { generateQuotationPdf } from "@/features/quotations/server/pdf";
import { getTrackedQuotation } from "@/features/quotations/server/quotations";
import { logger } from "@/lib/logger";

/**
 * Customer PDF download. Same authorization as the quotation page: the secret token in the path, rate limited, generic errors
 * for anything invalid / expired / revoked, and responses that no shared cache may store.
 */
const PRIVATE = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
} as const;

const generic = (status: number) =>
  new NextResponse("This quotation link is not valid.", {
    status,
    headers: { ...PRIVATE, "Content-Type": "text/plain; charset=utf-8" },
  });

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length < 32 || token.length > 128) return generic(404);

  const gate = await guardTokenAccess();
  if (!gate.allowed) {
    return new NextResponse("Too many requests. Please try again later.", {
      status: 429,
      headers: { ...PRIVATE, "Retry-After": String(gate.retryAfterSeconds) },
    });
  }

  try {
    const quo = await getTrackedQuotation(token);
    if (!quo) return generic(404); // unknown, expired and revoked are indistinguishable by design

    const settings = await loadSettings();
    const pdf = generateQuotationPdf(quo, {
      name: settings.name,
      tagline: settings.tagline,
      phone: settings.phone,
      email: settings.email,
      address: settings.address,
      gstin: settings.gstNumber,
    });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        ...PRIVATE,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Quotation-${quo.reference}-v${quo.version}.pdf"`,
      },
    });
  } catch (error) {
    logger.error("quotation_pdf_failed", { error });
    return new NextResponse("The quotation could not be generated right now.", {
      status: 500,
      headers: { ...PRIVATE, "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
