import { NextResponse } from "next/server";
import { buildNotificationDeps } from "@/features/enquiries/server/deps";
import { loadSettings } from "@/features/catalogue/server";
import { generateQuotationPdf } from "@/features/quotations/server/pdf";
import { getTrackedQuotation } from "@/features/quotations/server/quotations";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length < 32) {
    return new NextResponse("Invalid or expired quotation token", { status: 400 });
  }

  try {
    const nd = buildNotificationDeps();
    const quo = await getTrackedQuotation(token, nd.rpc);

    if (!quo) {
      return new NextResponse("Quotation not found or link expired", { status: 404 });
    }

    const settings = await loadSettings();
    const pdfBuffer = generateQuotationPdf(quo, {
      name: settings.name || "SAGAR TRADERS",
      tagline: settings.tagline,
      phone: settings.phone,
      email: settings.email,
      address: settings.address,
      gstin: settings.gstNumber,
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Quotation-${quo.reference}.pdf"`,
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch {
    return new NextResponse("Failed to generate quotation PDF", { status: 500 });
  }
}
