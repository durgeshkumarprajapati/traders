import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { PageContainer } from "@/components/common/container";
import { Card } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/ui/navigation-aids";
import { QuotationView } from "@/components/website/quotation-view";
import { loadSettings } from "@/features/catalogue/server";
import { guardTokenAccess } from "@/features/quotations/server/access";
import { getTrackedQuotation } from "@/features/quotations/server/quotations";

// Private page: never indexed, and the metadata never reveals anything about the quotation or the customer.
export const metadata: Metadata = {
  title: "Your quotation",
  robots: { index: false, follow: false, nocache: true },
};

interface QuotationPageProps {
  params: Promise<{ token: string }>;
}

export default async function QuotationPage({ params }: QuotationPageProps) {
  await connection(); // per-request, never prerendered or shared
  const { token } = await params;
  if (!token || token.length < 32 || token.length > 128) notFound();

  const gate = await guardTokenAccess();
  if (!gate.allowed) {
    return (
      <PageContainer className="py-section-lg">
        <Card className="mx-auto max-w-lg p-gutter-lg text-center">
          <h1 className="text-title-lg font-bold text-primary">Please try again shortly</h1>
          <p className="mt-2 text-body-md text-on-surface-variant">
            Too many attempts were made from your connection. Wait a few minutes and open the link
            again.
          </p>
        </Card>
      </PageContainer>
    );
  }

  const [quotation, settings] = await Promise.all([getTrackedQuotation(token), loadSettings()]);
  if (!quotation) notFound(); // unknown, expired and revoked links look identical

  return (
    <PageContainer className="pb-section-lg">
      <div className="pb-gutter-md pt-gutter-lg">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Track enquiry", href: "/track-enquiry" },
            { label: `Quotation ${quotation.reference}` },
          ]}
        />
      </div>
      <QuotationView
        quotation={quotation}
        token={token}
        business={{
          name: settings.name,
          tagline: settings.tagline,
          phone: settings.phone,
          email: settings.email,
          address: settings.address,
          gstin: settings.gstNumber,
          whatsappNumber: settings.whatsappNumber,
        }}
      />
    </PageContainer>
  );
}
