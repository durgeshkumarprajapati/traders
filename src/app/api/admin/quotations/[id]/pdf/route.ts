import { NextResponse } from "next/server";
import { loadSettings } from "@/features/catalogue/server";
import { generateQuotationPdf } from "@/features/quotations/server/pdf";
import { getAdminQuotationForPdf } from "@/features/quotations/server/quotations";
import { getAuthenticatedAdmin } from "@/lib/auth/admin";

/** Admin-only PDF preview/download (drafts included). Requires the administrator session; never cached. */
const PRIVATE = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await getAuthenticatedAdmin();
  if (!admin) return new NextResponse("Unauthorized", { status: 401, headers: PRIVATE });
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return new NextResponse("Not found", { status: 404, headers: PRIVATE });

  const found = await getAdminQuotationForPdf(id);
  if (!found) return new NextResponse("Not found", { status: 404, headers: PRIVATE });

  const settings = await loadSettings();
  const pdf = generateQuotationPdf(
    found.quotation,
    {
      name: settings.name,
      tagline: settings.tagline,
      phone: settings.phone,
      email: settings.email,
      address: settings.address,
      gstin: settings.gstNumber,
    },
    { draft: found.isDraft },
  );
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      ...PRIVATE,
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Quotation-${found.quotation.reference}-v${found.quotation.version}${found.isDraft ? "-DRAFT" : ""}.pdf"`,
    },
  });
}
